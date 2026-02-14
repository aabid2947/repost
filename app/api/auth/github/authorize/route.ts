import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    // Redirect to sign-in with return URL
    const signInUrl = new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL!);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl.toString());
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`;
  
  // Store user ID in state to retrieve in callback
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", clientId!);
  githubAuthUrl.searchParams.set("redirect_uri", redirectUri);
  githubAuthUrl.searchParams.set("scope", "repo read:user");
  githubAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(githubAuthUrl.toString());
}
