import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/env";
import { encryptText } from "@/lib/crypto";
import { consumeOAuthState, setSessionCookie } from "@/lib/session";
import { exchangeCodeForToken } from "@/lib/strava/client";
import { upsertAthlete } from "@/lib/store";
import type { JsonRecord } from "@/lib/types";

export async function GET(request: NextRequest) {
  const config = appConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");
  const redirect = NextResponse.redirect(new URL("/", config.siteUrl));

  if (denied) {
    redirect.headers.set("location", `${config.siteUrl}/?auth=cancelled`);
    return redirect;
  }

  if (!code || !state || !(await consumeOAuthState(redirect, state, config.sessionSecret))) {
    redirect.headers.set("location", `${config.siteUrl}/?auth_error=invalid_state`);
    return redirect;
  }

  try {
    const token = await exchangeCodeForToken(config.stravaClientId, config.stravaClientSecret, code);
    const athlete = token.athlete as JsonRecord;
    const athleteId = Number(athlete.id);
    if (!Number.isFinite(athleteId)) throw new Error("Strava athlete id missing");

    await upsertAthlete({
      athleteId,
      username: typeof athlete.username === "string" ? athlete.username : null,
      firstname: typeof athlete.firstname === "string" ? athlete.firstname : null,
      lastname: typeof athlete.lastname === "string" ? athlete.lastname : null,
      profile: athlete,
      encryptedAccessToken: encryptText(token.access_token, config.tokenEncryptionKey),
      encryptedRefreshToken: encryptText(token.refresh_token, config.tokenEncryptionKey),
      tokenExpiresAt: new Date(token.expires_at * 1000).toISOString(),
    });

    setSessionCookie(redirect, athleteId, config.sessionSecret);
    return redirect;
  } catch (error) {
    redirect.headers.set(
      "location",
      `${config.siteUrl}/?auth_error=${encodeURIComponent(error instanceof Error ? error.message : "oauth_failed")}`,
    );
    return redirect;
  }
}
