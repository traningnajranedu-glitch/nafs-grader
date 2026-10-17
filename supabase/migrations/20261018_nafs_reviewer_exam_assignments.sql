-- Explicit answer-key assignment for reviewer accounts.
create table if not exists public.nafs_reviewer_exams (
 reviewer_id uuid not null references public.nafs_reviewers(user_id) on delete cascade,
 exam_id uuid not null references public.exams(id) on delete cascade,
 assigned_at timestamptz not null default now(),
 primary key (reviewer_id,exam_id)
);
alter table public.nafs_reviewer_exams enable row level security;
drop policy if exists "reviewer reads own exam assignments" on public.nafs_reviewer_exams;
create policy "reviewer reads own exam assignments" on public.nafs_reviewer_exams
for select to authenticated using (reviewer_id=auth.uid() or exists(select 1 from public.system_admins where user_id=auth.uid()));
-- Validate assignment on every saved scanned correction, not just in the UI.
create or replace function public.nafs_check_scanned_exam_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists (
   select 1 from public.nafs_reviewer_exams a
   join public.nafs_reviewers r on r.user_id=a.reviewer_id
   where a.reviewer_id=new.reviewer_id and a.exam_id=new.exam_id and r.active
 ) then raise exception 'لم يسند مدير النظام نموذج الإجابة هذا إلى المصحح'; end if;
 return new;
end $$;
drop trigger if exists nafs_scanned_exam_assignment_guard on public.nafs_scanned_corrections;
create trigger nafs_scanned_exam_assignment_guard
before insert on public.nafs_scanned_corrections
for each row execute function public.nafs_check_scanned_exam_assignment();
