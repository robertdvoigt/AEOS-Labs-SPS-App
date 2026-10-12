create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  provider text not null check (provider in ('github')),
  external_account_id text not null,
  installation_id text,
  scopes jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active','revoked','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index integration_connections_github_installation_idx
  on public.integration_connections(user_id, provider, installation_id)
  where installation_id is not null;

create index integration_connections_project_idx
  on public.integration_connections(project_id, provider, status);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null default 'github' check (provider = 'github'),
  owner text not null,
  repo text not null,
  external_id text not null,
  default_branch text not null default 'main',
  installation_connection_id uuid not null references public.integration_connections(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id),
  unique(provider, owner, repo)
);

create table public.code_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action_id uuid not null references public.action_contracts(id) on delete cascade,
  repository_id uuid not null references public.repositories(id) on delete cascade,
  branch text not null,
  base_commit text,
  head_commit text,
  pull_request_ref text,
  status text not null default 'planned'
    check (status in ('planned','running','verified','pushed','accepted','failed','cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index code_changes_project_created_idx
  on public.code_changes(project_id, created_at desc);

create index code_changes_action_idx
  on public.code_changes(action_id, created_at desc);

alter table public.integration_connections enable row level security;
alter table public.repositories enable row level security;
alter table public.code_changes enable row level security;

revoke all on public.integration_connections from anon, authenticated;
revoke all on public.repositories from anon, authenticated;
revoke all on public.code_changes from anon, authenticated;

grant select on public.integration_connections to authenticated;
grant select on public.repositories to authenticated;
grant select on public.code_changes to authenticated;

grant select, insert, update, delete on public.integration_connections to service_role;
grant select, insert, update, delete on public.repositories to service_role;
grant select, insert, update, delete on public.code_changes to service_role;

create policy "integration_connections_select_own"
on public.integration_connections for select to authenticated
using (user_id = (select auth.uid()));

create policy "repositories_select_own"
on public.repositories for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = repositories.project_id
    and p.owner_user_id = (select auth.uid())
));

create policy "code_changes_select_own"
on public.code_changes for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = code_changes.project_id
    and p.owner_user_id = (select auth.uid())
));

create or replace function public.upsert_github_installation(
  p_project_id uuid,
  p_external_account_id text,
  p_installation_id text,
  p_scopes jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_connection_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_external_account_id, '')) = ''
     or btrim(coalesce(p_installation_id, '')) = ''
     or jsonb_typeof(p_scopes) <> 'object'
     or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'invalid GitHub installation payload' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.owner_user_id = v_user_id
  ) then
    raise exception 'project access denied' using errcode = '42501';
  end if;

  insert into public.integration_connections (
    user_id,
    project_id,
    provider,
    external_account_id,
    installation_id,
    scopes,
    metadata,
    status
  )
  values (
    v_user_id,
    p_project_id,
    'github',
    btrim(p_external_account_id),
    btrim(p_installation_id),
    p_scopes,
    p_metadata,
    'active'
  )
  on conflict (user_id, provider, installation_id)
  where installation_id is not null
  do update set
    project_id = excluded.project_id,
    external_account_id = excluded.external_account_id,
    scopes = excluded.scopes,
    metadata = excluded.metadata,
    status = 'active',
    updated_at = now()
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;

create or replace function public.register_project_repository(
  p_project_id uuid,
  p_connection_id uuid,
  p_owner text,
  p_repo text,
  p_external_id text,
  p_default_branch text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_repository_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_owner, '')) = ''
     or btrim(coalesce(p_repo, '')) = ''
     or btrim(coalesce(p_external_id, '')) = ''
     or btrim(coalesce(p_default_branch, '')) = '' then
    raise exception 'invalid repository payload' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.projects p
    join public.integration_connections ic
      on ic.id = p_connection_id
     and ic.user_id = v_user_id
     and ic.provider = 'github'
     and ic.status = 'active'
     and (ic.project_id is null or ic.project_id = p_project_id)
    where p.id = p_project_id
      and p.owner_user_id = v_user_id
  ) then
    raise exception 'repository connection access denied' using errcode = '42501';
  end if;

  insert into public.repositories (
    project_id,
    provider,
    owner,
    repo,
    external_id,
    default_branch,
    installation_connection_id
  )
  values (
    p_project_id,
    'github',
    btrim(p_owner),
    btrim(p_repo),
    btrim(p_external_id),
    btrim(p_default_branch),
    p_connection_id
  )
  on conflict (project_id)
  do update set
    owner = excluded.owner,
    repo = excluded.repo,
    external_id = excluded.external_id,
    default_branch = excluded.default_branch,
    installation_connection_id = excluded.installation_connection_id,
    updated_at = now()
  returning id into v_repository_id;

  return v_repository_id;
end;
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
  v_code_change_id uuid;
  v_execution_id uuid;
  v_token text;
  v_token_hash text;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if btrim(coalesce(p_branch, '')) = '' then
    raise exception 'branch required' using errcode = '22023';
  end if;

  select a.id
  into v_action_id
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
    and a.status = 'ready'
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
      'branch', btrim(p_branch)
    )
  );

  update public.action_contracts
  set status = 'active', updated_at = now()
  where id = v_action_id;

  return jsonb_build_object(
    'runtimeExecutionId', v_execution_id,
    'codeChangeId', v_code_change_id,
    'actionId', v_action_id,
    'capabilityToken', v_token
  );
end;
$$;

create or replace function public.workflow_complete_code_execution(
  p_runtime_execution_id uuid,
  p_capability_token text,
  p_code_change_id uuid,
  p_branch text,
  p_base_commit text,
  p_head_commit text,
  p_result jsonb,
  p_verification_details jsonb
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
  if jsonb_typeof(p_result) <> 'object'
     or jsonb_typeof(p_verification_details) <> 'object'
     or btrim(coalesce(p_branch, '')) = ''
     or btrim(coalesce(p_base_commit, '')) = ''
     or btrim(coalesce(p_head_commit, '')) = '' then
    raise exception 'invalid code execution result' using errcode = '22023';
  end if;

  select re.project_id, re.action_id, re.context_revision, a.objective, re.state
  into v_project_id, v_action_id, v_context_revision, v_action_objective, v_current_state
  from public.runtime_executions re
  join public.action_contracts a on a.id = re.action_id
  join public.code_changes cc
    on cc.id = p_code_change_id
   and cc.action_id = re.action_id
   and cc.project_id = re.project_id
  where re.id = p_runtime_execution_id
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
  for update of re, a, cc;

  if v_project_id is null then
    raise exception 'invalid or expired workflow capability' using errcode = '42501';
  end if;

  if v_current_state = 'succeeded' then
    return;
  end if;

  if v_current_state not in ('queued','preparing','running','verifying','reconciling') then
    raise exception 'code execution cannot complete from current state' using errcode = '55000';
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
    'sandbox build/test verification',
    'The bounded code change passed required local build and test checks before push.',
    p_verification_details
  )
  returning id into v_verification_id;

  update public.code_changes
  set
    branch = btrim(p_branch),
    base_commit = btrim(p_base_commit),
    head_commit = btrim(p_head_commit),
    status = 'pushed'
  where id = p_code_change_id;

  update public.runtime_executions
  set
    state = 'succeeded',
    result = p_result,
    completed_at = now()
  where id = p_runtime_execution_id;

  if not exists (
    select 1 from public.execution_records er
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

create or replace function public.workflow_cancel_code_execution(
  p_runtime_execution_id uuid,
  p_capability_token text,
  p_code_change_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action_id uuid;
  v_current_state text;
begin
  select re.action_id, re.state
  into v_action_id, v_current_state
  from public.runtime_executions re
  join public.code_changes cc
    on cc.id = p_code_change_id
   and cc.action_id = re.action_id
  where re.id = p_runtime_execution_id
    and re.workflow_access_hash = encode(extensions.digest(p_capability_token, 'sha256'), 'hex')
    and re.workflow_access_expires_at > now()
    and re.cancel_requested_at is not null
  for update of re, cc;

  if v_action_id is null then
    raise exception 'code execution is not cancellable with this capability' using errcode = '42501';
  end if;

  if v_current_state = 'cancelled' then
    return;
  end if;

  update public.runtime_executions
  set state = 'cancelled', completed_at = now()
  where id = p_runtime_execution_id;

  update public.code_changes
  set status = 'cancelled'
  where id = p_code_change_id;

  update public.action_contracts
  set status = 'ready', updated_at = now()
  where id = v_action_id;
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
  v_current_state text;
begin
  select re.action_id, re.state
  into v_action_id, v_current_state
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

  update public.runtime_executions
  set
    state = 'failed',
    error_code = 'code_execution_failed',
    error_message = left(coalesce(p_error_message, 'Code execution failed.'), 2000),
    completed_at = now()
  where id = p_runtime_execution_id;

  update public.code_changes
  set status = 'failed'
  where id = p_code_change_id;

  update public.action_contracts
  set status = 'ready', updated_at = now()
  where id = v_action_id;
end;
$$;

revoke all on function public.upsert_github_installation(uuid,text,text,jsonb,jsonb) from public, anon;
revoke all on function public.register_project_repository(uuid,uuid,text,text,text,text) from public, anon;
revoke all on function public.create_code_execution(uuid,bigint,uuid,text) from public, anon;

grant execute on function public.upsert_github_installation(uuid,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.register_project_repository(uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.create_code_execution(uuid,bigint,uuid,text) to authenticated;

revoke all on function public.workflow_complete_code_execution(uuid,text,uuid,text,text,text,jsonb,jsonb) from public;
revoke all on function public.workflow_cancel_code_execution(uuid,text,uuid) from public;
revoke all on function public.workflow_fail_code_execution(uuid,text,uuid,text) from public;

grant execute on function public.workflow_complete_code_execution(uuid,text,uuid,text,text,text,jsonb,jsonb) to anon, authenticated;
grant execute on function public.workflow_cancel_code_execution(uuid,text,uuid) to anon, authenticated;
grant execute on function public.workflow_fail_code_execution(uuid,text,uuid,text) to anon, authenticated;
