-- Advent calendar schema.
--
-- All tables live in the private schema "advent", which is NOT exposed through
-- the Supabase Data API (only "public" and "graphql_public" are by default).
-- Only server-side code (Netlify Functions, local owner scripts) connects,
-- using the database connection string. Row Level Security is enabled with no
-- policies, and all privileges are revoked from the API roles, so even if the
-- schema were exposed by mistake, anon/authenticated could read nothing.
--
-- This migration is idempotent so that it is safe to re-run.

create schema if not exists advent;

revoke all on schema advent from public;

-- ---------------------------------------------------------------------------
-- Recipients: one row per gift recipient (normally exactly one).
-- ---------------------------------------------------------------------------
create table if not exists advent.recipients (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Calendars: one row per gift year. Never repurpose a row for another year;
-- create a new calendar id instead (e.g. advent-2027).
-- ---------------------------------------------------------------------------
create table if not exists advent.calendars (
  id              text primary key check (id ~ '^[a-z0-9-]{3,64}$'),
  recipient_id    uuid not null references advent.recipients (id) on delete restrict,
  year            integer not null check (year between 2024 and 2100),
  time_zone       text not null default 'Europe/Zurich' check (time_zone = 'Europe/Zurich'),
  opening_policy  text not null default 'STRICT_DATE' check (opening_policy in ('STRICT_DATE')),
  settings        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- A calendar's year can never change after creation.
create or replace function advent.forbid_calendar_year_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.year is distinct from old.year or new.recipient_id is distinct from old.recipient_id then
    raise exception 'calendar year and recipient are immutable; create a new calendar id instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists calendars_year_immutable on advent.calendars;
create trigger calendars_year_immutable
  before update on advent.calendars
  for each row execute function advent.forbid_calendar_year_change();

-- ---------------------------------------------------------------------------
-- Doors: content for each day. Content is validated before import.
-- ---------------------------------------------------------------------------
create table if not exists advent.doors (
  calendar_id   text not null references advent.calendars (id) on delete restrict,
  day           smallint not null check (day between 1 and 24),
  content       jsonb not null,
  content_hash  text not null,
  publishable   boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (calendar_id, day)
);

-- ---------------------------------------------------------------------------
-- Media: private objects in the storage bucket, owned by exactly one door.
-- The public-facing id is a random uuid; storage paths never leave the server.
-- ---------------------------------------------------------------------------
create table if not exists advent.media (
  id            uuid primary key default gen_random_uuid(),
  calendar_id   text not null,
  day           smallint not null,
  media_key     text not null check (media_key ~ '^[a-f0-9]{32}$'),
  storage_path  text not null,
  mime_type     text not null check (mime_type in (
                  'image/webp', 'image/jpeg', 'image/png',
                  'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav')),
  byte_size     integer not null check (byte_size > 0),
  width         integer check (width > 0),
  height        integer check (height > 0),
  source_hash   text not null,
  created_at    timestamptz not null default now(),
  unique (calendar_id, media_key),
  foreign key (calendar_id, day) references advent.doors (calendar_id, day) on delete restrict
);
create index if not exists media_door_idx on advent.media (calendar_id, day);

-- ---------------------------------------------------------------------------
-- Openings: the durable history of first openings.
-- ---------------------------------------------------------------------------
create table if not exists advent.openings (
  id            bigint generated always as identity primary key,
  recipient_id  uuid not null references advent.recipients (id) on delete restrict,
  calendar_id   text not null,
  day           smallint not null check (day between 1 and 24),
  opened_at     timestamptz not null,
  local_date    date not null,
  constraint openings_door_fk foreign key (calendar_id, day)
    references advent.doors (calendar_id, day) on delete restrict,
  -- One opening per door per recipient.
  constraint openings_one_per_door unique (recipient_id, calendar_id, day),
  -- At most one new door per recipient per calendar date.
  constraint openings_one_per_date unique (recipient_id, calendar_id, local_date),
  -- The local date must be derived from the absolute timestamp in Europe/Zurich.
  constraint openings_local_date_matches check (local_date = (opened_at at time zone 'Europe/Zurich')::date)
);

-- Openings are history: they may not be rewritten by the application.
create or replace function advent.forbid_opening_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'openings are immutable' using errcode = 'check_violation';
end;
$$;

drop trigger if exists openings_immutable on advent.openings;
create trigger openings_immutable
  before update on advent.openings
  for each row execute function advent.forbid_opening_update();

-- ---------------------------------------------------------------------------
-- Sessions: only SHA-256 hashes of opaque random tokens are stored.
-- ---------------------------------------------------------------------------
create table if not exists advent.sessions (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references advent.recipients (id) on delete cascade,
  token_hash    text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz
);
create index if not exists sessions_recipient_idx on advent.sessions (recipient_id);

-- ---------------------------------------------------------------------------
-- Failed login attempts for durable rate limiting (hashed client buckets).
-- ---------------------------------------------------------------------------
create table if not exists advent.login_failures (
  id            bigint generated always as identity primary key,
  bucket        text not null check (bucket ~ '^[a-z]+:[a-f0-9]{64}$' or bucket = 'global'),
  attempted_at  timestamptz not null default now()
);
create index if not exists login_failures_bucket_idx on advent.login_failures (bucket, attempted_at);

-- ---------------------------------------------------------------------------
-- Lock everything down: RLS on, no policies, no grants to API roles.
-- ---------------------------------------------------------------------------
alter table advent.recipients     enable row level security;
alter table advent.calendars      enable row level security;
alter table advent.doors          enable row level security;
alter table advent.media          enable row level security;
alter table advent.openings       enable row level security;
alter table advent.sessions       enable row level security;
alter table advent.login_failures enable row level security;

revoke all on all tables in schema advent from public;
revoke all on all sequences in schema advent from public;
revoke all on all functions in schema advent from public;
alter default privileges in schema advent revoke all on tables from public;
alter default privileges in schema advent revoke all on sequences from public;
alter default privileges in schema advent revoke all on functions from public;

do $$
declare
  api_role text;
begin
  foreach api_role in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = api_role) then
      execute format('revoke all on schema advent from %I', api_role);
      execute format('revoke all on all tables in schema advent from %I', api_role);
      execute format('revoke all on all sequences in schema advent from %I', api_role);
      execute format('revoke all on all functions in schema advent from %I', api_role);
      execute format('alter default privileges in schema advent revoke all on tables from %I', api_role);
      execute format('alter default privileges in schema advent revoke all on sequences from %I', api_role);
      execute format('alter default privileges in schema advent revoke all on functions from %I', api_role);
    end if;
  end loop;
end;
$$;
