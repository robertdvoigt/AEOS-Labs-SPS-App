create index action_contracts_created_by_idx
  on public.action_contracts(created_by)
  where created_by is not null;

create index project_profile_revisions_action_idx
  on public.project_profile_revisions(action_id)
  where action_id is not null;

create index project_profiles_current_nba_action_idx
  on public.project_profiles(current_nba_action_id)
  where current_nba_action_id is not null;

create index verification_results_project_idx
  on public.verification_results(project_id, created_at desc);

create index verification_results_action_idx
  on public.verification_results(action_id, created_at desc);

create index execution_records_runtime_execution_idx
  on public.execution_records(runtime_execution_id);

create index execution_records_verification_result_idx
  on public.execution_records(verification_result_id)
  where verification_result_id is not null;
