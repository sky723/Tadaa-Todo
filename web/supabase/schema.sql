-- Run in the Supabase SQL editor. Every row is owned by a user and protected by RLS.
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  priority    smallint not null default 0 check (priority between 0 and 3),
  due         date,
  time        text,
  rec         text check (rec in ('daily','weekdays','weekly','monthly','yearly')),
  tags        text[] not null default '{}',
  remind      integer,
  parent      uuid references public.tasks(id) on delete cascade,
  done_on     date,
  created_at  timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks(user_id, done, due);

create table if not exists public.days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day     date not null,
  n       integer not null default 0,
  primary key (user_id, day)
);

alter table public.tasks enable row level security;
alter table public.days  enable row level security;

create policy "own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own days"  on public.days  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.tasks;
