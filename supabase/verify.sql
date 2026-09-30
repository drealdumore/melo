-- Run this after combined-setup.sql. Every row here should be present.
select 'profiles' as table, count(*) from public.profiles
union all select 'rooms', count(*) from public.rooms
union all select 'messages', count(*) from public.messages;

-- Should return exactly one row: public.messages in the supabase_realtime
-- publication. If it returns nothing, Realtime is off and live updates
-- (translation, delivered, read) will not reach the other device.
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'messages';
