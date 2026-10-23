-- =========================================================
--  Копилки: взнос можно задавать долей от прихода
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

alter table public.fin_goals
  add column if not exists per_mode text not null default 'fixed'
  check (per_mode in ('fixed', 'percent'));
