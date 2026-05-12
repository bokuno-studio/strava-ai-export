import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireAuth } from "@/lib/http";
import { updateAthleteNotification } from "@/lib/store";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    notificationsEnabled?: boolean;
    notificationEmail?: string;
  };
  const email = body.notificationEmail?.trim() || null;
  const athlete = await updateAthleteNotification(auth.athleteId, Boolean(body.notificationsEnabled), email);
  return NextResponse.json({ athlete });
}
