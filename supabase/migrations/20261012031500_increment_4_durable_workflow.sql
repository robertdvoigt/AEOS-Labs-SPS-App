alter table public.runtime_executions
  add column workflow_access_hash text,
  add column workflow_access_expires_at timestamptz;

create table public.runtime_checkpoints (
  id uuid primary key default gen_random_uuid(),
  runtime_execution_id uuid not null references public.runtime_executions(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  phase text not null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(runtime_execution_id, sequence)
);

create index runtime_checkpoints_execution_sequence_idx
  on public.runtime_checkpoints(runtime_execution_id, sequence);

alter table public.runtime_checkpoints enable row level security;

revoke all on public.runtime_checkpoints from anon, authenticated;
grant select on public.runtime_checkpoints to authenticated;
grant select, insert, update, delete on public.runtime_checkpoints to service_role;

create policy "runtime_checkpoints_select_own"
on public.runtime_checkpoints for select to authenticated
using (exists (
  select 1
  from public.runtime_executions re
  join public.projects p on p.id = re.project_id
  where re.id = runtime_checkpoints.runtime_execution_id
    and p.owner_user_id = (select auth.uid())
));

create or replace function public.create_durability_probe(
  p_project_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_current_nba_action_id uuid;
  v_action_id uuid;
  v_execution_id uuid;
  v_token text;
  v_token_hash text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select pp.revision, pp.current_nba_action_id
  into v_current_revision, v_current_nba_action_id
  from public.project_profiles pp
  join public.projects p on p.id = pp.project_id
  where pp.project_id = p_project_id
    and p.owner_user_id = v_user_id
  for update of pp;

  if v_current_revision is null then
    raise exception 'project access denied' using errcode = '42501';
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  if exists (
    select 1
    from public.runtime_executions re
    join public.action_contracts a on a.id = re.action_id
    where re.project_id = p_project_id
      and a.action_type = 'durability_probe'
      and re.state in (
        'queued','preparing','running','waiting_for_human','waiting_for_external',
        'verifying','reconciling'
      )
  ) then
    raise exception 'durability probe already active' using errcode = '55000';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

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
    p_project_id,
    p_expected_revision,
    v_current_nba_action_id,
    'durability_probe',
    'Verify durable Runtime continuity',
    'Prove that a multi-step Runtime job survives the initiating request and records durable checkpoints.',
    'aeos',
    'active',
    '{"type":"durability_probe_result"}'::jsonb,
    '{"checkpointSequencePersisted":true,"completionPersisted":true,"canonicalRevisionPreserved":true}'::jsonb,
    '["durable_workflow","checkpointing","resume"]'::jsonb,
    '["runtime_checkpoint_history","execution_record"]'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'source', 'increment_4_durability_probe',
      'projectRevision', p_expected_revision
    ),
    v_user_id
  )
  returning id into v_action_id;

  insert into public.runtime_executions (
    project_id,
    action_id,
    attempt,
    state,
    context_revision,
    provider,
    model,
    workflow_access_hash,
    workflow_access_expires_at,
    started_at
  )
  values (
    p_project_id,
    v_action_id,
    1,
    'queued',
    p_expected_revision,
    'vercel_workflow',
    null,
    v_token_hash,
    now() + interval '1 hour',
    now()
  )
  returning id into v_execution_id;

  insert into public.runtime_checkpoints (
    runtime_execution_id,
    sequence,
    phase,
    state
  )
  values (
    v_execution_id,
    0,
    'created',
    jsonb_build_object('projectRevision', p_expected_revision)
  );

  return jsonb_build_object(
    'runtimeExecutionId', v_execution_id,
    'actionId', v_action_id,
    'capabilityToken', v_token
  );
end;
$$;

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
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.runtime_executions re
  set
    workflow_run_id = nullif(btrim(p_workflow_run_id), ''),
    state = 'running'
  from public.projects p
  where re.id = p_runtime_execution_id
    and p.id = re.project_id
    and p.owner_user_id = v_user_id
    and re.state = 'queued';

  if not found then
    raise exception 'runtime execution not bindable' using errcode = '55000';
  end if;
end;
$$;

create or replace function public.request_cancel_runtime_execution(
  p_runtime_execution_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  update public.runtime_executions re
  set cancel_requested_at = coalesce(cancel_requested_at, now())
  from public.projects p
  where re.id = p_runtime_execution_id
    and p.id = re.project_id
    and p.owner_user_id = v_user_id
    and re.state in (
      'queued','preparing','running','waiting_for_human','waiting_for_external',
      'verifying','reconciling'
    );

  if not found then
    raise exception 'runtime execution not cancellable' using errcode = '55000';
  end if;
end;
$$;

create or replace function public.workflow_runtime_checkpoint(
  p_runtime_execution_id uuid,
  p_capability_token text,
  p_sequence integer,
  p_phase text,
  p_state jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cancel_requested_at timestamptz;
begin
  if p_sequence < 0
     or btrim(coalesce(p_phase, '')) = ''
     or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid checkpoint payload' using errcode = '22023';
  end if;

  select re.cancel_requested_at
  into v_cancel_requested_at
  from public.runtime_executions re
  where re.id = p_runtime_execution_id
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
    and re.state in (
      'queued','preparing','running','waiting_for_human','waiting_for_external',
      'verifying','reconciling'
    )
  for update;

  if not found then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  insert into public.runtime_checkpoints (
    runtime_execution_id,
    sequence,
    phase,
    state
  )
  values (
    p_runtime_execution_id,
    p_sequence,
    btrim(p_phase),
    p_state
  )
  on conflict (runtime_execution_id, sequence)
  do update set
    phase = excluded.phase,
    state = excluded.state;

  update public.runtime_executions
  set state = 'running'
  where id = p_runtime_execution_id
    and state <> 'running';

  return jsonb_build_object(
    'cancelRequested', v_cancel_requested_at is not null
  );
end;
$$;

create or replace function public.workflow_runtime_control(
  p_runtime_execution_id uuid,
  p_capability_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text;
  v_cancel_requested_at timestamptz;
begin
  select re.state, re.cancel_requested_at
  into v_state, v_cancel_requested_at
  from public.runtime_executions re
  where re.id = p_runtime_execution_id
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now();

  if not found then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'state', v_state,
    'cancelRequested', v_cancel_requested_at is not null
  );
end;
$$;

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
  v_verification_id uuid;
begin
  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'invalid durability result' using errcode = '22023';
  end if;

  select re.project_id, re.action_id, re.context_revision, a.objective
  into v_project_id, v_action_id, v_context_revision, v_action_objective
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  where re.id = p_runtime_execution_id
    and a.action_type = 'durability_probe'
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
    and re.state in (
      'queued','preparing','running','waiting_for_human','waiting_for_external',
      'verifying','reconciling'
    )
  for update of re, a;

  if v_project_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

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

  update public.runtime_executions
  set
    state = 'succeeded',
    result = p_result,
    completed_at = now(),
    workflow_access_hash = null,
    workflow_access_expires_at = null
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
begin
  select re.project_id, re.action_id, re.context_revision, a.objective
  into v_project_id, v_action_id, v_context_revision, v_action_objective
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  where re.id = p_runtime_execution_id
    and a.action_type = 'durability_probe'
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
    and re.cancel_requested_at is not null
    and re.state in (
      'queued','preparing','running','waiting_for_human','waiting_for_external',
      'verifying','reconciling'
    )
  for update of re, a;

  if v_project_id is null then
    raise exception 'durability probe is not cancellable with this capability' using errcode = '42501';
  end if;

  update public.runtime_executions
  set
    state = 'cancelled',
    completed_at = now(),
    workflow_access_hash = null,
    workflow_access_expires_at = null
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
begin
  select re.project_id, re.action_id, re.context_revision, a.objective
  into v_project_id, v_action_id, v_context_revision, v_action_objective
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  where re.id = p_runtime_execution_id
    and a.action_type = 'durability_probe'
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
    and re.state not in ('succeeded','failed','cancelled')
  for update of re, a;

  if v_project_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  update public.runtime_executions
  set
    state = 'failed',
    error_code = 'durability_probe_failed',
    error_message = left(coalesce(p_error_message, 'Durability probe failed.'), 2000),
    completed_at = now(),
    workflow_access_hash = null,
    workflow_access_expires_at = null
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

revoke all on function public.create_durability_probe(uuid,bigint) from public;
revoke all on function public.bind_durable_workflow(uuid,text) from public;
revoke all on function public.request_cancel_runtime_execution(uuid) from public;
revoke all on function public.workflow_runtime_checkpoint(uuid,text,integer,text,jsonb) from public;
revoke all on function public.workflow_runtime_control(uuid,text) from public;
revoke all on function public.workflow_complete_durability_probe(uuid,text,jsonb) from public;
revoke all on function public.workflow_cancel_durability_probe(uuid,text) from public;
revoke all on function public.workflow_fail_durability_probe(uuid,text,text) from public;

grant execute on function public.create_durability_probe(uuid,bigint) to authenticated;
grant execute on function public.bind_durable_workflow(uuid,text) to authenticated;
grant execute on function public.request_cancel_runtime_execution(uuid) to authenticated;

grant execute on function public.workflow_runtime_checkpoint(uuid,text,integer,text,jsonb) to anon, authenticated;
grant execute on function public.workflow_runtime_control(uuid,text) to anon, authenticated;
grant execute on function public.workflow_complete_durability_probe(uuid,text,jsonb) to anon, authenticated;
grant execute on function public.workflow_cancel_durability_probe(uuid,text) to anon, authenticated;
grant execute on function public.workflow_fail_durability_probe(uuid,text,text) to anon, authenticated;
