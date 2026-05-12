create schema if not exists strava_ai_export;
create extension if not exists pgcrypto with schema extensions;

create or replace function strava_ai_export.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists strava_ai_export.athletes (
  athlete_id bigint primary key,
  username text,
  firstname text,
  lastname text,
  profile jsonb not null default '{}'::jsonb,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz not null,
  notifications_enabled boolean not null default false,
  notification_email text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists strava_ai_export.activities (
  activity_id bigint primary key,
  athlete_id bigint not null references strava_ai_export.athletes(athlete_id) on delete cascade,
  name text,
  sport_type text,
  type text,
  started_at timestamptz,
  timezone text,
  distance_m numeric,
  moving_time_s integer,
  elapsed_time_s integer,
  total_elevation_gain_m numeric,
  avg_heartrate numeric,
  max_heartrate numeric,
  average_speed_mps numeric,
  max_speed_mps numeric,
  average_watts numeric,
  kilojoules numeric,
  gear_id text,
  summary jsonb not null default '{}'::jsonb,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_athlete_started_idx on strava_ai_export.activities(athlete_id, started_at desc);

create table if not exists strava_ai_export.laps (
  id bigserial primary key,
  athlete_id bigint not null references strava_ai_export.athletes(athlete_id) on delete cascade,
  activity_id bigint not null references strava_ai_export.activities(activity_id) on delete cascade,
  lap_index integer not null,
  started_at timestamptz,
  distance_m numeric,
  moving_time_s integer,
  elapsed_time_s integer,
  avg_heartrate numeric,
  max_heartrate numeric,
  average_speed_mps numeric,
  average_watts numeric,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id, lap_index)
);

create table if not exists strava_ai_export.zones (
  id bigserial primary key,
  athlete_id bigint not null references strava_ai_export.athletes(athlete_id) on delete cascade,
  activity_id bigint not null references strava_ai_export.activities(activity_id) on delete cascade,
  zone_type text not null,
  zone_index integer not null,
  min_value numeric,
  max_value numeric,
  seconds integer,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id, zone_type, zone_index)
);

create table if not exists strava_ai_export.gear (
  gear_id text primary key,
  athlete_id bigint not null references strava_ai_export.athletes(athlete_id) on delete cascade,
  name text,
  resource_state integer,
  distance_m numeric,
  primary_gear boolean,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists strava_ai_export.athlete_stats (
  athlete_id bigint primary key references strava_ai_export.athletes(athlete_id) on delete cascade,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists strava_ai_export.athlete_zones (
  athlete_id bigint primary key references strava_ai_export.athletes(athlete_id) on delete cascade,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists strava_ai_export.stream_objects (
  activity_id bigint primary key references strava_ai_export.activities(activity_id) on delete cascade,
  athlete_id bigint not null references strava_ai_export.athletes(athlete_id) on delete cascade,
  storage_path text not null,
  content_type text not null default 'application/json',
  byte_size integer,
  updated_at timestamptz not null default now()
);

create table if not exists strava_ai_export.jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id bigint not null references strava_ai_export.athletes(athlete_id) on delete cascade,
  kind text not null check (kind in ('today', 'past_n_days', 'all')),
  days integer,
  status text not null default 'pending' check (status in ('pending', 'queued', 'running', 'done', 'failed', 'cancelled')),
  progress_current integer not null default 0,
  progress_total integer not null default 0,
  progress_percent integer not null default 0,
  message text,
  error text,
  range_start timestamptz,
  range_end timestamptz,
  rate_limited_until timestamptz,
  download_path text,
  export_expires_at timestamptz,
  params jsonb not null default '{}'::jsonb,
  notification_sent_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_athlete_created_idx on strava_ai_export.jobs(athlete_id, created_at desc);
create index if not exists jobs_runnable_idx on strava_ai_export.jobs(status, rate_limited_until, created_at);

drop trigger if exists athletes_set_updated_at on strava_ai_export.athletes;
create trigger athletes_set_updated_at before update on strava_ai_export.athletes for each row execute function strava_ai_export.set_updated_at();
drop trigger if exists activities_set_updated_at on strava_ai_export.activities;
create trigger activities_set_updated_at before update on strava_ai_export.activities for each row execute function strava_ai_export.set_updated_at();
drop trigger if exists laps_set_updated_at on strava_ai_export.laps;
create trigger laps_set_updated_at before update on strava_ai_export.laps for each row execute function strava_ai_export.set_updated_at();
drop trigger if exists zones_set_updated_at on strava_ai_export.zones;
create trigger zones_set_updated_at before update on strava_ai_export.zones for each row execute function strava_ai_export.set_updated_at();
drop trigger if exists gear_set_updated_at on strava_ai_export.gear;
create trigger gear_set_updated_at before update on strava_ai_export.gear for each row execute function strava_ai_export.set_updated_at();
drop trigger if exists stream_objects_set_updated_at on strava_ai_export.stream_objects;
create trigger stream_objects_set_updated_at before update on strava_ai_export.stream_objects for each row execute function strava_ai_export.set_updated_at();
drop trigger if exists jobs_set_updated_at on strava_ai_export.jobs;
create trigger jobs_set_updated_at before update on strava_ai_export.jobs for each row execute function strava_ai_export.set_updated_at();

alter table strava_ai_export.athletes enable row level security;
alter table strava_ai_export.activities enable row level security;
alter table strava_ai_export.laps enable row level security;
alter table strava_ai_export.zones enable row level security;
alter table strava_ai_export.gear enable row level security;
alter table strava_ai_export.athlete_stats enable row level security;
alter table strava_ai_export.athlete_zones enable row level security;
alter table strava_ai_export.stream_objects enable row level security;
alter table strava_ai_export.jobs enable row level security;

revoke all on schema strava_ai_export from public, anon, authenticated;
grant usage on schema strava_ai_export to service_role;
grant all privileges on all tables in schema strava_ai_export to service_role;
grant all privileges on all sequences in schema strava_ai_export to service_role;
alter default privileges in schema strava_ai_export grant all privileges on tables to service_role;
alter default privileges in schema strava_ai_export grant all privileges on sequences to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('strava-ai-export', 'strava-ai-export', false, 524288000, array['application/json', 'application/zip', 'text/csv']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  existing text;
  next_schemas text;
begin
  select (regexp_matches(c::text, 'pgrst\.db_schemas=(.+)'))[1] into existing
  from pg_roles r, unnest(r.rolconfig) as c
  where r.rolname = 'authenticator'
    and r.rolconfig is not null
    and c::text like 'pgrst.db_schemas=%'
  limit 1;

  if existing is null or length(existing) = 0 then
    next_schemas := 'public,storage,graphql_public,strava_ai_export';
  elsif position('strava_ai_export' in existing) = 0 then
    next_schemas := existing || ',strava_ai_export';
  else
    next_schemas := existing;
  end if;

  execute format('alter role authenticator set pgrst.db_schemas = %L', next_schemas);
end $$;

notify pgrst, 'reload schema';
