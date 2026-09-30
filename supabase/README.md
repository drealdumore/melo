# Supabase setup for Melo

Melo is a **private two-person chat for 3 trusted friends**. There is no auth:
the app generates a UUID on the device, and RLS is switched off so the anon key
can do everything. That is fine for a closed test and **not** safe for anything
public. The hardening path is written down in [Phase 10](#phase-10-before-going-beyond-friends).

## 1. Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a name (`melo`) and a region close to your testers.
3. Save the database password — you need it for the CLI link.
4. Wait for provisioning to finish.

## 2. Run the migrations

### Option A — SQL editor (fastest)

Open **SQL Editor → New query**, paste the whole of `combined-setup.sql`, and
run it. That file is `0001_init.sql` + `0002_realtime.sql` concatenated, and it
is safe to re-run.

The migrations are still the source of truth. If you would rather paste them
separately:

| Order | File |
|---|---|
| 1 | `migrations/0001_init.sql` |
| 2 | `migrations/0002_realtime.sql` |

> Skipping this step is what makes onboarding fail with
> `PGRST205: Could not find the table 'public.profiles' in the schema cache` —
> the anon key is valid, the tables simply do not exist yet.

### Option B — Supabase CLI

```sh
npm i -g supabase          # once
supabase login
supabase link --project-ref <your-project-ref>   # from Project Settings → API
supabase db push
```

`combined-setup.sql` guards the `alter publication supabase_realtime add table`
step with a `pg_publication_tables` check; the bare `0002_realtime.sql` does not,
so running `0002` twice raises a harmless duplicate-object error.

## 3. Confirm Realtime is on

`0002` adds `public.messages` to the `supabase_realtime` publication for you.
To check:

```sql
select pubname, tablename from pg_publication_tables
where pubname = 'supabase_realtime';
```

You should see `public.messages`. If you would rather do it by hand:
**Database → Replication → supabase_realtime → Add table → `public.messages`**.

## 4. Copy the keys

**Project Settings → API** (in the new dashboard: **Project Settings → API Keys**):

| Env var | Where to find it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the `anon` / `publishable` key |

Create your local `.env` (copy `.env.example`):

```sh
cp .env.example .env
```

Restart the dev server afterwards — `EXPO_PUBLIC_*` values are inlined at bundle
time, not read at runtime.

## 5. Verify it worked

1. `npm start`, open Melo on a device, and create a profile.
2. In the dashboard, open **Table Editor → profiles**. Your row should be there
   within a second, with an 11-character `melo_id` matching the `^[a-z2-9]{11}$`
   check.
3. Create a profile on a second device, then connect the two. A row appears in
   `rooms` whose `id` is `sorted(meloA, meloB).join('-')`.
4. Send a message. `messages` gains a row with `translation_status = 'pending'`,
   then flips to `translated` (or `failed`) a moment later.

## Phase 10 — before going beyond friends

Do all of this before the database is reachable by anyone but you:

1. Turn on Supabase **Anonymous Auth**.
2. On sign-in, rewrite `profiles.id` to `auth.uid()` (or make the profile row
   keyed by `auth.uid()` and keep the device UUID as a separate column).
3. Enable RLS on `profiles`, `rooms`, `messages` and write policies:
   - `profiles`: readable if it is you or a room partner.
   - `rooms`: readable if you are `user_one_id` or `user_two_id`.
   - `messages`: readable/writable only if a room you are in links you to
     `room_id`; `sender_id` must equal `auth.uid()` on insert.
4. Move `mark delivered` / `mark read` into `security definer` RPCs that verify
   the caller is the intended recipient, so those UPDATEs are not blanket-writable.
5. Re-enable Realtime only after RLS exists, and confirm the replication filters
   still respect it.
