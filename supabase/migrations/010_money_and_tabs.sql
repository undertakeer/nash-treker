-- =========================================================
--  Деньги: кошелёк, конверты, операции. И выбор вкладок.
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- какие вкладки показывать этому человеку (null = набор по умолчанию)
alter table public.profiles add column if not exists tabs text[];
-- валюта раздела «Деньги»
alter table public.profiles add column if not exists fin_currency text not null default '$';

-- конверт: сколько из прихода отводится на это направление
create table if not exists public.fin_envelopes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  emoji      text not null default '💵',
  color      text not null default 'mint',
  mode       text not null default 'fixed' check (mode in ('fixed', 'percent')),
  plan       numeric(12, 2) not null default 0 check (plan >= 0),
  carry      boolean not null default false,   -- переносить остаток на след. месяц
  note       text,
  position   int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists fin_envelopes_owner_idx on public.fin_envelopes (owner_id, archived, position);

-- операция: приход на кошелёк или трата из конверта
create table if not exists public.fin_ops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  envelope_id uuid references public.fin_envelopes(id) on delete set null,
  kind        text not null check (kind in ('income', 'expense')),
  amount      numeric(12, 2) not null check (amount > 0),
  note        text,
  day         date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists fin_ops_owner_day_idx on public.fin_ops (owner_id, day desc);

alter table public.fin_envelopes enable row level security;
alter table public.fin_ops       enable row level security;

-- деньги личные: видит и правит только владелец
drop policy if exists "fin_envelopes own" on public.fin_envelopes;
create policy "fin_envelopes own" on public.fin_envelopes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "fin_ops own" on public.fin_ops;
create policy "fin_ops own" on public.fin_ops for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.fin_envelopes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.fin_ops;       exception when duplicate_object then null; end;
end $$;
