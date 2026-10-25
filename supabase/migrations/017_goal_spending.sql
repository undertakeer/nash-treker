-- =========================================================
--  Копилки: из них можно не только копить, но и тратить
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- пятый вид операции: трата из копилки. Сумма уходит из накопленного,
-- а кошелёк трогается только если деньги лежали на нём (off_wallet = false).
alter table public.fin_ops drop constraint if exists fin_ops_kind_check;
alter table public.fin_ops
  add constraint fin_ops_kind_check
  check (kind in ('income', 'expense', 'adjust', 'save', 'unsave'));
