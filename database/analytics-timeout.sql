-- Allow verified aggregate calculations to finish within the REST request budget.
alter function public.nafs_verified_analytics(text,text,text,text,text) set statement_timeout='60s';
notify pgrst, 'reload schema';
