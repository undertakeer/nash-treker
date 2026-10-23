-- =========================================================
--  Копилки: уже накопленное — это не взнос и не деньги с кошелька
--  SQL Editor → New query → вставить → Run.
-- =========================================================

-- то, что лежало в копилке до начала учёта
alter table public.fin_goals
  add column if not exists opening numeric(12, 2) not null default 0 check (opening >= 0);

-- переносим уже записанные «Уже накоплено» из операций в это поле:
-- операцией они ошибочно считались взносом за период и резервом на кошельке
update public.fin_goals g
set opening = g.opening + coalesce((
  select sum(o.amount) from public.fin_ops o
  where o.goal_id = g.id and o.kind = 'save' and o.note = 'Уже накоплено'
), 0)
where exists (
  select 1 from public.fin_ops o
  where o.goal_id = g.id and o.kind = 'save' and o.note = 'Уже накоплено'
);

delete from public.fin_ops where kind = 'save' and note = 'Уже накоплено';
