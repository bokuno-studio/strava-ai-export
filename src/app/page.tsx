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

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--page)] text-[var(--ink)]">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_0.92fr] lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-sm font-medium text-[var(--muted)]">
            <Cloud aria-hidden="true" size={16} />
            Strava to AI-ready CSV
          </p>

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
                <p className="text-sm font-semibold text-[var(--muted)]">Current job</p>
                <h2 className="mt-1 text-xl font-semibold">Today export</h2>
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
