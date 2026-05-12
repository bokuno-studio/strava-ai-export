export type AppConfig = {
  siteUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseSchema: string;
  supabaseStorageBucket: string;
  sessionSecret: string;
  tokenEncryptionKey: string;
  stravaClientId: string;
  stravaClientSecret: string;
  stravaScopes: string;
  cronSecret: string | null;
  resendApiKey: string | null;
  notificationFrom: string;
};

export function optionalEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function siteUrl(): string {
  return (optionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/$/, "");
}

export function appConfig(): AppConfig {
  return {
    siteUrl: siteUrl(),
    supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseSchema: optionalEnv("SUPABASE_SCHEMA") ?? "strava_ai_export",
    supabaseStorageBucket: optionalEnv("SUPABASE_STORAGE_BUCKET") ?? "strava-ai-export",
    sessionSecret: requireEnv("SESSION_SECRET"),
    tokenEncryptionKey: requireEnv("TOKEN_ENCRYPTION_KEY"),
    stravaClientId: requireEnv("STRAVA_CLIENT_ID"),
    stravaClientSecret: requireEnv("STRAVA_CLIENT_SECRET"),
    stravaScopes: optionalEnv("STRAVA_SCOPES") ?? "read,activity:read_all,profile:read_all",
    cronSecret: optionalEnv("CRON_SECRET"),
    resendApiKey: optionalEnv("RESEND_API_KEY"),
    notificationFrom: optionalEnv("NOTIFICATION_FROM") ?? "Strava AI Export <no-reply@example.com>",
  };
}
