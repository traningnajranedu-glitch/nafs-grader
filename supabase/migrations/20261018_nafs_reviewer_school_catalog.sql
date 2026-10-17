-- Reviewer can resolve schools for imported PDF without receiving unrelated student records.
create or replace function public.nafs_reviewer_school_catalog()
returns table(id uuid,name text,gender text,stage text,assigned boolean)
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from nafs_reviewers r where r.user_id=auth.uid() and r.active) then
   raise exception 'Reviewer access required';
 end if;
 return query select s.id,s.name::text,s.gender::text,s.stage::text,
 exists(select 1 from nafs_reviewer_schools a where a.reviewer_id=auth.uid() and a.school_id=s.id)
 from schools s order by s.name;
end $$;
revoke all on function public.nafs_reviewer_school_catalog() from public;
grant execute on function public.nafs_reviewer_school_catalog() to authenticated;
