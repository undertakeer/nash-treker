-- =========================================================
--  Деньги: разделы без лимита, цели-накопления, запас по сроку зарплаты
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- третий вид раздела: без лимита, только учёт (здоровье, разовые нужды)
alter table public.fin_envelopes drop constraint if exists fin_envelopes_mode_check;
alter table public.fin_envelopes
  add constraint fin_envelopes_mode_check check (mode in ('fixed', 'percent', 'free'));

-- цель-накопление: в отличие от раздела не обнуляется с новой зарплатой
create table if not exists public.fin_goals (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  emoji      text not null default '🎯',
  color      text not null default 'violet',
  target     numeric(12, 2) check (target is null or target >= 0),
  per_income numeric(12, 2) not null default 0 check (per_income >= 0),
  note       text,
  position   int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists fin_goals_owner_idx on public.fin_goals (owner_id, archived, position);

alter table public.fin_goals enable row level security;
drop policy if exists "fin_goals own" on public.fin_goals;
create policy "fin_goals own" on public.fin_goals for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- операция откладывания: деньги остаются на кошельке, но помечены под цель
alter table public.fin_ops
  add column if not exists goal_id uuid references public.fin_goals(id) on delete set null;

alter table public.fin_ops drop constraint if exists fin_ops_kind_check;
alter table public.fin_ops
  add constraint fin_ops_kind_check check (kind in ('income', 'expense', 'adjust', 'save'));

do $$
begin
  begin alter publication supabase_realtime add table public.fin_goals; exception when duplicate_object then null; end;
end $$;
