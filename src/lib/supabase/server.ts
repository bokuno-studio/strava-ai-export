import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/env";

let cached: unknown = null;

export function supabaseAdmin(): ReturnType<typeof createClient> {
  if (cached) return cached as ReturnType<typeof createClient>;
  const config = appConfig();
  cached = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: config.supabaseSchema,
    },
  });
  return cached as ReturnType<typeof createClient>;
}
