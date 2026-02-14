"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface PageScreenshot {
  path: string;
  url: string;
  description: string;
  screenshotUrl: string | null;
  file?: File;
  isUserUploaded?: boolean;
  fileDataUrl?: string; // Base64 data URL for user-uploaded files
}

export async function postToLinkedIn(
  text: string,
  postType: "text" | "image",
  screenshots?: PageScreenshot[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  console.log("[postToLinkedIn] Posting as", postType, "with", screenshots?.length || 0, "images");

  // Get LinkedIn token and person ID from database
  const user = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, userId))
    .limit(1);

  const linkedInToken = user[0]?.linkedinAccessToken;
  const personUrn = user[0]?.linkedinPersonId;

  if (!linkedInToken || !personUrn) {
    throw new Error("LinkedIn not connected. Please connect LinkedIn first.");
  }

  if (postType === "text") {
    // --- Text-only post ---
    const body = {
      author: personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${linkedInToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("[postToLinkedIn] Text post failed:", errorBody);
      throw new Error(`LinkedIn post failed: ${res.status} — ${errorBody}`);
    }

    const result = await res.json();
    console.log("[postToLinkedIn] ✓ Text post successful:", result.id);
    return { success: true, postId: result.id };
  }

  // --- Image/Carousel post ---
  if (!screenshots || screenshots.length === 0) {
    throw new Error("At least one screenshot is required for image posts");
  }

  const validScreenshots = screenshots.filter((s) => s.screenshotUrl || s.fileDataUrl);
  if (validScreenshots.length === 0) {
    throw new Error("No valid screenshot URLs or files provided");
  }

  console.log("[postToLinkedIn] Uploading", validScreenshots.length, "images...");

  // Upload all images in parallel
  const uploadPromises = validScreenshots.map(async (screenshot) => {
    // Step 1: Register upload
    const registerBody = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: personUrn,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };

    const registerRes = await fetch(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${linkedInToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerBody),
      }
    );

    if (!registerRes.ok) {
      const errorBody = await registerRes.text();
      throw new Error(`Upload register failed: ${registerRes.status} — ${errorBody}`);
    }

    const registerData = await registerRes.json();
    const uploadUrl =
      registerData.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetUrn = registerData.value.asset;

    // Step 2: Get image bytes (either from URL or base64 data)
    let imageBuffer: ArrayBuffer;
    
    if (screenshot.fileDataUrl) {
      // User-uploaded file: convert base64 data URL to buffer
      const base64Data = screenshot.fileDataUrl.split(",")[1];
      const binaryString = Buffer.from(base64Data, "base64");
      imageBuffer = binaryString.buffer.slice(
        binaryString.byteOffset,
        binaryString.byteOffset + binaryString.byteLength
      );
      console.log("[postToLinkedIn] Using user-uploaded file:", screenshot.description);
    } else if (screenshot.screenshotUrl) {
      // Microlink screenshot: download from URL
      const imageRes = await fetch(screenshot.screenshotUrl);
      imageBuffer = await imageRes.arrayBuffer();
      console.log("[postToLinkedIn] Downloaded screenshot:", screenshot.description);
    } else {
      throw new Error("No image source available");
    }

    // Step 3: Upload to LinkedIn
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${linkedInToken}`,
        "Content-Type": screenshot.fileDataUrl ? "image/jpeg" : "image/png",
      },
      body: imageBuffer,
    });

    if (!uploadRes.ok) {
      throw new Error(`Image upload failed for ${screenshot.description}: ${uploadRes.status}`);
    }

    console.log("[postToLinkedIn] ✓ Uploaded:", screenshot.description);
    return assetUrn;
  });

  const assetUrns = await Promise.all(uploadPromises);
  console.log("[postToLinkedIn] All images uploaded, creating post...");

  // Step 4: Create post with multiple images (carousel)
  const postBody = {
    author: personUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: assetUrns.map((assetUrn) => ({
          status: "READY",
          media: assetUrn,
        })),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const postRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${linkedInToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(postBody),
  });

  if (!postRes.ok) {
    const errorBody = await postRes.text();
    console.error("[postToLinkedIn] Post failed:", errorBody);
    throw new Error(`LinkedIn image post failed: ${postRes.status} — ${errorBody}`);
  }

  const postResult = await postRes.json();
  console.log("[postToLinkedIn] ✓ Post successful:", postResult.id);
  return { success: true, postId: postResult.id };
}
