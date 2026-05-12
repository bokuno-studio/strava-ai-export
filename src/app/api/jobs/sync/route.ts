import { after, NextRequest, NextResponse } from "next/server";
import { isResponse, jsonError, requireAuth } from "@/lib/http";
import { createJob } from "@/lib/store";
import { processJob } from "@/lib/jobs/worker";
import type { JobKind } from "@/lib/types";

const kinds: JobKind[] = ["today", "past_n_days", "all"];

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as { kind?: string; days?: number };
  if (!body.kind || !kinds.includes(body.kind as JobKind)) {
    return jsonError("Invalid job kind", 400);
  }

  const kind = body.kind as JobKind;
  const days = kind === "past_n_days" ? Math.max(1, Math.min(3650, Number(body.days) || 7)) : null;
  const job = await createJob(auth.athleteId, kind, days);
  after(async () => {
    await processJob(job.id);
  });
  return NextResponse.json({ job }, { status: 202 });
}
