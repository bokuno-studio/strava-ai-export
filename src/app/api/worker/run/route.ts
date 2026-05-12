import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/env";
import { runNextJobs } from "@/lib/jobs/worker";

export async function POST(request: NextRequest) {
  const config = appConfig();
  if (config.cronSecret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${config.cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const jobs = await runNextJobs();
  return NextResponse.json({ jobs });
}
