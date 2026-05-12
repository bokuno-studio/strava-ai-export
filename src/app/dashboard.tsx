"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  Loader2,
  LogOut,
  Mail,
  Play,
  Trash2,
} from "lucide-react";
import { promptTemplate } from "@/lib/export/prompt";
import { jobStatusLabel } from "@/lib/store";
import type { Athlete, Job, JobKind } from "@/lib/types";

type Props = {
  athlete: Athlete;
  initialJobs: Job[];
};

const aiGuides = [
  {
    name: "ChatGPT",
    instruction: "Upload the ZIP directly, then paste the prompt.",
  },
  {
    name: "Claude",
    instruction: "Unzip the export and upload the CSV files, then paste the prompt.",
  },
  {
    name: "Gemini",
    instruction: "Unzip the export and upload the CSV files, then paste the prompt.",
  },
];

export default function Dashboard({ athlete, initialJobs }: Props) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState<JobKind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(athlete.notifications_enabled);
  const [notificationEmail, setNotificationEmail] = useState(athlete.notification_email ?? "");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const activeJobs = useMemo(
    () => jobs.filter((job) => ["pending", "queued", "running"].includes(job.status)),
    [jobs],
  );
  const latestReady = jobs.find((job) => job.status === "done" && job.download_path);

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const timer = window.setInterval(async () => {
      const refreshed = await Promise.all(activeJobs.map((job) => fetchJob(job.id)));
      setJobs((current) => mergeJobs(current, refreshed.filter(Boolean) as Job[]));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeJobs]);

  async function startJob(kind: JobKind) {
    setBusy(kind);
    setMessage(null);
    try {
      const response = await fetch("/api/jobs/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, days }),
      });
      const payload = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !payload.job) throw new Error(payload.error ?? "Could not start job");
      setJobs((current) => mergeJobs(current, [payload.job as Job]));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start job");
    } finally {
      setBusy(null);
    }
  }

  async function saveNotifications() {
    setMessage(null);
    const response = await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notificationsEnabled, notificationEmail }),
    });
    if (!response.ok) {
      setMessage("Could not save notification settings");
      return;
    }
    setMessage("Notification settings saved");
  }

  async function disconnect() {
    if (deleteText !== "DELETE") return;
    const response = await fetch("/api/account", { method: "DELETE" });
    if (response.ok) {
      window.location.href = "/?disconnected=1";
      return;
    }
    setMessage("Could not delete account data");
  }

  const displayName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ") || athlete.username || "Strava athlete";

  return (
    <main className="min-h-screen bg-[var(--page)] px-5 py-5 text-[var(--ink)] sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--brand)]">Connected to Strava</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Strava AI Export</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{displayName}</p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold"
            onClick={() => setDisconnectOpen(true)}
            type="button"
          >
            <LogOut aria-hidden="true" size={18} />
            Disconnect
          </button>
        </header>

        {message ? <p className="rounded-md border border-[var(--line)] bg-white px-4 py-3 text-sm">{message}</p> : null}

        <section className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-xl font-semibold">Start export</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Every export runs as a server job, so you can leave this screen and come back later.
            </p>

            <div className="mt-5 grid gap-3">
              <ActionButton busy={busy === "today"} icon={Activity} label="Today" onClick={() => startJob("today")} />

              <div className="grid gap-3 rounded-md border border-[var(--line)] p-3 sm:grid-cols-[1fr_auto]">
                <label className="text-sm font-semibold">
                  Past N days
                  <input
                    className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-base"
                    min={1}
                    max={3650}
                    onChange={(event) => setDays(Number(event.target.value))}
                    type="number"
                    value={days}
                  />
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md bg-[var(--ink)] px-4 text-sm font-semibold text-white"
                  disabled={busy === "past_n_days"}
                  onClick={() => startJob("past_n_days")}
                  type="button"
                >
                  {busy === "past_n_days" ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <Play aria-hidden="true" size={18} />}
                  Run
                </button>
              </div>

              <ActionButton busy={busy === "all"} icon={FileArchive} label="All history" onClick={() => startJob("all")} />
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Jobs</h2>
              {latestReady ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  href={`/api/download/${latestReady.id}`}
                >
                  <Download aria-hidden="true" size={18} />
                  Download latest
                </a>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {jobs.length === 0 ? (
                <p className="rounded-md bg-[var(--soft)] p-4 text-sm text-[var(--muted)]">No exports yet.</p>
              ) : (
                jobs.map((job) => <JobRow key={job.id} job={job} />)
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-xl font-semibold">Upload guide</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {aiGuides.map((guide) => (
                <div key={guide.name} className="rounded-md border border-[var(--line)] p-4">
                  <Bot aria-hidden="true" className="text-[var(--brand)]" size={22} />
                  <h3 className="mt-3 font-semibold">{guide.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{guide.instruction}</p>
                </div>
              ))}
            </div>
            <textarea
              className="mt-4 min-h-36 w-full rounded-md border border-[var(--line)] p-3 font-mono text-sm"
              readOnly
              value={promptTemplate}
            />
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-xl font-semibold">Notifications</h2>
            <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                checked={notificationsEnabled}
                className="h-5 w-5"
                onChange={(event) => setNotificationsEnabled(event.target.checked)}
                type="checkbox"
              />
              Email me when long exports finish
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Email
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-base"
                onChange={(event) => setNotificationEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={notificationEmail}
              />
            </label>
            <button
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] px-4 text-sm font-semibold"
              onClick={saveNotifications}
              type="button"
            >
              <Mail aria-hidden="true" size={18} />
              Save notifications
            </button>
          </div>
        </section>
      </div>

      {disconnectOpen ? (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/30 px-5">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <Trash2 aria-hidden="true" className="text-[#b42318]" size={28} />
            <h2 className="mt-4 text-xl font-semibold">Disconnect and delete data</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              This deletes encrypted tokens, activities, streams, jobs, and export ZIP files from this app.
              To remove the app from Strava, revoke access in Strava settings after deletion.
            </p>
            <label className="mt-4 block text-sm font-semibold">
              Type DELETE to confirm
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 text-base"
                onChange={(event) => setDeleteText(event.target.value)}
                value={deleteText}
              />
            </label>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-[var(--line)] px-4 font-semibold"
                onClick={() => setDisconnectOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-[#b42318] px-4 font-semibold text-white disabled:opacity-50"
                disabled={deleteText !== "DELETE"}
                onClick={disconnect}
                type="button"
              >
                Delete data
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ActionButton({
  busy,
  icon: Icon,
  label,
  onClick,
}: {
  busy: boolean;
  icon: React.ComponentType<{ "aria-hidden": true; size: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-60"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {busy ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : <Icon aria-hidden={true} size={18} />}
      {label}
    </button>
  );
}

function JobRow({ job }: { job: Job }) {
  const ready = job.status === "done" && job.download_path;
  return (
    <div className="rounded-md border border-[var(--line)] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold capitalize">{job.kind.replaceAll("_", " ")}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
            {job.status === "running" ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Clock aria-hidden="true" size={16} />}
            {jobStatusLabel(job.status)}
            {job.message ? `: ${job.message}` : ""}
          </p>
        </div>
        {ready ? (
          <a
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] px-4 text-sm font-semibold"
            href={`/api/download/${job.id}`}
          >
            <Download aria-hidden="true" size={18} />
            Download
          </a>
        ) : null}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--soft)]">
        <div className="h-full bg-[var(--brand)]" style={{ width: `${Math.max(0, Math.min(100, job.progress_percent))}%` }} />
      </div>
      {job.status === "queued" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Bell aria-hidden="true" size={16} />
          {job.rate_limited_until ? "Strava is busy, your job is queued." : "Queued for sync."}
        </p>
      ) : null}
      {job.status === "failed" && job.error ? <p className="mt-2 text-sm text-[#b42318]">{job.error}</p> : null}
      {job.status === "done" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--ok)]">
          <CheckCircle2 aria-hidden="true" size={16} />
          Ready until {job.export_expires_at ? new Date(job.export_expires_at).toLocaleString() : "expiry"}
        </p>
      ) : null}
    </div>
  );
}

async function fetchJob(jobId: string): Promise<Job | null> {
  const response = await fetch(`/api/jobs/${jobId}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as { job?: Job };
  return payload.job ?? null;
}

function mergeJobs(current: Job[], updates: Job[]): Job[] {
  const map = new Map(current.map((job) => [job.id, job]));
  for (const job of updates) map.set(job.id, job);
  return [...map.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
