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

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;
  
  // Store user ID in state to retrieve in callback
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  const linkedInAuthUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  linkedInAuthUrl.searchParams.set("response_type", "code");
  linkedInAuthUrl.searchParams.set("client_id", clientId!);
  linkedInAuthUrl.searchParams.set("redirect_uri", redirectUri);
  linkedInAuthUrl.searchParams.set("scope", "openid profile email w_member_social");
  linkedInAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(linkedInAuthUrl.toString());
}
