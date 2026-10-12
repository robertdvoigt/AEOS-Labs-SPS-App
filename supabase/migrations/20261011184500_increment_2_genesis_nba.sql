create table public.human_dependencies (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.action_contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null default 'decision',
  prompt text not null,
  why_human text not null,
  options jsonb not null default '[]'::jsonb,
  status text not null default 'open'
    check (status in ('open','resolved','cancelled')),
  resolved_value jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index human_dependencies_project_status_idx
  on public.human_dependencies(project_id, status, created_at desc);

create unique index human_dependencies_one_open_per_action_idx
  on public.human_dependencies(action_id)
  where status = 'open';

alter table public.human_dependencies enable row level security;

revoke all on public.human_dependencies from anon, authenticated;
grant select on public.human_dependencies to authenticated;
grant select, insert, update, delete on public.human_dependencies to service_role;

create policy "human_dependencies_select_own"
on public.human_dependencies for select to authenticated
using (exists (
  select 1
  from public.projects p
  where p.id = human_dependencies.project_id
    and p.owner_user_id = (select auth.uid())
));

create or replace function public.establish_genesis_and_nba(
  p_project_id uuid,
  p_expected_revision bigint,
  p_core_state jsonb,
  p_specialization_state jsonb,
  p_nba_title text,
  p_nba_objective text,
  p_nba_expected_result jsonb,
  p_nba_acceptance_condition jsonb,
  p_human_prompt text,
  p_human_why text,
  p_human_options jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_current_action_id uuid;
  v_new_revision bigint;
  v_action_id uuid;
  v_dependency_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_core_state) <> 'object'
     or jsonb_typeof(p_specialization_state) <> 'object'
     or jsonb_typeof(p_nba_expected_result) <> 'object'
     or jsonb_typeof(p_nba_acceptance_condition) <> 'object'
     or jsonb_typeof(p_human_options) <> 'array' then
    raise exception 'invalid genesis payload' using errcode = '22023';
  end if;

  if btrim(coalesce(p_nba_title, '')) = ''
     or btrim(coalesce(p_nba_objective, '')) = ''
     or btrim(coalesce(p_human_prompt, '')) = ''
     or btrim(coalesce(p_human_why, '')) = '' then
    raise exception 'required NBA fields missing' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_user_id = v_user_id
  ) then
    raise exception 'project access denied' using errcode = '42501';
  end if;

  select pp.revision, pp.current_nba_action_id
  into v_current_revision, v_current_action_id
  from public.project_profiles pp
  where pp.project_id = p_project_id
  for update;

  if v_current_revision is null then
    raise exception 'project profile missing' using errcode = 'P0002';
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  if v_current_action_id is not null then
    update public.human_dependencies
    set
      status = 'cancelled',
      resolved_at = now()
    where action_id = v_current_action_id
      and project_id = p_project_id
      and status = 'open';

    update public.action_contracts
    set
      status = 'superseded',
      updated_at = now()
    where id = v_current_action_id
      and project_id = p_project_id
      and status in ('proposed','ready','active','blocked');
  end if;

  v_new_revision := v_current_revision + 1;

  insert into public.action_contracts (
    project_id,
    profile_revision,
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
    v_new_revision,
    'decision',
    btrim(p_nba_title),
    btrim(p_nba_objective),
    'user',
    'blocked',
    p_nba_expected_result,
    p_nba_acceptance_condition,
    '[]'::jsonb,
    '[]'::jsonb,
    jsonb_build_object(
      'requiresHuman', true,
      'reason', btrim(p_human_why)
    ),
    jsonb_build_object(
      'source', 'genesis',
      'projectRevision', v_new_revision
    ),
    v_user_id
  )
  returning id into v_action_id;

  insert into public.human_dependencies (
    action_id,
    project_id,
    kind,
    prompt,
    why_human,
    options,
    status
  )
  values (
    v_action_id,
    p_project_id,
    'decision',
    btrim(p_human_prompt),
    btrim(p_human_why),
    p_human_options,
    'open'
  )
  returning id into v_dependency_id;

  update public.project_profiles
  set
    revision = v_new_revision,
    core_state = p_core_state,
    specialization_state = p_specialization_state,
    current_nba_action_id = v_action_id,
    updated_at = now(),
    updated_by = v_user_id,
    source_revision_parent = v_current_revision
  where project_id = p_project_id;

  insert into public.project_profile_revisions (
    project_id,
    revision,
    core_state,
    specialization_state,
    change_summary
  )
  values (
    p_project_id,
    v_new_revision,
    p_core_state,
    p_specialization_state,
    'Establish Genesis and provisional MVP direction'
  );

  return jsonb_build_object(
    'revision', v_new_revision,
    'actionId', v_action_id,
    'humanDependencyId', v_dependency_id
  );
end;
$$;

create or replace function public.confirm_mvp_direction(
  p_project_id uuid,
  p_expected_revision bigint,
  p_specialization_state jsonb,
  p_next_nba_title text,
  p_next_nba_objective text,
  p_next_nba_expected_result jsonb,
  p_next_nba_acceptance_condition jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_current_action_id uuid;
  v_core_state jsonb;
  v_new_revision bigint;
  v_next_action_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_specialization_state) <> 'object'
     or jsonb_typeof(p_next_nba_expected_result) <> 'object'
     or jsonb_typeof(p_next_nba_acceptance_condition) <> 'object' then
    raise exception 'invalid confirmation payload' using errcode = '22023';
  end if;

  if btrim(coalesce(p_next_nba_title, '')) = ''
     or btrim(coalesce(p_next_nba_objective, '')) = '' then
    raise exception 'required next NBA fields missing' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_user_id = v_user_id
  ) then
    raise exception 'project access denied' using errcode = '42501';
  end if;

  select pp.revision, pp.current_nba_action_id, pp.core_state
  into v_current_revision, v_current_action_id, v_core_state
  from public.project_profiles pp
  where pp.project_id = p_project_id
  for update;

  if v_current_revision is null then
    raise exception 'project profile missing' using errcode = 'P0002';
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  if v_current_action_id is null or not exists (
    select 1
    from public.action_contracts a
    where a.id = v_current_action_id
      and a.project_id = p_project_id
      and a.owner = 'user'
      and a.status = 'blocked'
  ) then
    raise exception 'current NBA is not awaiting user confirmation' using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.human_dependencies hd
    where hd.action_id = v_current_action_id
      and hd.project_id = p_project_id
      and hd.status = 'open'
  ) then
    raise exception 'open human dependency missing' using errcode = '55000';
  end if;

  update public.human_dependencies
  set
    status = 'resolved',
    resolved_value = jsonb_build_object('decision', 'confirmed'),
    resolved_at = now()
  where action_id = v_current_action_id
    and project_id = p_project_id
    and status = 'open';

  update public.action_contracts
  set
    status = 'completed',
    updated_at = now()
  where id = v_current_action_id
    and project_id = p_project_id;

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
    p_project_id,
    v_new_revision,
    v_current_action_id,
    'analysis',
    btrim(p_next_nba_title),
    btrim(p_next_nba_objective),
    'aeos',
    'ready',
    p_next_nba_expected_result,
    p_next_nba_acceptance_condition,
    '[]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb,
    jsonb_build_object(
      'source', 'mvp_confirmation',
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
  where project_id = p_project_id;

  insert into public.project_profile_revisions (
    project_id,
    revision,
    core_state,
    specialization_state,
    change_summary,
    action_id
  )
  values (
    p_project_id,
    v_new_revision,
    v_core_state,
    p_specialization_state,
    'Confirm MVP direction and advance NBA',
    v_current_action_id
  );

  return jsonb_build_object(
    'revision', v_new_revision,
    'actionId', v_next_action_id
  );
end;
$$;

revoke all on function public.establish_genesis_and_nba(
  uuid,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text,text,jsonb
) from public;
revoke all on function public.confirm_mvp_direction(
  uuid,bigint,jsonb,text,text,jsonb,jsonb
) from public;

revoke execute on function public.establish_genesis_and_nba(
  uuid,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text,text,jsonb
) from anon;
revoke execute on function public.confirm_mvp_direction(
  uuid,bigint,jsonb,text,text,jsonb,jsonb
) from anon;

grant execute on function public.establish_genesis_and_nba(
  uuid,bigint,jsonb,jsonb,text,text,jsonb,jsonb,text,text,jsonb
) to authenticated;
grant execute on function public.confirm_mvp_direction(
  uuid,bigint,jsonb,text,text,jsonb,jsonb
) to authenticated;
