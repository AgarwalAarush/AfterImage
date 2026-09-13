create table if not exists public.afterimage_state (
 id integer primary key check (id = 1),
 version bigint not null default 0,
 data jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.afterimage_state enable row level security;
revoke all on public.afterimage_state from anon, authenticated;
grant all on public.afterimage_state to service_role;
comment on table public.afterimage_state is 'Owner-only AfterImage state; optimistic compare-and-swap updates. Service access only.';
