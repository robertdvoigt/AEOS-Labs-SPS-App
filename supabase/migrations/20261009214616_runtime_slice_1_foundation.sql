create table public.action_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_revision bigint not null check (profile_revision >= 0),
  parent_action_id uuid references public.action_contracts(id) on delete set null,
  action_type text not null default 'runtime',
  title text not null check (char_length(title) between 1 and 200),
  objective text not null,
  owner text not null check (owner in ('aeos','user','shared')),
  status text not null default 'proposed'
    check (status in ('proposed','ready','active','blocked','completed','cancelled','superseded')),
  expected_result jsonb not null default '{}'::jsonb,
  acceptance_condition jsonb not null default '{}'::jsonb,
  required_capabilities jsonb not null default '[]'::jsonb,
  verification_requirements jsonb not null default '[]'::jsonb,
  authority_requirements jsonb not null default '{}'::jsonb,
  input jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index action_contracts_project_status_idx
  on public.action_contracts(project_id, status, created_at desc);
create index action_contracts_parent_action_idx
  on public.action_contracts(parent_action_id)
  where parent_action_id is not null;

create table public.runtime_executions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action_id uuid not null references public.action_contracts(id) on delete cascade,
  attempt integer not null default 1 check (attempt > 0),
  state text not null default 'queued'
    check (state in (
      'queued','preparing','running','waiting_for_human','waiting_for_external',
      'verifying','reconciling','succeeded','failed','cancelled','inconclusive'
    )),
  context_revision bigint not null check (context_revision >= 0),
  model_class text check (model_class is null or model_class in ('fast','standard','deep','critical')),
  provider text,
  model text,
  provider_response_id text,
  workflow_run_id text,
  result jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  usage jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  cancel_requested_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(action_id, attempt)
);

create index runtime_executions_project_state_idx
  on public.runtime_executions(project_id, state, created_at desc);
create index runtime_executions_action_idx
  on public.runtime_executions(action_id, attempt desc);

create table public.runtime_steps (
  id uuid primary key default gen_random_uuid(),
  runtime_execution_id uuid not null references public.runtime_executions(id) on delete cascade,
  step_key text not null,
  sequence integer not null default 0 check (sequence >= 0),
  attempt integer not null default 1 check (attempt > 0),
  kind text not null,
  state text not null default 'queued'
    check (state in ('queued','running','waiting','succeeded','failed','cancelled','inconclusive')),
  external_effect_state text not null default 'none'
    check (external_effect_state in ('none','planned','outcome_unknown','confirmed_failed','confirmed_succeeded')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(runtime_execution_id, step_key, attempt)
);

create index runtime_steps_execution_sequence_idx
  on public.runtime_steps(runtime_execution_id, sequence, attempt);

create table public.verification_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action_id uuid not null references public.action_contracts(id) on delete cascade,
  runtime_execution_id uuid not null references public.runtime_executions(id) on delete cascade,
  status text not null
    check (status in ('pass','pass_with_known_limitation','fail','inconclusive')),
  verifier_kind text not null
    check (verifier_kind in ('deterministic','model','human','composite')),
  method text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index verification_results_execution_idx
  on public.verification_results(runtime_execution_id, created_at desc);

create table public.execution_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action_id uuid not null references public.action_contracts(id) on delete cascade,
  runtime_execution_id uuid not null references public.runtime_executions(id) on delete cascade,
  verification_result_id uuid references public.verification_results(id) on delete set null,
  outcome text not null
    check (outcome in ('succeeded','failed','blocked','inconclusive','cancelled','no_change')),
  expected_contribution text,
  actual_result jsonb not null default '{}'::jsonb,
  profile_revision_before bigint not null check (profile_revision_before >= 0),
  profile_revision_after bigint check (profile_revision_after is null or profile_revision_after >= profile_revision_before),
  limitations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index execution_records_project_created_idx
  on public.execution_records(project_id, created_at desc);
create index execution_records_action_idx
  on public.execution_records(action_id, created_at desc);

alter table public.project_profiles
  add constraint project_profiles_current_nba_action_id_fkey
  foreign key (current_nba_action_id)
  references public.action_contracts(id)
  on delete set null;

alter table public.project_profile_revisions
  add constraint project_profile_revisions_action_id_fkey
  foreign key (action_id)
  references public.action_contracts(id)
  on delete set null;

alter table public.action_contracts enable row level security;
alter table public.runtime_executions enable row level security;
alter table public.runtime_steps enable row level security;
alter table public.verification_results enable row level security;
alter table public.execution_records enable row level security;

revoke all on public.action_contracts from anon, authenticated;
revoke all on public.runtime_executions from anon, authenticated;
revoke all on public.runtime_steps from anon, authenticated;
revoke all on public.verification_results from anon, authenticated;
revoke all on public.execution_records from anon, authenticated;

grant select on public.action_contracts to authenticated;
grant select on public.runtime_executions to authenticated;
grant select on public.runtime_steps to authenticated;
grant select on public.verification_results to authenticated;
grant select on public.execution_records to authenticated;

grant select, insert, update, delete on public.action_contracts to service_role;
grant select, insert, update, delete on public.runtime_executions to service_role;
grant select, insert, update, delete on public.runtime_steps to service_role;
grant select, insert, update, delete on public.verification_results to service_role;
grant select, insert, update, delete on public.execution_records to service_role;

create policy "action_contracts_select_own"
on public.action_contracts for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = action_contracts.project_id
    and p.owner_user_id = (select auth.uid())
));

create policy "runtime_executions_select_own"
on public.runtime_executions for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = runtime_executions.project_id
    and p.owner_user_id = (select auth.uid())
));

create policy "runtime_steps_select_own"
on public.runtime_steps for select to authenticated
using (exists (
  select 1
  from public.runtime_executions re
  join public.projects p on p.id = re.project_id
  where re.id = runtime_steps.runtime_execution_id
    and p.owner_user_id = (select auth.uid())
));

create policy "verification_results_select_own"
on public.verification_results for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = verification_results.project_id
    and p.owner_user_id = (select auth.uid())
));

create policy "execution_records_select_own"
on public.execution_records for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = execution_records.project_id
    and p.owner_user_id = (select auth.uid())
));
