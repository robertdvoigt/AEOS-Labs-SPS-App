create or replace function public.workflow_complete_durability_probe(
  p_runtime_execution_id uuid,
  p_capability_token text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_action_id uuid;
  v_context_revision bigint;
  v_action_objective text;
  v_current_state text;
  v_verification_id uuid;
begin
  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'invalid durability result' using errcode = '22023';
  end if;

  select re.project_id, re.action_id, re.context_revision, a.objective, re.state
  into v_project_id, v_action_id, v_context_revision, v_action_objective, v_current_state
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  where re.id = p_runtime_execution_id
    and a.action_type = 'durability_probe'
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
  for update of re, a;

  if v_project_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  if v_current_state = 'succeeded' then
    return;
  end if;

  if v_current_state not in (
    'queued','preparing','running','waiting_for_human','waiting_for_external',
    'verifying','reconciling'
  ) then
    raise exception 'durability probe cannot complete from current state' using errcode = '55000';
  end if;

  select vr.id
  into v_verification_id
  from public.verification_results vr
  where vr.runtime_execution_id = p_runtime_execution_id
  order by vr.created_at desc
  limit 1;

  if v_verification_id is null then
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
      'pass',
      'deterministic',
      'durable checkpoint sequence inspection',
      'Durable workflow completed after persisted multi-step checkpoints.',
      jsonb_build_object(
        'checkpointCount', (
          select count(*)
          from public.runtime_checkpoints rc
          where rc.runtime_execution_id = p_runtime_execution_id
        )
      )
    )
    returning id into v_verification_id;
  end if;

  update public.runtime_executions
  set
    state = 'succeeded',
    result = p_result,
    completed_at = now()
  where id = p_runtime_execution_id;

  update public.action_contracts
  set status = 'completed', updated_at = now()
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
      v_context_revision,
      v_context_revision,
      '[]'::jsonb
    );
  end if;
end;
$$;

create or replace function public.workflow_cancel_durability_probe(
  p_runtime_execution_id uuid,
  p_capability_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_action_id uuid;
  v_context_revision bigint;
  v_action_objective text;
  v_current_state text;
  v_cancel_requested_at timestamptz;
begin
  select re.project_id, re.action_id, re.context_revision, a.objective, re.state, re.cancel_requested_at
  into v_project_id, v_action_id, v_context_revision, v_action_objective, v_current_state, v_cancel_requested_at
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  where re.id = p_runtime_execution_id
    and a.action_type = 'durability_probe'
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
  for update of re, a;

  if v_project_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  if v_current_state = 'cancelled' then
    return;
  end if;

  if v_cancel_requested_at is null then
    raise exception 'durability probe has no cancellation request' using errcode = '55000';
  end if;

  if v_current_state not in (
    'queued','preparing','running','waiting_for_human','waiting_for_external',
    'verifying','reconciling'
  ) then
    raise exception 'durability probe cannot cancel from current state' using errcode = '55000';
  end if;

  update public.runtime_executions
  set
    state = 'cancelled',
    completed_at = now()
  where id = p_runtime_execution_id;

  update public.action_contracts
  set status = 'cancelled', updated_at = now()
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
      'cancelled',
      v_action_objective,
      '{"cancelledAtSafeBoundary":true}'::jsonb,
      v_context_revision,
      v_context_revision,
      '[]'::jsonb
    );
  end if;
end;
$$;

create or replace function public.workflow_fail_durability_probe(
  p_runtime_execution_id uuid,
  p_capability_token text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_action_id uuid;
  v_context_revision bigint;
  v_action_objective text;
  v_current_state text;
begin
  select re.project_id, re.action_id, re.context_revision, a.objective, re.state
  into v_project_id, v_action_id, v_context_revision, v_action_objective, v_current_state
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  where re.id = p_runtime_execution_id
    and a.action_type = 'durability_probe'
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
  for update of re, a;

  if v_project_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  if v_current_state = 'failed' then
    return;
  end if;

  if v_current_state in ('succeeded','cancelled') then
    return;
  end if;

  update public.runtime_executions
  set
    state = 'failed',
    error_code = 'durability_probe_failed',
    error_message = left(coalesce(p_error_message, 'Durability probe failed.'), 2000),
    completed_at = now()
  where id = p_runtime_execution_id;

  update public.action_contracts
  set status = 'blocked', updated_at = now()
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
      'failed',
      v_action_objective,
      '{}'::jsonb,
      v_context_revision,
      v_context_revision,
      jsonb_build_array(left(coalesce(p_error_message, 'Durability probe failed.'), 2000))
    );
  end if;
end;
$$;
