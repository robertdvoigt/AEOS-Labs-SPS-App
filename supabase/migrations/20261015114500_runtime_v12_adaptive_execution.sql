-- AEOS Runtime v1.2 targeted adaptive execution control.
-- Adds failure classification, repeated-failure review, unchanged-retry guard,
-- and explicit bounded Build Unit eligibility for software code execution.

alter table public.runtime_executions
  add column if not exists execution_strategy text not null default 'sandbox_agent',
  add column if not exists strategy_revision integer not null default 1 check (strategy_revision > 0),
  add column if not exists material_changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(material_changes) = 'object'),
  add column if not exists failure_phase text,
  add column if not exists failure_class text,
  add column if not exists failure_signature text,
  add column if not exists adaptation_review_required boolean not null default false;

create table if not exists public.action_execution_strategies (
  action_id uuid primary key references public.action_contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  strategy_key text not null default 'sandbox_agent',
  strategy_revision integer not null default 1 check (strategy_revision > 0),
  configuration jsonb not null default '{}'::jsonb
    check (jsonb_typeof(configuration) = 'object'),
  material_changes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(material_changes) = 'object'),
  change_rationale text,
  updated_at timestamptz not null default now()
);

create index if not exists action_execution_strategies_project_idx
  on public.action_execution_strategies(project_id, updated_at desc);

create table if not exists public.execution_adaptation_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action_id uuid not null references public.action_contracts(id) on delete cascade,
  trigger_runtime_execution_id uuid not null references public.runtime_executions(id) on delete cascade,
  status text not null default 'required'
    check (status in ('required','resolved','dismissed')),
  failure_phase text not null,
  failure_class text not null,
  failure_signature text not null,
  repeated_failure_count integer not null check (repeated_failure_count >= 1),
  disposition text not null,
  rationale text not null,
  prior_attempt_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(prior_attempt_ids) = 'array'),
  required_change text,
  resolved_strategy_key text,
  changed_variables jsonb not null default '{}'::jsonb
    check (jsonb_typeof(changed_variables) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists execution_adaptation_reviews_one_required_per_action_idx
  on public.execution_adaptation_reviews(action_id)
  where status = 'required';

create index if not exists execution_adaptation_reviews_project_created_idx
  on public.execution_adaptation_reviews(project_id, created_at desc);

alter table public.action_execution_strategies enable row level security;
alter table public.execution_adaptation_reviews enable row level security;

revoke all on public.action_execution_strategies from anon, authenticated;
revoke all on public.execution_adaptation_reviews from anon, authenticated;

grant select on public.action_execution_strategies to authenticated;
grant select on public.execution_adaptation_reviews to authenticated;

grant select, insert, update, delete on public.action_execution_strategies to service_role;
grant select, insert, update, delete on public.execution_adaptation_reviews to service_role;

drop policy if exists "action_execution_strategies_select_own" on public.action_execution_strategies;
create policy "action_execution_strategies_select_own"
on public.action_execution_strategies for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = action_execution_strategies.project_id
    and p.owner_user_id = (select auth.uid())
));

drop policy if exists "execution_adaptation_reviews_select_own" on public.execution_adaptation_reviews;
create policy "execution_adaptation_reviews_select_own"
on public.execution_adaptation_reviews for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = execution_adaptation_reviews.project_id
    and p.owner_user_id = (select auth.uid())
));

create or replace function public.classify_code_execution_failure(
  p_error_message text,
  p_failure_phase text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_error_message, '') ilike '%max turns%' then 'agent_budget'
    when coalesce(p_error_message, '') ilike '%configuration is incomplete%' then 'configuration'
    when coalesce(p_error_message, '') ilike '%credential%' then 'credential'
    when coalesce(p_error_message, '') ilike '%sandbox command failed%' then 'sandbox_command'
    when coalesce(p_error_message, '') ilike '%test%' or coalesce(p_error_message, '') ilike '%build%' then 'verification'
    when coalesce(p_failure_phase, '') = 'agent_started' then 'agent_execution'
    when coalesce(p_failure_phase, '') = 'sandbox_created' then 'sandbox_execution'
    else 'execution'
  end
$$;

create or replace function public.create_code_execution(
  p_project_id uuid,
  p_expected_revision bigint,
  p_repository_id uuid,
  p_branch text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_action_id uuid;
  v_action_input jsonb;
  v_action_status text;
  v_code_change_id uuid;
  v_execution_id uuid;
  v_token text;
  v_token_hash text;
  v_strategy_key text;
  v_strategy_revision integer;
  v_material_changes jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_branch, '')) = '' then
    raise exception 'branch required' using errcode = '22023';
  end if;

  select a.id, a.input, a.status
  into v_action_id, v_action_input, v_action_status
  from public.projects p
  join public.project_profiles pp on pp.project_id = p.id
  join public.action_contracts a on a.id = pp.current_nba_action_id
  join public.repositories r on r.id = p_repository_id and r.project_id = p.id
  where p.id = p_project_id
    and p.owner_user_id = v_user_id
    and pp.revision = p_expected_revision
    and a.profile_revision = p_expected_revision
    and a.owner = 'aeos'
    and a.action_type = 'build'
  for update of pp, a;

  if v_action_id is null then
    if exists (
      select 1 from public.projects p
      where p.id = p_project_id and p.owner_user_id = v_user_id
    ) and exists (
      select 1 from public.project_profiles pp
      where pp.project_id = p_project_id and pp.revision <> p_expected_revision
    ) then
      raise exception 'stale project revision' using errcode = '40001';
    end if;
    raise exception 'build action is not current and executable' using errcode = '55000';
  end if;

  if jsonb_typeof(v_action_input -> 'buildUnit') <> 'object'
     or btrim(coalesce(v_action_input #>> '{buildUnit,outcome}', '')) = ''
     or btrim(coalesce(v_action_input #>> '{buildUnit,scope}', '')) = ''
     or (v_action_input #> '{buildUnit,acceptance}') is null
     or (v_action_input #> '{buildUnit,verification}') is null then
    raise exception 'bounded Build Unit required before software execution' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.execution_adaptation_reviews ar
    where ar.action_id = v_action_id
      and ar.status = 'required'
  ) then
    raise exception 'adaptive execution review required before another attempt' using errcode = '55000';
  end if;

  if v_action_status <> 'ready' then
    raise exception 'build action is not current and executable' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.runtime_executions re
    where re.action_id = v_action_id
      and re.state in (
        'queued','preparing','running','waiting_for_human','waiting_for_external',
        'verifying','reconciling'
      )
  ) then
    raise exception 'build execution already active' using errcode = '55000';
  end if;

  insert into public.action_execution_strategies (
    action_id,
    project_id,
    strategy_key,
    strategy_revision,
    configuration,
    material_changes
  )
  values (
    v_action_id,
    p_project_id,
    'sandbox_agent',
    1,
    '{}'::jsonb,
    jsonb_build_object('initialStrategy', true)
  )
  on conflict (action_id) do nothing;

  select aes.strategy_key, aes.strategy_revision, aes.material_changes
  into v_strategy_key, v_strategy_revision, v_material_changes
  from public.action_execution_strategies aes
  where aes.action_id = v_action_id;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.code_changes (
    project_id,
    action_id,
    repository_id,
    branch,
    status
  )
  values (
    p_project_id,
    v_action_id,
    p_repository_id,
    btrim(p_branch),
    'planned'
  )
  returning id into v_code_change_id;

  insert into public.runtime_executions (
    project_id,
    action_id,
    attempt,
    state,
    context_revision,
    provider,
    execution_strategy,
    strategy_revision,
    material_changes,
    workflow_access_hash,
    workflow_access_expires_at,
    started_at
  )
  values (
    p_project_id,
    v_action_id,
    coalesce((
      select max(re.attempt) + 1
      from public.runtime_executions re
      where re.action_id = v_action_id
    ), 1),
    'queued',
    p_expected_revision,
    'openai_agents_vercel_sandbox',
    v_strategy_key,
    v_strategy_revision,
    coalesce(v_material_changes, '{}'::jsonb),
    v_token_hash,
    now() + interval '4 hours',
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
    'code_execution_created',
    jsonb_build_object(
      'codeChangeId', v_code_change_id,
      'repositoryId', p_repository_id,
      'branch', btrim(p_branch),
      'strategyKey', v_strategy_key,
      'strategyRevision', v_strategy_revision,
      'materialChanges', coalesce(v_material_changes, '{}'::jsonb)
    )
  );

  update public.action_contracts
  set status = 'active', updated_at = now()
  where id = v_action_id;

  return jsonb_build_object(
    'runtimeExecutionId', v_execution_id,
    'codeChangeId', v_code_change_id,
    'actionId', v_action_id,
    'capabilityToken', v_token,
    'executionStrategy', v_strategy_key,
    'strategyRevision', v_strategy_revision
  );
end;
$$;

create or replace function public.workflow_fail_code_execution(
  p_runtime_execution_id uuid,
  p_capability_token text,
  p_code_change_id uuid,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_id uuid;
  v_project_id uuid;
  v_current_state text;
  v_strategy_key text;
  v_strategy_revision integer;
  v_failure_phase text;
  v_failure_class text;
  v_failure_signature text;
  v_repeated_count integer;
  v_prior_attempt_ids jsonb;
begin
  select re.action_id, re.project_id, re.state, re.execution_strategy, re.strategy_revision
  into v_action_id, v_project_id, v_current_state, v_strategy_key, v_strategy_revision
  from public.runtime_executions re
  join public.code_changes cc
    on cc.id = p_code_change_id
   and cc.action_id = re.action_id
  where re.id = p_runtime_execution_id
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
  for update of re, cc;

  if v_action_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  if v_current_state in ('succeeded','failed','cancelled') then
    return;
  end if;

  select rc.phase
  into v_failure_phase
  from public.runtime_checkpoints rc
  where rc.runtime_execution_id = p_runtime_execution_id
  order by rc.sequence desc
  limit 1;

  v_failure_phase := coalesce(v_failure_phase, 'unknown');
  v_failure_class := public.classify_code_execution_failure(p_error_message, v_failure_phase);
  v_failure_signature := v_failure_phase || ':' || v_failure_class;

  update public.runtime_executions
  set
    state = 'failed',
    error_code = 'code_execution_failed',
    error_message = left(coalesce(p_error_message, 'Code execution failed.'), 2000),
    failure_phase = v_failure_phase,
    failure_class = v_failure_class,
    failure_signature = v_failure_signature,
    completed_at = now()
  where id = p_runtime_execution_id;

  update public.code_changes
  set status = 'failed'
  where id = p_code_change_id;

  select
    count(*)::integer,
    coalesce(jsonb_agg(re.id order by re.attempt), '[]'::jsonb)
  into v_repeated_count, v_prior_attempt_ids
  from public.runtime_executions re
  where re.action_id = v_action_id
    and re.state = 'failed'
    and re.execution_strategy = v_strategy_key
    and re.strategy_revision = v_strategy_revision
    and re.failure_signature = v_failure_signature;

  if v_repeated_count >= 2 then
    update public.runtime_executions
    set adaptation_review_required = true
    where id = p_runtime_execution_id;

    insert into public.execution_adaptation_reviews (
      project_id,
      action_id,
      trigger_runtime_execution_id,
      failure_phase,
      failure_class,
      failure_signature,
      repeated_failure_count,
      disposition,
      rationale,
      prior_attempt_ids,
      required_change
    )
    values (
      v_project_id,
      v_action_id,
      p_runtime_execution_id,
      v_failure_phase,
      v_failure_class,
      v_failure_signature,
      v_repeated_count,
      case
        when v_failure_class in ('agent_budget','agent_execution') then 'change_method'
        when v_failure_class in ('configuration','credential') then 'repair'
        when v_failure_class = 'verification' then 'repair_or_narrow'
        else 'adaptive_review'
      end,
      'Repeated materially similar failure under the same execution strategy requires review before another attempt.',
      v_prior_attempt_ids,
      'Record a materially changed execution strategy or a justified transient-failure basis before retry.'
    )
    on conflict (action_id) where status = 'required'
    do update set
      trigger_runtime_execution_id = excluded.trigger_runtime_execution_id,
      failure_phase = excluded.failure_phase,
      failure_class = excluded.failure_class,
      failure_signature = excluded.failure_signature,
      repeated_failure_count = excluded.repeated_failure_count,
      disposition = excluded.disposition,
      rationale = excluded.rationale,
      prior_attempt_ids = excluded.prior_attempt_ids,
      required_change = excluded.required_change,
      created_at = now();

    update public.action_contracts
    set status = 'blocked', updated_at = now()
    where id = v_action_id;
  else
    update public.action_contracts
    set status = 'ready', updated_at = now()
    where id = v_action_id;
  end if;
end;
$$;

create or replace function public.resolve_execution_adaptation_review(
  p_action_id uuid,
  p_strategy_key text,
  p_disposition text,
  p_rationale text,
  p_changed_variables jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_review_id uuid;
  v_next_revision integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_strategy_key, '')) = ''
     or btrim(coalesce(p_disposition, '')) = ''
     or btrim(coalesce(p_rationale, '')) = ''
     or jsonb_typeof(p_changed_variables) <> 'object' then
    raise exception 'invalid adaptation resolution payload' using errcode = '22023';
  end if;

  select a.project_id
  into v_project_id
  from public.action_contracts a
  join public.projects p on p.id = a.project_id
  join public.project_profiles pp
    on pp.project_id = a.project_id
   and pp.current_nba_action_id = a.id
  where a.id = p_action_id
    and p.owner_user_id = v_user_id
  for update of a;

  if v_project_id is null then
    raise exception 'current action access denied' using errcode = '42501';
  end if;

  select ar.id
  into v_review_id
  from public.execution_adaptation_reviews ar
  where ar.action_id = p_action_id
    and ar.status = 'required'
  order by ar.created_at desc
  limit 1
  for update;

  if v_review_id is null then
    raise exception 'no required adaptive execution review' using errcode = '55000';
  end if;

  if p_disposition <> 'retry_transient'
     and p_changed_variables = '{}'::jsonb then
    raise exception 'material execution change required before retry' using errcode = '55000';
  end if;

  select coalesce(aes.strategy_revision, 0) + 1
  into v_next_revision
  from public.action_execution_strategies aes
  where aes.action_id = p_action_id;

  if v_next_revision is null then
    v_next_revision := 1;
  end if;

  insert into public.action_execution_strategies (
    action_id,
    project_id,
    strategy_key,
    strategy_revision,
    material_changes,
    change_rationale
  )
  values (
    p_action_id,
    v_project_id,
    btrim(p_strategy_key),
    v_next_revision,
    p_changed_variables,
    btrim(p_rationale)
  )
  on conflict (action_id)
  do update set
    strategy_key = excluded.strategy_key,
    strategy_revision = action_execution_strategies.strategy_revision + 1,
    material_changes = excluded.material_changes,
    change_rationale = excluded.change_rationale,
    updated_at = now()
  returning strategy_revision into v_next_revision;

  update public.execution_adaptation_reviews
  set
    status = 'resolved',
    disposition = btrim(p_disposition),
    rationale = btrim(p_rationale),
    resolved_strategy_key = btrim(p_strategy_key),
    changed_variables = p_changed_variables,
    resolved_at = now()
  where id = v_review_id;

  update public.action_contracts
  set status = 'ready', updated_at = now()
  where id = p_action_id
    and status = 'blocked';

  return jsonb_build_object(
    'actionId', p_action_id,
    'strategyKey', btrim(p_strategy_key),
    'strategyRevision', v_next_revision,
    'status', 'ready'
  );
end;
$$;

revoke all on function public.classify_code_execution_failure(text,text) from public, anon, authenticated;
grant execute on function public.classify_code_execution_failure(text,text) to service_role;

revoke all on function public.resolve_execution_adaptation_review(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.resolve_execution_adaptation_review(uuid,text,text,text,jsonb) to authenticated, service_role;

-- Backfill reusable failure evidence from prior code executions without changing canonical project state.
update public.runtime_executions re
set
  failure_phase = coalesce((
    select rc.phase
    from public.runtime_checkpoints rc
    where rc.runtime_execution_id = re.id
    order by rc.sequence desc
    limit 1
  ), 'unknown')
where re.provider = 'openai_agents_vercel_sandbox'
  and re.state = 'failed'
  and re.failure_phase is null;

update public.runtime_executions re
set
  failure_class = public.classify_code_execution_failure(re.error_message, re.failure_phase),
  failure_signature = re.failure_phase || ':' ||
    public.classify_code_execution_failure(re.error_message, re.failure_phase)
where re.provider = 'openai_agents_vercel_sandbox'
  and re.state = 'failed'
  and re.failure_signature is null;
