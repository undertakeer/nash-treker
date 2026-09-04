-- =========================================================
--  Задачи: общий список дел на двоих
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  emoji       text not null default '📌',
  color       text not null default 'sky',
  note        text,
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     uuid references public.profiles(id) on delete set null,
  due_date    date,
  due_time    time,
  assignee_id uuid references public.profiles(id) on delete set null,  -- null = общая
  priority    int  not null default 0 check (priority in (0, 1)),
  position    int  not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_open_idx on public.tasks (done, due_date, position);

alter table public.tasks enable row level security;

-- список общий: видят и правят оба
drop policy if exists "tasks read"   on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks write"  on public.tasks;
create policy "tasks read"   on public.tasks for select to authenticated using (true);
create policy "tasks insert" on public.tasks for insert to authenticated
  with check (created_by = auth.uid());
create policy "tasks write"  on public.tasks for all to authenticated
  using (true) with check (true);

-- напоминания о задачах
alter table public.notification_prefs
  add column if not exists task_reminders boolean not null default true;

do $$
begin
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
end $$;
