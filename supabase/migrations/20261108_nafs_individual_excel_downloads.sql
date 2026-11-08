-- Track successful Excel file generation from the individual school results page.
-- Service-role only; no student identifiers or answer data are stored.
create table if not exists public.nafs_individual_excel_downloads (
 id bigint generated always as identity primary key,
 downloaded_at timestamptz not null default now(),
 downloaded_by uuid not null references auth.users(id),
 stage text not null check (stage in ('primary3','primary6','middle3')),
 school_name text not null,
 gender text not null default '' check (gender in ('','بنين','بنات')),
 student_count integer not null default 0 check (student_count >= 0),
 file_name text not null,
 outcome text not null default 'generated' check (outcome in ('generated'))
);
create index if not exists nafs_individual_excel_downloads_date_idx
 on public.nafs_individual_excel_downloads (downloaded_at desc);
create index if not exists nafs_individual_excel_downloads_school_idx
 on public.nafs_individual_excel_downloads (stage, school_name);
alter table public.nafs_individual_excel_downloads enable row level security;
revoke all on public.nafs_individual_excel_downloads from anon, authenticated;
grant all on public.nafs_individual_excel_downloads to service_role;
