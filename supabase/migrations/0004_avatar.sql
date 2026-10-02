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
