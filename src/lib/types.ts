export type JsonRecord = Record<string, unknown>;

export type JobKind = "today" | "past_n_days" | "all";
export type JobStatus = "pending" | "queued" | "running" | "done" | "failed" | "cancelled";

export type Athlete = {
  athlete_id: number;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  profile: JsonRecord;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  token_expires_at: string;
  notifications_enabled: boolean;
  notification_email: string | null;
  last_synced_at: string | null;
};

export type Job = {
  id: string;
  athlete_id: number;
  kind: JobKind;
  days: number | null;
  status: JobStatus;
  progress_current: number;
  progress_total: number;
  progress_percent: number;
  message: string | null;
  error: string | null;
  range_start: string | null;
  range_end: string | null;
  rate_limited_until: string | null;
  download_path: string | null;
  export_expires_at: string | null;
  params: JsonRecord;
  notification_sent_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExportData = {
  athlete: Athlete;
  job: Job;
  activities: JsonRecord[];
  laps: JsonRecord[];
  zones: JsonRecord[];
  gear: JsonRecord[];
  athleteStats: JsonRecord | null;
  athleteZones: JsonRecord | null;
  streams: Array<{ activityId: number; data: JsonRecord }>;
};
