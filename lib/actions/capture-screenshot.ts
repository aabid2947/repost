"use server";

import mql from "@microlink/mql";

export async function captureScreenshot(url: string) {
  if (!url) {
    console.log("[captureScreenshot] No URL provided");
    return { screenshotUrl: null };
  }

  // Ensure the URL has a protocol
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  
  console.log("[captureScreenshot] Input URL:", url);
  console.log("[captureScreenshot] Normalized URL:", normalizedUrl);

  try {
    const response = await mql(normalizedUrl, {
      screenshot: true,
      meta: false,
      viewport: { width: 1200, height: 630 },
      timeout: 30000,
    });

    console.log("[captureScreenshot] Microlink response status:", response.status);
    console.log("[captureScreenshot] Full response:", JSON.stringify(response, null, 2));

    if (response.status !== 'success') {
      console.error("[captureScreenshot] Non-success status:", response.status);
      console.error("[captureScreenshot] Response data:", response.data);
      return { screenshotUrl: null };
    }

    const screenshotUrl = response.data?.screenshot?.url;
    
    if (!screenshotUrl) {
      console.error("[captureScreenshot] No screenshot URL in response");
      console.error("[captureScreenshot] Available data keys:", Object.keys(response.data || {}));
      return { screenshotUrl: null };
    }

    console.log("[captureScreenshot] ✓ Success! Screenshot URL:", screenshotUrl);
    return { screenshotUrl };
  } catch (error) {
    console.error("[captureScreenshot] ✗ Error occurred for:", normalizedUrl);
    console.error("[captureScreenshot] Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("[captureScreenshot] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[captureScreenshot] Full error:", error);
    return { screenshotUrl: null };
  }
}