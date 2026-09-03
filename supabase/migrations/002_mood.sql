-- =========================================================
--  Настроение в профиле
--  SQL Editor → New query → вставить → Run
-- =========================================================

alter table public.profiles add column if not exists mood      text;
alter table public.profiles add column if not exists mood_text text;
alter table public.profiles add column if not exists mood_at   timestamptz;
