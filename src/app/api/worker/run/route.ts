import { NextRequest, NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { runNextJobs } from "@/lib/jobs/worker";

export async function POST(request: NextRequest) {
  const cronSecret = optionalEnv("CRON_SECRET");
  if (!cronSecret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET is required in production" }, { status: 500 });
  }

  if (cronSecret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const jobs = await runNextJobs();
  return NextResponse.json({ jobs });
}
