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
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=github_auth_failed`
    );
  }

  // Decode state to get user ID
  const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error_description || "Failed to get access token");
    }

    // Fetch GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const githubUser = await userResponse.json();

    // Store token in database
    await db
      .insert(users)
      .values({
        clerkUserId: userId,
        githubAccessToken: tokenData.access_token,
        githubUsername: githubUser.login,
        githubUserId: String(githubUser.id),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          githubAccessToken: tokenData.access_token,
          githubUsername: githubUser.login,
          githubUserId: String(githubUser.id),
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=github_connected`
    );
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=github_auth_failed`
    );
  }
}
