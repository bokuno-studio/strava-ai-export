import { NextResponse } from "next/server";
import { isResponse, requireAuth } from "@/lib/http";
import { createExportSignedUrl, getJobForAthlete, isDoneAndDownloadable } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  const { jobId } = await context.params;
  const job = await getJobForAthlete(jobId, auth.athleteId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isDoneAndDownloadable(job) || !job.download_path) {
    return NextResponse.json({ error: "Download expired or not ready" }, { status: 410 });
  }

  const filename = `strava-ai-export-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.zip`;
  const signedUrl = await createExportSignedUrl(job.download_path, filename);
  return NextResponse.redirect(signedUrl, 302);
}
