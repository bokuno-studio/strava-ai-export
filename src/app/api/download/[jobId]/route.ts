import { NextResponse } from "next/server";
import { isResponse, requireAuth } from "@/lib/http";
import { downloadExportZip, getJobForAthlete, isDoneAndDownloadable } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const auth = await requireAuth();
  if (isResponse(auth)) return auth;
  const { jobId } = await context.params;
  const job = await getJobForAthlete(jobId, auth.athleteId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isDoneAndDownloadable(job) || !job.download_path) {
    return NextResponse.json({ error: "Download expired or not ready" }, { status: 410 });
  }

  const blob = await downloadExportZip(job.download_path);
  return new NextResponse(blob, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="strava-ai-export-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.zip"`,
    },
  });
}
