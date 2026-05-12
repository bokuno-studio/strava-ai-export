import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { deleteAthleteCascade } from "@/lib/store";
import { isResponse, requireAuth } from "@/lib/http";

export async function DELETE() {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  await deleteAthleteCascade(auth.athleteId);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
