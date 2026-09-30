-- Melo 0002 — publish `messages` to Realtime.
--
-- The app subscribes to INSERT and UPDATE on this table so that translation
-- completion, delivered, and read all reach the other device live. Both
-- delivery directions are the same table, so one publication entry covers them.
--
-- RLS is still disabled (see 0001); adding the table to the publication does
-- not change that.

alter publication supabase_realtime add table public.messages;
