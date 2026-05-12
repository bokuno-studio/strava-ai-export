import { NextResponse } from "next/server";
import { isResponse, requireAuth } from "@/lib/http";
import { getJobForAthlete } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  const { jobId } = await context.params;
  const job = await getJobForAthlete(jobId, auth.athleteId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}
