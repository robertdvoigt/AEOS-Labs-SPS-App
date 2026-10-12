create or replace function public.start_runtime_execution(
  p_action_id uuid,
  p_expected_revision bigint,
  p_model_class text,
  p_provider text,
  p_model text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_action_revision bigint;
  v_attempt integer;
  v_execution_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_model_class not in ('fast','standard','deep','critical') then
    raise exception 'invalid model class' using errcode = '22023';
  end if;

  select a.project_id, a.profile_revision
  into v_project_id, v_action_revision
  from public.action_contracts a
  join public.projects p on p.id = a.project_id
  join public.project_profiles pp on pp.project_id = a.project_id
  where a.id = p_action_id
    and p.owner_user_id = v_user_id
    and pp.current_nba_action_id = a.id
    and pp.revision = p_expected_revision
    and a.profile_revision = p_expected_revision
    and a.owner = 'aeos'
    and a.status = 'ready'
  for update of a, pp;

  if v_project_id is null then
    if exists (
      select 1 from public.action_contracts a
      join public.projects p on p.id = a.project_id
      where a.id = p_action_id and p.owner_user_id <> v_user_id
    ) then
      raise exception 'project access denied' using errcode = '42501';
    end if;
    raise exception 'action is not current and executable' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.runtime_executions re
    where re.action_id = p_action_id
      and re.state in (
        'queued','preparing','running','waiting_for_human','waiting_for_external',
        'verifying','reconciling'
      )
  ) then
    raise exception 'runtime execution already active' using errcode = '55000';
  end if;

  select coalesce(max(re.attempt), 0) + 1
  into v_attempt
  from public.runtime_executions re
  where re.action_id = p_action_id;

  insert into public.runtime_executions (
    project_id,
    action_id,
    attempt,
    state,
    context_revision,
    model_class,
    provider,
    model,
    started_at
  )
  values (
    v_project_id,
    p_action_id,
    v_attempt,
    'running',
    p_expected_revision,
    p_model_class,
    nullif(btrim(p_provider), ''),
    nullif(btrim(p_model), ''),
    now()
  )
  returning id into v_execution_id;

  update public.action_contracts
  set status = 'active', updated_at = now()
  where id = p_action_id;

  return v_execution_id;
end;
$$;

create or replace function public.complete_runtime_analysis(
  p_runtime_execution_id uuid,
  p_expected_revision bigint,
  p_provider_response_id text,
  p_result jsonb,
  p_usage jsonb,
  p_limitations jsonb,
  p_verification_status text,
  p_verification_method text,
  p_verification_summary text,
  p_verification_details jsonb,
  p_specialization_state jsonb,
  p_next_action_type text,
  p_next_action_title text,
  p_next_action_objective text,
  p_next_action_expected_result jsonb,
  p_next_action_acceptance_condition jsonb,
  p_next_required_capabilities jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_action_id uuid;
  v_action_objective text;
  v_current_revision bigint;
  v_core_state jsonb;
  v_new_revision bigint;
  v_verification_id uuid;
  v_next_action_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_verification_status not in ('pass','pass_with_known_limitation') then
    raise exception 'successful completion requires passing verification' using errcode = '22023';
  end if;

  if jsonb_typeof(p_result) <> 'object'
     or jsonb_typeof(p_usage) <> 'object'
     or jsonb_typeof(p_limitations) <> 'array'
     or jsonb_typeof(p_verification_details) <> 'object'
     or jsonb_typeof(p_specialization_state) <> 'object'
     or jsonb_typeof(p_next_action_expected_result) <> 'object'
     or jsonb_typeof(p_next_action_acceptance_condition) <> 'object'
     or jsonb_typeof(p_next_required_capabilities) <> 'array' then
    raise exception 'invalid runtime completion payload' using errcode = '22023';
  end if;

  select re.project_id, re.action_id, a.objective
  into v_project_id, v_action_id, v_action_objective
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  join public.projects p on p.id = re.project_id
  where re.id = p_runtime_execution_id
    and p.owner_user_id = v_user_id
    and re.state in ('running','verifying','reconciling')
  for update of re, a;

  if v_project_id is null then
    raise exception 'runtime execution not executable by current user' using errcode = '42501';
  end if;

  select pp.revision, pp.core_state
  into v_current_revision, v_core_state
  from public.project_profiles pp
  where pp.project_id = v_project_id
    and pp.current_nba_action_id = v_action_id
  for update;

  if v_current_revision is null then
    raise exception 'runtime action is no longer current' using errcode = '55000';
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  update public.runtime_executions
  set state = 'reconciling'
  where id = p_runtime_execution_id;

  insert into public.verification_results (
    project_id,
    action_id,
    runtime_execution_id,
    status,
    verifier_kind,
    method,
    summary,
    details
  )
  values (
    v_project_id,
    v_action_id,
    p_runtime_execution_id,
    p_verification_status,
    'deterministic',
    btrim(p_verification_method),
    btrim(p_verification_summary),
    p_verification_details
  )
  returning id into v_verification_id;

  update public.action_contracts
  set status = 'completed', updated_at = now()
  where id = v_action_id;

  v_new_revision := v_current_revision + 1;

  insert into public.action_contracts (
    project_id,
    profile_revision,
    parent_action_id,
    action_type,
    title,
    objective,
    owner,
    status,
    expected_result,
    acceptance_condition,
    required_capabilities,
    verification_requirements,
    authority_requirements,
    input,
    created_by
  )
  values (
    v_project_id,
    v_new_revision,
    v_action_id,
    btrim(p_next_action_type),
    btrim(p_next_action_title),
    btrim(p_next_action_objective),
    'aeos',
    'ready',
    p_next_action_expected_result,
    p_next_action_acceptance_condition,
    p_next_required_capabilities,
    '[]'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'source', 'runtime_reconciliation',
      'parentRuntimeExecutionId', p_runtime_execution_id,
      'projectRevision', v_new_revision
    ),
    v_user_id
  )
  returning id into v_next_action_id;

  update public.project_profiles
  set
    revision = v_new_revision,
    specialization_state = p_specialization_state,
    current_nba_action_id = v_next_action_id,
    updated_at = now(),
    updated_by = v_user_id,
    source_revision_parent = v_current_revision
  where project_id = v_project_id;

  insert into public.project_profile_revisions (
    project_id,
    revision,
    core_state,
    specialization_state,
    change_summary,
    action_id
  )
  values (
    v_project_id,
    v_new_revision,
    v_core_state,
    p_specialization_state,
    'Reconcile verified Runtime result and advance NBA',
    v_action_id
  );

  update public.runtime_executions
  set
    state = 'succeeded',
    provider_response_id = nullif(btrim(p_provider_response_id), ''),
    result = p_result,
    limitations = p_limitations,
    usage = p_usage,
    completed_at = now()
  where id = p_runtime_execution_id;

  insert into public.execution_records (
    project_id,
    action_id,
    runtime_execution_id,
    verification_result_id,
    outcome,
    expected_contribution,
    actual_result,
    profile_revision_before,
    profile_revision_after,
    limitations
  )
  values (
    v_project_id,
    v_action_id,
    p_runtime_execution_id,
    v_verification_id,
    'succeeded',
    v_action_objective,
    p_result,
    v_current_revision,
    v_new_revision,
    p_limitations
  );

  return jsonb_build_object(
    'revision', v_new_revision,
    'completedActionId', v_action_id,
    'nextActionId', v_next_action_id,
    'verificationResultId', v_verification_id
  );
end;
$$;

create or replace function public.fail_runtime_execution(
  p_runtime_execution_id uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_result jsonb default '{}'::jsonb,
  p_usage jsonb default '{}'::jsonb,
  p_limitations jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_action_id uuid;
  v_context_revision bigint;
  v_action_objective text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select re.project_id, re.action_id, re.context_revision, a.objective
  into v_project_id, v_action_id, v_context_revision, v_action_objective
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  join public.projects p on p.id = re.project_id
  where re.id = p_runtime_execution_id
    and p.owner_user_id = v_user_id
    and re.state not in ('succeeded','failed','cancelled')
  for update of re, a;

  if v_project_id is null then
    raise exception 'runtime execution not mutable by current user' using errcode = '42501';
  end if;

  update public.runtime_executions
  set
    state = 'failed',
    result = p_result,
    usage = p_usage,
    limitations = p_limitations,
    error_code = nullif(btrim(p_error_code), ''),
    error_message = nullif(btrim(p_error_message), ''),
    completed_at = now()
  where id = p_runtime_execution_id;

  update public.action_contracts
  set
    status = case when p_retryable then 'ready' else 'blocked' end,
    updated_at = now()
  where id = v_action_id;

  if not exists (
    select 1
    from public.execution_records er
    where er.runtime_execution_id = p_runtime_execution_id
  ) then
    insert into public.execution_records (
      project_id,
      action_id,
      runtime_execution_id,
      outcome,
      expected_contribution,
      actual_result,
      profile_revision_before,
      profile_revision_after,
      limitations
    )
    values (
      v_project_id,
      v_action_id,
      p_runtime_execution_id,
      case when p_retryable then 'failed' else 'blocked' end,
      v_action_objective,
      p_result,
      v_context_revision,
      null,
      p_limitations
    );
  end if;
end;
$$;

revoke all on function public.start_runtime_execution(uuid,bigint,text,text,text) from public;
revoke all on function public.complete_runtime_analysis(
  uuid,bigint,text,jsonb,jsonb,jsonb,text,text,text,jsonb,jsonb,text,text,text,jsonb,jsonb,jsonb
) from public;
revoke all on function public.fail_runtime_execution(uuid,text,text,boolean,jsonb,jsonb,jsonb) from public;

revoke execute on function public.start_runtime_execution(uuid,bigint,text,text,text) from anon;
revoke execute on function public.complete_runtime_analysis(
  uuid,bigint,text,jsonb,jsonb,jsonb,text,text,text,jsonb,jsonb,text,text,text,jsonb,jsonb,jsonb
) from anon;
revoke execute on function public.fail_runtime_execution(uuid,text,text,boolean,jsonb,jsonb,jsonb) from anon;

grant execute on function public.start_runtime_execution(uuid,bigint,text,text,text) to authenticated;
grant execute on function public.complete_runtime_analysis(
  uuid,bigint,text,jsonb,jsonb,jsonb,text,text,text,jsonb,jsonb,text,text,text,jsonb,jsonb,jsonb
) to authenticated;
grant execute on function public.fail_runtime_execution(uuid,text,text,boolean,jsonb,jsonb,jsonb) to authenticated;
