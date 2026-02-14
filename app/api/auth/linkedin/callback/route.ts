import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=linkedin_auth_failed`
    );
  }

  // Decode state to get user ID
  const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Failed to get access token");
    }

    // Fetch LinkedIn user info (OpenID Connect userinfo endpoint)
    const userResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const linkedInUser = await userResponse.json();

    // The `sub` field is the unique LinkedIn person ID
    const personUrn = `urn:li:person:${linkedInUser.sub}`;

    // Store token in database
    await db
      .insert(users)
      .values({
        clerkUserId: userId,
        linkedinAccessToken: tokenData.access_token,
        linkedinPersonId: personUrn,
        linkedinProfileUrl: linkedInUser.profile || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          linkedinAccessToken: tokenData.access_token,
          linkedinPersonId: personUrn,
          linkedinProfileUrl: linkedInUser.profile || null,
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=linkedin_connected`
    );
  } catch (error) {
    console.error("LinkedIn OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=linkedin_auth_failed`
    );
  }
}
