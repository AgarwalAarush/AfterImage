create table if not exists public.afterimage_documents (
  id uuid primary key,
  title text not null,
  filename text not null,
  kind text not null check (kind in ('markdown', 'pdf')),
  excerpt text not null,
  bytes integer not null,
  word_count integer,
  created_at timestamptz not null default now(),
  sha256 text not null unique,
  content text not null
);
alter table public.afterimage_documents enable row level security;
revoke all on public.afterimage_documents from anon, authenticated;
grant all on public.afterimage_documents to service_role;
comment on table public.afterimage_documents is 'Private owner-uploaded Markdown and PDF files. Content is base64; service role access only.';
