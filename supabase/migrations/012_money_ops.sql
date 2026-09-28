-- =========================================================
--  Деньги: траты не с кошелька, правка баланса, выборочная комиссия
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- трата записана, но с кошелька ничего не снималось (дали наличкой и т.п.)
alter table public.fin_ops
  add column if not exists off_wallet boolean not null default false;

-- появился третий вид операции: правка баланса, у неё сумма со знаком
alter table public.fin_ops drop constraint if exists fin_ops_kind_check;
alter table public.fin_ops
  add constraint fin_ops_kind_check check (kind in ('income', 'expense', 'adjust'));

alter table public.fin_ops drop constraint if exists fin_ops_amount_check;
alter table public.fin_ops
  add constraint fin_ops_amount_check check (amount <> 0);
