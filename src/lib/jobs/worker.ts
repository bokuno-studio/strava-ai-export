import { appConfig } from "@/lib/env";
import { buildExportZip } from "@/lib/export/zip";
import { decryptText, encryptText } from "@/lib/crypto";
import { sendExportReadyEmail } from "@/lib/notifications";
import {
  exportDataForJob,
  getAthlete,
  getJob,
  listRunnableJobs,
  markAthleteSynced,
  saveActivity,
  saveAthleteStats,
  saveAthleteZones,
  saveGear,
  saveLaps,
  saveStreamObject,
  saveZones,
  updateAthleteTokens,
  updateJob,
  uploadExportZip,
} from "@/lib/store";
import { refreshStravaToken, StravaApiError, StravaClient, StravaRateLimitError } from "@/lib/strava/client";
import type { Athlete, Job, JsonRecord } from "@/lib/types";

const STALE_RUNNING_JOB_MS = 10 * 60 * 1000;

export async function runNextJobs(limit = 3): Promise<Job[]> {
  const jobs = await listRunnableJobs(limit);
  const results: Job[] = [];
  for (const job of jobs) {
    results.push(await processJob(job.id));
  }
  return results;
}

export async function processJob(jobId: string): Promise<Job> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  if (job.status === "running" && !isStaleRunningJob(job)) return job;
  if (!["pending", "queued", "running"].includes(job.status)) return job;

  const athlete = await getAthlete(job.athlete_id);
  if (!athlete) throw new Error(`Athlete not found: ${job.athlete_id}`);

  try {
    const config = appConfig();
    await updateJob(job.id, {
      status: "running",
      started_at: new Date().toISOString(),
      message: "Fetching Strava activities",
      error: null,
      rate_limited_until: null,
    });

    const client = await clientForAthlete(athlete, config);
    await saveAthleteStats(athlete.athlete_id, await client.athleteStats(athlete.athlete_id));
    await saveAthleteZones(athlete.athlete_id, await client.athleteZones());

    const after = job.range_start ? Math.floor(new Date(job.range_start).getTime() / 1000) : undefined;
    const activities = await client.activities(after);
    await updateJob(job.id, {
      progress_total: activities.length,
      progress_percent: activities.length === 0 ? 80 : 0,
      message: activities.length === 0 ? "No activities found, preparing export" : "Fetching activity details",
    });

    const seenGearIds = new Set<string>();
    for (const [index, summary] of activities.entries()) {
      const activityId = numberFrom(summary.id);
      if (!activityId) continue;

      const detail = await client.activity(activityId);
      await saveActivity({ athleteId: athlete.athlete_id, summary, detail });
      await saveLaps(athlete.athlete_id, activityId, await optionalStravaArray(() => client.activityLaps(activityId)));
      await saveZones(athlete.athlete_id, activityId, await optionalStravaArray(() => client.activityZones(activityId)));
      await saveStreamObject(athlete.athlete_id, activityId, await optionalStravaRecord(() => client.activityStreams(activityId)));

      const gearId = stringFrom(detail.gear_id) ?? stringFrom(summary.gear_id);
      if (gearId && !seenGearIds.has(gearId)) {
        seenGearIds.add(gearId);
        const gear = await optionalStravaRecord(() => client.gear(gearId));
        if (Object.keys(gear).length > 0) {
          await saveGear(athlete.athlete_id, gear);
        }
      }

      await updateJob(job.id, {
        progress_current: index + 1,
        progress_percent: Math.round(((index + 1) / Math.max(activities.length, 1)) * 80),
        message: `Fetched ${index + 1} / ${activities.length} activities`,
      });
    }

    await markAthleteSynced(athlete.athlete_id);
    await updateJob(job.id, { message: "Building CSV ZIP", progress_percent: 90 });

    const freshJob = await getJob(job.id);
    const freshAthlete = await getAthlete(athlete.athlete_id);
    if (!freshJob || !freshAthlete) throw new Error("Job or athlete disappeared before export");

    const zip = await buildExportZip(await exportDataForJob(freshJob, freshAthlete));
    const path = await uploadExportZip(athlete.athlete_id, job.id, zip);
    const done = await updateJob(job.id, {
      status: "done",
      progress_percent: 100,
      message: "Export ready",
      download_path: path,
      export_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      finished_at: new Date().toISOString(),
    });

    try {
      if (shouldSendCompletionEmail(done) && (await sendExportReadyEmail(freshAthlete, done))) {
        await updateJob(job.id, { notification_sent_at: new Date().toISOString() });
      }
    } catch (error) {
      await updateJob(job.id, {
        message: `Export ready; notification failed: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }

    return (await getJob(job.id)) ?? done;
  } catch (error) {
    if (error instanceof StravaRateLimitError) {
      return updateJob(job.id, {
        status: "queued",
        message: error.message,
        rate_limited_until: error.retryAt.toISOString(),
      });
    }

    return updateJob(job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Sync failed",
      finished_at: new Date().toISOString(),
    });
  }
}

async function clientForAthlete(athlete: Athlete, config: ReturnType<typeof appConfig>): Promise<StravaClient> {
  const accessToken = decryptText(athlete.encrypted_access_token, config.tokenEncryptionKey);
  const refreshToken = decryptText(athlete.encrypted_refresh_token, config.tokenEncryptionKey);
  const expiresAt = new Date(athlete.token_expires_at).getTime();

  if (expiresAt > Date.now() + 60 * 1000) {
    return new StravaClient(accessToken);
  }

  const refreshed = await refreshStravaToken(config.stravaClientId, config.stravaClientSecret, refreshToken);
  await updateAthleteTokens(athlete.athlete_id, {
    accessToken: encryptText(refreshed.accessToken, config.tokenEncryptionKey),
    refreshToken: encryptText(refreshed.refreshToken, config.tokenEncryptionKey),
    expiresAt: refreshed.expiresAt,
  });
  return new StravaClient(refreshed.accessToken);
}

function numberFrom(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFrom(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function shouldSendCompletionEmail(job: Job): boolean {
  if (job.kind === "all") return true;

  const startedAt = Date.parse(job.started_at ?? "");
  const finishedAt = Date.parse(job.finished_at ?? "");
  return Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt - startedAt >= 30_000;
}

async function optionalStravaArray(load: () => Promise<JsonRecord[]>): Promise<JsonRecord[]> {
  try {
    return await load();
  } catch (error) {
    if (isUnavailableOptionalStravaData(error)) return [];
    throw error;
  }
}

async function optionalStravaRecord(load: () => Promise<JsonRecord>): Promise<JsonRecord> {
  try {
    return await load();
  } catch (error) {
    if (isUnavailableOptionalStravaData(error)) return {};
    throw error;
  }
}

function isUnavailableOptionalStravaData(error: unknown): boolean {
  return error instanceof StravaApiError && [403, 404].includes(error.status);
}

function isStaleRunningJob(job: Job): boolean {
  const updatedAt = Date.parse(job.updated_at);
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt >= STALE_RUNNING_JOB_MS;
}
