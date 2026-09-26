-- =========================================================
--  Деньги: комиссия за снятие, разовые разделы, дата прихода
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- комиссия, удержанная при этом снятии
alter table public.fin_ops
  add column if not exists fee numeric(12, 2) not null default 0 check (fee >= 0);

-- у разовых трат (связь, подписка) дневной темп бессмыслен
alter table public.fin_envelopes
  add column if not exists show_pace boolean not null default true;

-- процент комиссии за снятие, свой у каждого
alter table public.profiles
  add column if not exists fin_fee_percent numeric(5, 2) not null default 1
  check (fin_fee_percent >= 0 and fin_fee_percent <= 100);
