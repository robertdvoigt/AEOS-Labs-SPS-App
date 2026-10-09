create index if not exists project_profiles_updated_by_idx
  on public.project_profiles(updated_by)
  where updated_by is not null;
