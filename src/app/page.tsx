import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Cloud,
  Database,
  FileArchive,
  LockKeyhole,
  Smartphone,
} from "lucide-react";
import Dashboard from "@/app/dashboard";
import { optionalEnv } from "@/lib/env";
import { currentAthleteId } from "@/lib/session";
import { getAthlete, listJobsForAthlete } from "@/lib/store";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Connect Strava",
    detail: "Authorize once, then export on demand.",
    icon: Activity,
  },
  {
    title: "Choose a range",
    detail: "Today, recent days, or your full history.",
    icon: Database,
  },
  {
    title: "Download CSV",
    detail: "A ZIP bundle ready for your AI workspace.",
    icon: FileArchive,
  },
];

const exportFiles = [
  "activities.csv",
  "laps.csv",
  "zones.csv",
  "streams/*.csv",
  "gear.csv",
  "prompt_template.txt",
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const athleteId = await currentAthleteId(optionalEnv("SESSION_SECRET"));

  if (athleteId) {
    let authError: string | null = null;
    let athlete = null;
    let jobs = null;
    try {
      athlete = await getAthlete(athleteId);
      jobs = athlete ? await listJobsForAthlete(athleteId) : null;
    } catch (error) {
      authError = error instanceof Error ? error.message : "Configuration error";
    }

    if (athlete && jobs) return <Dashboard athlete={athlete} initialJobs={jobs} />;
    if (authError) return <Landing authError={authError} />;
  }

  return (
    <Landing
      authError={typeof params.auth_error === "string" ? params.auth_error : undefined}
      disconnected={params.disconnected === "1"}
      cancelled={params.auth === "cancelled"}
    />
  );
}

function Landing({
  authError,
  disconnected,
  cancelled,
}: {
  authError?: string;
  disconnected?: boolean;
  cancelled?: boolean;
}) {
  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm font-medium text-[var(--muted)]">
            <Cloud aria-hidden="true" size={16} />
            Strava to AI-ready CSV
          </p>

          {authError ? <Notice tone="error" text={`Connection failed: ${authError}`} /> : null}
          {cancelled ? <Notice tone="warn" text="Connection cancelled. You can retry when ready." /> : null}
          {disconnected ? <Notice tone="ok" text="Your Strava connection and stored data were deleted." /> : null}

          <h1 className="text-5xl font-semibold leading-[1.02] tracking-normal text-balance sm:text-6xl">
            Strava AI Export
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Connect Strava, fetch the activities you choose, and download a CSV bundle that ChatGPT,
            Claude, and Gemini can read for training analysis.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--brand-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
              href="/api/auth/start"
            >
              <Activity aria-hidden="true" size={20} />
              Connect with Strava
              <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-5 py-3 text-base font-semibold text-[var(--ink)] transition hover:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2"
              href="#export-preview"
            >
              <FileArchive aria-hidden="true" size={20} />
              Preview export
            </a>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;

              return (
                <div key={step.title} className="border-l-2 border-[var(--brand)] pl-4">
                  <Icon aria-hidden="true" className="mb-3 text-[var(--brand)]" size={22} />
                  <h2 className="text-sm font-semibold uppercase tracking-normal text-[var(--ink)]">
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{step.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div
          id="export-preview"
          className="w-full rounded-lg border border-[var(--line)] bg-white shadow-[0_24px_80px_rgba(20,32,50,0.12)]"
        >
          <div className="border-b border-[var(--line)] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">Sample preview</p>
                <h2 className="mt-1 text-xl font-semibold">Today export</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Sign in to see your own export.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ok-bg)] px-3 py-1 text-sm font-semibold text-[var(--ok)]">
                <CheckCircle2 aria-hidden="true" size={16} />
                Ready
              </span>
            </div>
          </div>

          <div className="grid gap-0 sm:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-[var(--line)] p-5 sm:border-b-0 sm:border-r">
              <p className="text-sm font-semibold text-[var(--muted)]">Export bundle</p>
              <ul className="mt-4 space-y-3">
                {exportFiles.map((file) => (
                  <li key={file} className="flex items-center gap-3 text-sm">
                    <span className="h-2 w-2 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                    <span className="font-mono text-[13px]">{file}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">Ready for analysis</p>
              <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                <Feature icon={Smartphone} label="Run the export from your phone after a workout" />
                <Feature icon={LockKeyhole} label="Keep credentials and activity data server-side" />
                <Feature icon={Bot} label="Open the included prompt with your AI workspace" />
              </div>

              <div className="mt-6 border-l-2 border-[var(--brand)] pl-4">
                <p className="text-sm font-semibold text-[var(--ink)]">Download window</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Completed exports are prepared as temporary ZIP files for the signed-in athlete.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Notice({ tone, text }: { tone: "ok" | "warn" | "error"; text: string }) {
  const className =
    tone === "ok"
      ? "border-[var(--ok)] bg-[var(--ok-bg)] text-[var(--ok)]"
      : tone === "warn"
        ? "border-[#b87b00] bg-[#fff7db] text-[#6f4c00]"
        : "border-[#b42318] bg-[#fff1f0] text-[#8f1f17]";
  return <p className={`mb-5 rounded-md border px-4 py-3 text-sm font-medium ${className}`}>{text}</p>;
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ "aria-hidden": true; size: number }>;
  label: string;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 py-3 text-sm">
      <Icon aria-hidden={true} size={18} />
      <span>{label}</span>
    </div>
  );
}
