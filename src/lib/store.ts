import { appConfig } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Athlete, ExportData, Job, JobKind, JobStatus, JsonRecord } from "@/lib/types";

type ActivityInput = {
  athleteId: number;
  summary: JsonRecord;
  detail?: JsonRecord;
};

type TokenInput = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AthleteInput = {
  athleteId: number;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  profile: JsonRecord;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: string;
};

function table(name: string) {
  // Supabase's generated types are intentionally not checked in yet; schema is runtime-configured.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin() as any;
  return client.schema(appConfig().supabaseSchema).from(name);
}

function storage() {
  return supabaseAdmin().storage.from(appConfig().supabaseStorageBucket);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function startedAt(activity: JsonRecord): string | null {
  return textValue(activity.start_date) ?? textValue(activity.start_date_local);
}

export async function upsertAthlete(input: AthleteInput): Promise<Athlete> {
  const { data, error } = await table("athletes")
    .upsert(
      {
        athlete_id: input.athleteId,
        username: input.username,
        firstname: input.firstname,
        lastname: input.lastname,
        profile: input.profile,
        encrypted_access_token: input.encryptedAccessToken,
        encrypted_refresh_token: input.encryptedRefreshToken,
        token_expires_at: input.tokenExpiresAt,
      },
      { onConflict: "athlete_id" },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Athlete;
}

export async function updateAthleteTokens(athleteId: number, tokens: TokenInput): Promise<void> {
  const { error } = await table("athletes")
    .update({
      encrypted_access_token: tokens.accessToken,
      encrypted_refresh_token: tokens.refreshToken,
      token_expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
    })
    .eq("athlete_id", athleteId);
  if (error) throw error;
}

export async function updateAthleteNotification(
  athleteId: number,
  notificationsEnabled: boolean,
  notificationEmail: string | null,
): Promise<Athlete> {
  const { data, error } = await table("athletes")
    .update({
      notifications_enabled: notificationsEnabled,
      notification_email: notificationEmail,
    })
    .eq("athlete_id", athleteId)
    .select()
    .single();
  if (error) throw error;
  return data as Athlete;
}

export async function getAthlete(athleteId: number): Promise<Athlete | null> {
  const { data, error } = await table("athletes")
    .select()
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (error) throw error;
  return (data as Athlete | null) ?? null;
}

export async function createJob(athleteId: number, kind: JobKind, days: number | null): Promise<Job> {
  const rangeEnd = new Date();
  let rangeStart: Date | null = null;

  if (kind === "today") {
    rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
  } else if (kind === "past_n_days" && days) {
    rangeStart = new Date(rangeEnd.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const { data, error } = await table("jobs")
    .insert({
      athlete_id: athleteId,
      kind,
      days,
      status: "pending",
      message: "Queued for sync",
      range_start: rangeStart?.toISOString() ?? null,
      range_end: rangeEnd.toISOString(),
      params: { days },
    })
    .select()
    .single();

  if (error) throw error;
  return data as Job;
}

export async function getJobForAthlete(jobId: string, athleteId: number): Promise<Job | null> {
  const { data, error } = await table("jobs")
    .select()
    .eq("id", jobId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (error) throw error;
  return (data as Job | null) ?? null;
}

export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await table("jobs").select().eq("id", jobId).maybeSingle();
  if (error) throw error;
  return (data as Job | null) ?? null;
}

export async function listJobsForAthlete(athleteId: number): Promise<Job[]> {
  const { data, error } = await table("jobs")
    .select()
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as Job[];
}

export async function listRunnableJobs(limit = 3): Promise<Job[]> {
  const staleRunningBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const runnable = await table("jobs")
    .select()
    .in("status", ["pending", "queued"])
    .or(`rate_limited_until.is.null,rate_limited_until.lt.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (runnable.error) throw runnable.error;

  const remaining = Math.max(0, limit - (runnable.data?.length ?? 0));
  if (remaining === 0) return (runnable.data ?? []) as Job[];

  const staleRunning = await table("jobs")
    .select()
    .eq("status", "running")
    .lt("updated_at", staleRunningBefore)
    .order("updated_at", { ascending: true })
    .limit(remaining);
  if (staleRunning.error) throw staleRunning.error;

  return [...((runnable.data ?? []) as Job[]), ...((staleRunning.data ?? []) as Job[])];
}

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<Job> {
  const { data, error } = await table("jobs").update(patch).eq("id", jobId).select().single();
  if (error) throw error;
  return data as Job;
}

export async function saveActivity(input: ActivityInput): Promise<void> {
  const summary = input.summary;
  const detail = input.detail ?? {};
  const activityId = numberValue(summary.id) ?? numberValue(detail.id);
  if (!activityId) return;

  const merged = { ...summary, ...detail };
  const { error } = await table("activities").upsert(
    {
      activity_id: activityId,
      athlete_id: input.athleteId,
      name: textValue(merged.name),
      sport_type: textValue(merged.sport_type),
      type: textValue(merged.type),
      started_at: startedAt(merged),
      timezone: textValue(merged.timezone),
      distance_m: numberValue(merged.distance),
      moving_time_s: numberValue(merged.moving_time),
      elapsed_time_s: numberValue(merged.elapsed_time),
      total_elevation_gain_m: numberValue(merged.total_elevation_gain),
      avg_heartrate: numberValue(merged.average_heartrate),
      max_heartrate: numberValue(merged.max_heartrate),
      average_speed_mps: numberValue(merged.average_speed),
      max_speed_mps: numberValue(merged.max_speed),
      average_watts: numberValue(merged.average_watts),
      kilojoules: numberValue(merged.kilojoules),
      gear_id: textValue(merged.gear_id),
      summary,
      detail,
    },
    { onConflict: "activity_id" },
  );
  if (error) throw error;
}

export async function saveLaps(athleteId: number, activityId: number, laps: JsonRecord[]): Promise<void> {
  if (laps.length === 0) return;
  const rows = laps.map((lap, index) => ({
    athlete_id: athleteId,
    activity_id: activityId,
    lap_index: index,
    started_at: startedAt(lap),
    distance_m: numberValue(lap.distance),
    moving_time_s: numberValue(lap.moving_time),
    elapsed_time_s: numberValue(lap.elapsed_time),
    avg_heartrate: numberValue(lap.average_heartrate),
    max_heartrate: numberValue(lap.max_heartrate),
    average_speed_mps: numberValue(lap.average_speed),
    average_watts: numberValue(lap.average_watts),
    raw: lap,
  }));
  const { error } = await table("laps").upsert(rows, { onConflict: "activity_id,lap_index" });
  if (error) throw error;
}

export async function saveZones(athleteId: number, activityId: number, zones: JsonRecord[]): Promise<void> {
  const rows = zones.flatMap((zoneGroup) => {
    const zoneType = textValue(zoneGroup.type) ?? textValue(zoneGroup.sensor_based) ?? "unknown";
    const distribution = Array.isArray(zoneGroup.distribution) ? zoneGroup.distribution : [];
    return distribution.map((zone, index) => {
      const record = asRecord(zone);
      return {
        athlete_id: athleteId,
        activity_id: activityId,
        zone_type: zoneType,
        zone_index: index,
        min_value: numberValue(record.min),
        max_value: numberValue(record.max),
        seconds: numberValue(record.time),
        raw: record,
      };
    });
  });
  if (rows.length === 0) return;
  const { error } = await table("zones").upsert(rows, { onConflict: "activity_id,zone_type,zone_index" });
  if (error) throw error;
}

export async function saveGear(athleteId: number, gear: JsonRecord): Promise<void> {
  const gearId = textValue(gear.id);
  if (!gearId) return;
  const { error } = await table("gear").upsert(
    {
      gear_id: gearId,
      athlete_id: athleteId,
      name: textValue(gear.name),
      resource_state: numberValue(gear.resource_state),
      distance_m: numberValue(gear.distance),
      primary_gear: typeof gear.primary === "boolean" ? gear.primary : null,
      raw: gear,
    },
    { onConflict: "gear_id" },
  );
  if (error) throw error;
}

export async function saveAthleteStats(athleteId: number, raw: JsonRecord): Promise<void> {
  const { error } = await table("athlete_stats").upsert({ athlete_id: athleteId, raw }, { onConflict: "athlete_id" });
  if (error) throw error;
}

export async function saveAthleteZones(athleteId: number, raw: JsonRecord): Promise<void> {
  const { error } = await table("athlete_zones").upsert({ athlete_id: athleteId, raw }, { onConflict: "athlete_id" });
  if (error) throw error;
}

export async function saveStreamObject(athleteId: number, activityId: number, streams: JsonRecord): Promise<void> {
  const body = JSON.stringify(streams);
  const path = `streams/${athleteId}/${activityId}.json`;
  const upload = await storage().upload(path, body, {
    contentType: "application/json",
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const { error } = await table("stream_objects").upsert(
    {
      activity_id: activityId,
      athlete_id: athleteId,
      storage_path: path,
      content_type: "application/json",
      byte_size: Buffer.byteLength(body),
    },
    { onConflict: "activity_id" },
  );
  if (error) throw error;
}

export async function uploadExportZip(athleteId: number, jobId: string, zip: Buffer): Promise<string> {
  const path = `exports/${athleteId}/${jobId}.zip`;
  const { error } = await storage().upload(path, zip, {
    contentType: "application/zip",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function createExportSignedUrl(path: string, downloadFilename: string): Promise<string> {
  const { data, error } = await storage().createSignedUrl(path, 60, { download: downloadFilename });
  if (error) throw error;
  return data.signedUrl;
}

async function downloadStream(path: string): Promise<JsonRecord> {
  const { data, error } = await storage().download(path);
  if (error) throw error;
  return JSON.parse(await data.text()) as JsonRecord;
}

export async function exportDataForJob(job: Job, athlete: Athlete): Promise<ExportData> {
  let activitiesQuery = table("activities").select().eq("athlete_id", athlete.athlete_id);
  if (job.range_start) activitiesQuery = activitiesQuery.gte("started_at", job.range_start);
  if (job.range_end && job.kind !== "all") activitiesQuery = activitiesQuery.lte("started_at", job.range_end);

  const activitiesResult = await activitiesQuery.order("started_at", { ascending: false });
  if (activitiesResult.error) throw activitiesResult.error;
  const activities = (activitiesResult.data ?? []) as JsonRecord[];
  const ids = activities.map((activity) => Number(activity.activity_id)).filter(Number.isFinite);

  const [laps, zones, gear, stats, athleteZones, streamRows] = await Promise.all([
    ids.length ? table("laps").select().eq("athlete_id", athlete.athlete_id).in("activity_id", ids) : { data: [], error: null },
    ids.length ? table("zones").select().eq("athlete_id", athlete.athlete_id).in("activity_id", ids) : { data: [], error: null },
    table("gear").select().eq("athlete_id", athlete.athlete_id),
    table("athlete_stats").select("raw").eq("athlete_id", athlete.athlete_id).maybeSingle(),
    table("athlete_zones").select("raw").eq("athlete_id", athlete.athlete_id).maybeSingle(),
    ids.length ? table("stream_objects").select().eq("athlete_id", athlete.athlete_id).in("activity_id", ids) : { data: [], error: null },
  ]);

  for (const result of [laps, zones, gear, stats, athleteZones, streamRows]) {
    if (result.error) throw result.error;
  }

  const streams = await Promise.all(
    ((streamRows.data ?? []) as JsonRecord[]).map(async (row) => ({
      activityId: Number(row.activity_id),
      data: await downloadStream(String(row.storage_path)),
    })),
  );

  return {
    athlete,
    job,
    activities,
    laps: (laps.data ?? []) as JsonRecord[],
    zones: (zones.data ?? []) as JsonRecord[],
    gear: (gear.data ?? []) as JsonRecord[],
    athleteStats: ((stats.data as { raw?: JsonRecord } | null)?.raw ?? null) as JsonRecord | null,
    athleteZones: ((athleteZones.data as { raw?: JsonRecord } | null)?.raw ?? null) as JsonRecord | null,
    streams,
  };
}

export async function deleteAthleteCascade(athleteId: number): Promise<void> {
  await removeStoragePrefix(`streams/${athleteId}`);
  await removeStoragePrefix(`exports/${athleteId}`);
  const { error } = await table("athletes").delete().eq("athlete_id", athleteId);
  if (error) throw error;
}

async function removeStoragePrefix(prefix: string): Promise<void> {
  const files: string[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const listed = await storage().list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (listed.error) throw listed.error;

    files.push(...listed.data.map((item) => `${prefix}/${item.name}`));
    if (listed.data.length < pageSize) break;
  }

  for (let index = 0; index < files.length; index += pageSize) {
    const removed = await storage().remove(files.slice(index, index + pageSize));
    if (removed.error) throw removed.error;
  }
}

export async function markAthleteSynced(athleteId: number): Promise<void> {
  const { error } = await table("athletes")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("athlete_id", athleteId);
  if (error) throw error;
}

export function isDoneAndDownloadable(job: Job): boolean {
  return (
    job.status === "done" &&
    Boolean(job.download_path) &&
    Boolean(job.export_expires_at) &&
    new Date(job.export_expires_at as string).getTime() > Date.now()
  );
}

export function jobStatusLabel(status: JobStatus): string {
  if (status === "queued") return "Queued";
  if (status === "running") return "Running";
  if (status === "done") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}
