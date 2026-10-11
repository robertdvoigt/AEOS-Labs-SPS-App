create or replace function public.create_project_with_profile(
  p_name text,
  p_core_state jsonb default '{}'::jsonb,
  p_specialization_state jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project_id uuid;
  v_name text := btrim(p_name);
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 160 then
    raise exception 'invalid project name' using errcode = '22023';
  end if;

  if jsonb_typeof(p_core_state) <> 'object' or jsonb_typeof(p_specialization_state) <> 'object' then
    raise exception 'project state must be JSON objects' using errcode = '22023';
  end if;

  insert into public.projects (
    owner_user_id,
    name,
    status,
    core_version,
    software_product_version,
    runtime_version
  )
  values (
    v_user_id,
    v_name,
    'active',
    '1.1',
    '1.1',
    '1.0'
  )
  returning id into v_project_id;

  insert into public.project_profiles (
    project_id,
    revision,
    core_state,
    specialization_state,
    updated_by,
    source_revision_parent
  )
  values (
    v_project_id,
    0,
    p_core_state,
    p_specialization_state,
    v_user_id,
    null
  );

  insert into public.project_profile_revisions (
    project_id,
    revision,
    core_state,
    specialization_state,
    change_summary
  )
  values (
    v_project_id,
    0,
    p_core_state,
    p_specialization_state,
    'Project created'
  );

  return v_project_id;
end;
$$;

create or replace function public.reconcile_project_state(
  p_project_id uuid,
  p_expected_revision bigint,
  p_core_state jsonb,
  p_specialization_state jsonb,
  p_change_summary text default null,
  p_current_nba_action_id uuid default null,
  p_action_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision bigint;
  v_new_revision bigint;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.owner_user_id = v_user_id
  ) then
    raise exception 'project access denied' using errcode = '42501';
  end if;

  if jsonb_typeof(p_core_state) <> 'object' or jsonb_typeof(p_specialization_state) <> 'object' then
    raise exception 'project state must be JSON objects' using errcode = '22023';
  end if;

  if p_current_nba_action_id is not null and not exists (
    select 1
    from public.action_contracts a
    where a.id = p_current_nba_action_id
      and a.project_id = p_project_id
  ) then
    raise exception 'NBA action does not belong to project' using errcode = '23503';
  end if;

  if p_action_id is not null and not exists (
    select 1
    from public.action_contracts a
    where a.id = p_action_id
      and a.project_id = p_project_id
  ) then
    raise exception 'action does not belong to project' using errcode = '23503';
  end if;

  select pp.revision
  into v_current_revision
  from public.project_profiles pp
  where pp.project_id = p_project_id
  for update;

  if v_current_revision is null then
    raise exception 'project profile missing' using errcode = 'P0002';
  end if;

  if v_current_revision <> p_expected_revision then
    raise exception 'stale project revision' using errcode = '40001';
  end if;

  v_new_revision := v_current_revision + 1;

  update public.project_profiles
  set
    revision = v_new_revision,
    core_state = p_core_state,
    specialization_state = p_specialization_state,
    current_nba_action_id = p_current_nba_action_id,
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
    p_core_state,
    p_specialization_state,
    p_change_summary,
    p_action_id
  );

  return v_new_revision;
end;
$$;

revoke all on function public.create_project_with_profile(text, jsonb, jsonb) from public;
revoke all on function public.reconcile_project_state(uuid, bigint, jsonb, jsonb, text, uuid, uuid) from public;

grant execute on function public.create_project_with_profile(text, jsonb, jsonb) to authenticated;
grant execute on function public.reconcile_project_state(uuid, bigint, jsonb, jsonb, text, uuid, uuid) to authenticated;

-- Project creation must always create canonical profile state atomically.
revoke insert on public.projects from authenticated;
