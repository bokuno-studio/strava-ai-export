import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "sae_session";
const OAUTH_STATE_COOKIE = "sae_oauth_state";

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function verify(value: string, signature: string, secret: string): boolean {
  const expected = sign(value, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSignedValue(value: string, secret: string): string {
  return `${Buffer.from(value).toString("base64url")}.${sign(value, secret)}`;
}

export function readSignedValue(payload: string | undefined, secret: string): string | null {
  if (!payload) return null;
  const [encoded, signature] = payload.split(".");
  if (!encoded || !signature) return null;
  const value = Buffer.from(encoded, "base64url").toString("utf8");
  return verify(value, signature, secret) ? value : null;
}

export async function currentAthleteId(secret: string | null): Promise<number | null> {
  if (!secret) return null;
  const jar = await cookies();
  const value = readSignedValue(jar.get(SESSION_COOKIE)?.value, secret);
  if (!value) return null;
  const athleteId = Number(value);
  return Number.isFinite(athleteId) ? athleteId : null;
}

export function setSessionCookie(response: NextResponse, athleteId: number, secret: string): void {
  response.cookies.set(SESSION_COOKIE, createSignedValue(String(athleteId), secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function createOAuthState(response: NextResponse, secret: string): string {
  const state = randomBytes(24).toString("base64url");
  response.cookies.set(OAUTH_STATE_COOKIE, createSignedValue(state, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return state;
}

export async function consumeOAuthState(response: NextResponse, state: string, secret: string): Promise<boolean> {
  const jar = await cookies();
  const saved = readSignedValue(jar.get(OAUTH_STATE_COOKIE)?.value, secret);
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return Boolean(saved && saved === state);
}
