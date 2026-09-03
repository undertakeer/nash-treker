-- =========================================================
--  Экономия места: превью к фото и счётчик занятого объёма
--  SQL Editor → New query → вставить → Run
-- =========================================================

-- Миниатюра для сетки галереи: полный снимок грузится только при открытии
alter table public.checkins add column if not exists thumb_url text;

-- Сколько занято в хранилище. Читает служебную таблицу storage.objects,
-- поэтому security definer — обычному пользователю она недоступна.
create or replace function public.storage_usage()
returns table (bucket text, bytes bigint, files bigint)
language sql
security definer
set search_path = storage, public
as $$
  select
    o.bucket_id::text,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint,
    count(*)::bigint
  from storage.objects o
  where o.bucket_id in ('avatars', 'moments')
  group by o.bucket_id
$$;

revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to authenticated;
