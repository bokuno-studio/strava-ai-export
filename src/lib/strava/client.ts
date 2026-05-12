import type { JsonRecord } from "@/lib/types";

const STRAVA_API = "https://www.strava.com/api/v3";
const STRAVA_OAUTH = "https://www.strava.com/oauth/token";

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type TokenExchangeResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: JsonRecord;
};

export class StravaRateLimitError extends Error {
  retryAt: Date;

  constructor(message: string, retryAt: Date) {
    super(message);
    this.name = "StravaRateLimitError";
    this.retryAt = retryAt;
  }
}

export class StravaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "StravaApiError";
  }
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<TokenExchangeResponse> {
  const response = await fetch(STRAVA_OAUTH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token exchange failed: ${response.status}`);
  }

  return (await response.json()) as TokenExchangeResponse;
}

export async function refreshStravaToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokens> {
  const response = await fetch(STRAVA_OAUTH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
}

export class StravaClient {
  constructor(private accessToken: string) {}

  async athlete(): Promise<JsonRecord> {
    return this.request("/athlete");
  }

  async athleteStats(athleteId: number): Promise<JsonRecord> {
    return this.request(`/athletes/${athleteId}/stats`);
  }

  async athleteZones(): Promise<JsonRecord> {
    return this.request("/athlete/zones");
  }

  async activities(after?: number): Promise<JsonRecord[]> {
    const out: JsonRecord[] = [];
    for (let page = 1; page < 1000; page += 1) {
      const params = new URLSearchParams({ per_page: "200", page: String(page) });
      if (after) params.set("after", String(after));
      const batch = await this.request<JsonRecord[]>(`/athlete/activities?${params.toString()}`);
      out.push(...batch);
      if (batch.length < 200) break;
    }
    return out;
  }

  async activity(activityId: number): Promise<JsonRecord> {
    return this.request(`/activities/${activityId}?include_all_efforts=true`);
  }

  async activityLaps(activityId: number): Promise<JsonRecord[]> {
    return this.request(`/activities/${activityId}/laps`);
  }

  async activityZones(activityId: number): Promise<JsonRecord[]> {
    return this.request(`/activities/${activityId}/zones`);
  }

  async activityStreams(activityId: number): Promise<JsonRecord> {
    const keys = [
      "time",
      "distance",
      "latlng",
      "altitude",
      "velocity_smooth",
      "heartrate",
      "cadence",
      "watts",
      "temp",
      "moving",
      "grade_smooth",
    ].join(",");
    return this.request(`/activities/${activityId}/streams?keys=${keys}&key_by_type=true`);
  }

  async gear(gearId: string): Promise<JsonRecord> {
    return this.request(`/gear/${gearId}`);
  }

  private async request<T = JsonRecord>(path: string): Promise<T> {
    const response = await fetch(`${STRAVA_API}${path}`, {
      headers: {
        authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 429) {
      throw new StravaRateLimitError("Strava is busy, your job is queued", new Date(Date.now() + 15 * 60 * 1000));
    }

    this.throwIfRateLimited(response);

    if (!response.ok) {
      throw new StravaApiError(`Strava API failed: ${response.status} ${path}`, response.status, path);
    }

    return (await response.json()) as T;
  }

  private throwIfRateLimited(response: Response): void {
    const limit = response.headers.get("x-ratelimit-limit");
    const usage = response.headers.get("x-ratelimit-usage");
    if (!limit || !usage) return;

    const [shortLimit, dailyLimit] = limit.split(",").map(Number);
    const [shortUsage, dailyUsage] = usage.split(",").map(Number);
    const shortUsed = shortLimit ? shortUsage / shortLimit : 0;
    const dailyUsed = dailyLimit ? dailyUsage / dailyLimit : 0;
    if (shortUsed >= 0.9 || dailyUsed >= 0.9 || response.status === 429) {
      const retryAt = new Date(Date.now() + 15 * 60 * 1000);
      throw new StravaRateLimitError("Strava is busy, your job is queued", retryAt);
    }
  }
}
