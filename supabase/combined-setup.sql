-- Melo 0001 — initial schema.
--
-- ⚠️ ROW LEVEL SECURITY IS DISABLED ON EVERY TABLE IN THIS MIGRATION.
-- The anon key is currently enough to read and write any row, so anyone who
-- gets hold of it can read every conversation. That is a deliberate MVP
-- trade-off for 3 trusted friends on a private database.
-- See Phase 10 / supabase/README.md for the hardening steps (Supabase
-- Anonymous Auth, `profiles.id = auth.uid()`, RLS policies, RPCs for
-- mark-delivered/read) that must land before this goes anywhere public.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------ profiles
create table if not exists public.profiles (
  id               uuid primary key,
  melo_id          text unique not null,
  display_name     text not null check (char_length(display_name) between 1 and 30),
  reading_language text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint profiles_melo_id_format check (melo_id ~ '^[a-z2-9]{11}$')
);

-- The 11-char Melo ID is looked up on every connect, and the CHECK above means
-- the unique constraint alone cannot help the planner.
create index if not exists profiles_melo_id_idx on public.profiles (melo_id);

-- --------------------------------------------------------------------- rooms
create table if not exists public.rooms (
  id           text primary key,
  user_one_id  uuid references public.profiles (id) on delete cascade,
  user_two_id  uuid references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint rooms_distinct_users check (user_one_id <> user_two_id),
  -- A pair of people can only ever have one room. The client always writes the
  -- two UUIDs in sorted order, so (A,B) and (B,A) collide here on purpose.
  constraint rooms_unique_pair unique (user_one_id, user_two_id)
);

create index if not exists rooms_user_one_idx on public.rooms (user_one_id);
create index if not exists rooms_user_two_idx on public.rooms (user_two_id);

-- ------------------------------------------------------------------ messages
create table if not exists public.messages (
  id                 uuid primary key,
  room_id            text references public.rooms (id) on delete cascade,
  sender_id          uuid references public.profiles (id) on delete cascade,
  original_text      text not null check (char_length(original_text) between 1 and 4000),
  translated_text    text,
  source_language    text not null,
  target_language    text not null,
  translation_status text not null default 'pending'
                       check (translation_status in ('pending', 'translated', 'failed', 'skipped')),
  created_at         timestamptz not null default now(),
  delivered_at       timestamptz,
  read_at            timestamptz
);

-- Chat history loads newest-first; this is the index that serves it.
create index if not exists messages_room_created_idx
  on public.messages (room_id, created_at desc);

-- Unread counts only ever touch rows where read_at is null, so the partial
-- index stays tiny no matter how much history accumulates.
create index if not exists messages_room_unread_idx
  on public.messages (room_id)
  where read_at is null;

-- ------------------------------------------------------- updated_at triggers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();
-- Melo 0002 — publish `messages` to Realtime.
--
-- The app subscribes to INSERT and UPDATE on this table so that translation
-- completion, delivered, and read all reach the other device live. Both
-- delivery directions are the same table, so one publication entry covers them.
--
-- RLS is still disabled (see 0001); adding the table to the publication does
-- not change that.
--
-- Wrapped in a guard so this whole file stays safe to re-run: a bare
-- `alter publication ... add table` raises a duplicate_object error if the
-- table is already a member, which would abort the rest of a batch run.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
-- Melo 0003 — name-derived Melo IDs.
--
-- A Melo ID is now `<slug of the display name><5 random chars>`, e.g. "Becool"
-- → `becool7f3k`, instead of 11 purely random characters. The suffix is what
-- keeps two people called Alex apart; the name half is what makes an ID
-- recognisable and sayable.
--
-- The range widened from exactly 11 to 6–11 because the name half is 1–6
-- characters depending on how long the name is.
--
-- This is safe to apply to existing data: every ID drawn under the old format is
-- exactly 11 characters of a–z2–9, which satisfies the new pattern. No row needs
-- rewriting, and nobody has to change the ID already on their card.

alter table public.profiles
  drop constraint if exists profiles_melo_id_format;

alter table public.profiles
  add constraint profiles_melo_id_format check (melo_id ~ '^[a-z0-9]{6,11}$');

-- The comment in 0001 said the CHECK existed so the planner could use the unique
-- index. Still true, and now more so: a 6-character prefix is a far more
-- selective probe than one fixed length, so `connect` looks up a value that is
-- either exactly the indexed row or not present at all.

-- Melo 0004 — chosen avatar.
--
-- `avatar_key` holds a slug, never a filename or a URL: the images are bundled,
-- so the value indexes the static require map in `src/constants/avatars.ts`.
-- Metro cannot resolve a runtime-built asset path, so a path here would work in
-- dev and ship as a blank image.
--
-- Nullable, with no default, on purpose. `null` means "never picked one" and
-- renders the initials avatar, which is what every existing profile already
-- looks like. That makes this migration a no-op for current data: no backfill,
-- no rewrite, and removing the feature later is dropping a column.
--
-- No CHECK against the slug list. The list lives in the client and can gain a
-- character with an asset drop; a constraint here would reject a key the app
-- happily offers.

alter table public.profiles add column if not exists avatar_key text null;

comment on column public.profiles.avatar_key is
  'Slug from src/constants/avatars.ts. Null renders initials.';
