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
