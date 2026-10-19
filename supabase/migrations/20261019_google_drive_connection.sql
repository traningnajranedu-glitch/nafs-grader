-- Server-only OAuth refresh token storage; never expose to browser roles.
create table if not exists public.nafs_google_drive_connection (
  id integer primary key default 1 check (id = 1),
  refresh_token_ciphertext text not null,
  connected_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.nafs_google_drive_connection enable row level security;
revoke all on public.nafs_google_drive_connection from anon, authenticated;
-- Only Supabase service_role can read/write the encrypted token.
