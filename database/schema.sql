create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text
);

create table if not exists public.aliases (
  id uuid primary key default gen_random_uuid(),
  prefix text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint aliases_prefix_format check (
    prefix ~ '^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$'
    and position('..' in prefix) = 0
  )
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  alias_id uuid not null references public.aliases(id) on delete cascade,
  to_address text,
  from_address text,
  subject text,
  body_text text,
  body_html text,
  raw_headers jsonb,
  spam_verdict text,
  spam_score text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists to_address text;
alter table public.messages add column if not exists raw_headers jsonb;
alter table public.messages add column if not exists spam_verdict text;
alter table public.messages add column if not exists spam_score text;

alter table public.profiles enable row level security;
alter table public.aliases enable row level security;
alter table public.messages enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read their aliases"
  on public.aliases for select
  using (auth.uid() = user_id);

create policy "Users can claim aliases"
  on public.aliases for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their aliases"
  on public.aliases for delete
  using (auth.uid() = user_id);

create policy "Users can read messages for their aliases"
  on public.messages for select
  using (
    exists (
      select 1 from public.aliases
      where aliases.id = messages.alias_id
      and aliases.user_id = auth.uid()
    )
  );

create policy "Users can delete messages for their aliases"
  on public.messages for delete
  using (
    exists (
      select 1 from public.aliases
      where aliases.id = messages.alias_id
      and aliases.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create index if not exists aliases_user_id_idx on public.aliases(user_id);
create index if not exists messages_alias_id_received_at_idx on public.messages(alias_id, received_at desc);

create extension if not exists pg_cron with schema extensions;

select cron.unschedule('delete-old-alias-messages')
where exists (
  select 1 from cron.job where jobname = 'delete-old-alias-messages'
);

select cron.schedule(
  'delete-old-alias-messages',
  '15 3 * * *',
  $$delete from public.messages where received_at < now() - interval '5 days'$$
);
