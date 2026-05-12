import { NextResponse } from "next/server";
import { appConfig, siteUrl } from "@/lib/env";
import { createOAuthState } from "@/lib/session";

export async function GET() {
  try {
    const config = appConfig();
    const response = NextResponse.redirect("https://www.strava.com/oauth/authorize");
    const state = createOAuthState(response, config.sessionSecret);
    const redirectUri = `${config.siteUrl}/api/auth/callback`;
    const params = new URLSearchParams({
      client_id: config.stravaClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      approval_prompt: "auto",
      scope: config.stravaScopes,
      state,
    });
    response.headers.set("location", `https://www.strava.com/oauth/authorize?${params.toString()}`);
    return response;
  } catch (error) {
    const message = encodeURIComponent(error instanceof Error ? error.message : "Configuration error");
    return NextResponse.redirect(new URL(`/?auth_error=${message}`, siteUrl()));
  }
}
