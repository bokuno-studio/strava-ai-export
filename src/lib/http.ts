import { NextResponse } from "next/server";
import { appConfig, optionalEnv } from "@/lib/env";
import { currentAthleteId } from "@/lib/session";
import { getAthlete } from "@/lib/store";
import type { Athlete } from "@/lib/types";

export type AuthContext = {
  athleteId: number;
  athlete: Athlete;
};

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const secret = optionalEnv("SESSION_SECRET");
  const athleteId = await currentAthleteId(secret);
  if (!athleteId) return jsonError("Authentication required", 401);

  try {
    appConfig();
    const athlete = await getAthlete(athleteId);
    if (!athlete) return jsonError("Reconnect required", 401);
    return { athleteId, athlete };
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Configuration error", 500);
  }
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
