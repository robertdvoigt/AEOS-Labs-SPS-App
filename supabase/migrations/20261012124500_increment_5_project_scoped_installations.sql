drop index if exists public.integration_connections_github_installation_idx;

create unique index integration_connections_github_project_installation_idx
  on public.integration_connections(user_id, provider, installation_id, project_id)
  where installation_id is not null and project_id is not null;

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
  on conflict (user_id, provider, installation_id, project_id)
  where installation_id is not null and project_id is not null
  do update set
    external_account_id = excluded.external_account_id,
    scopes = excluded.scopes,
    metadata = excluded.metadata,
    status = 'active',
    updated_at = now()
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;
