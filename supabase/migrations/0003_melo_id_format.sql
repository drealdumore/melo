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
