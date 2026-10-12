create or replace function public.bind_durable_workflow(
  p_runtime_execution_id uuid,
  p_workflow_run_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id text := nullif(btrim(p_workflow_run_id), '');
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_run_id is null then
    raise exception 'workflow run id required' using errcode = '22023';
  end if;

  update public.runtime_executions re
  set
    workflow_run_id = coalesce(re.workflow_run_id, v_run_id),
    state = case when re.state = 'queued' then 'running' else re.state end
  from public.projects p
  where re.id = p_runtime_execution_id
    and p.id = re.project_id
    and p.owner_user_id = v_user_id
    and re.state in ('queued','running')
    and (re.workflow_run_id is null or re.workflow_run_id = v_run_id);

  if not found then
    raise exception 'runtime execution not bindable' using errcode = '55000';
  end if;
end;
$$;
