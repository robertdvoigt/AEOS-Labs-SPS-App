begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'increment5-owner@example.test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'increment5-other@example.test');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select public.create_project_with_profile(
  'Increment 5 DB Test',
  '{"status":"active","mission":"Build in sandbox","successStandard":"Code verified"}'::jsonb,
  '{"productModel":{"status":"confirmed","requirements":[]}}'::jsonb
);

reset role;

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
select
  p.id,
  0,
  'build',
  'Execute first build unit',
  'Make a bounded code change and verify it locally.',
  'aeos',
  'ready',
  '{"type":"verified_build_increment"}'::jsonb,
  '{"buildImplemented":true,"verificationPassed":true}'::jsonb,
  '["code_execution","repository_write","tests","browser_verification"]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  p.owner_user_id
from public.projects p
where p.name = 'Increment 5 DB Test';

update public.project_profiles pp
set current_nba_action_id = a.id
from public.action_contracts a
join public.projects p on p.id = a.project_id
where pp.project_id = p.id
  and p.name = 'Increment 5 DB Test'
  and a.action_type = 'build';

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

create temp table source_context as
select
  public.upsert_github_installation(
    (select id from public.projects where name = 'Increment 5 DB Test'),
    'owner-account',
    '12345',
    '{"contents":"write","metadata":"read","repository_creation":"write"}'::jsonb,
    '{"accountType":"User","login":"owner-account"}'::jsonb
  ) as connection_id;

grant select on source_context to authenticated, anon;

select ok(
  (select connection_id is not null from source_context),
  'owner can register a GitHub installation'
);

create temp table repo_context as
select public.register_project_repository(
  (select id from public.projects where name = 'Increment 5 DB Test'),
  (select connection_id from source_context),
  'owner-account',
  'generated-product',
  '98765',
  'main'
) as repository_id;

grant select on repo_context to authenticated, anon;

select results_eq(
  $$ select owner || '/' || repo from public.repositories where id = (
    select repository_id from repo_context
  ) $$,
  array['owner-account/generated-product'::text],
  'project repository is persisted'
);

create temp table execution_context as
select public.create_code_execution(
  (select id from public.projects where name = 'Increment 5 DB Test'),
  0,
  (select repository_id from repo_context),
  'aeos/abcd1234/first-build'
) as value;

grant select on execution_context to authenticated, anon;

select results_eq(
  $$ select state from public.runtime_executions where id = (
    select (value->>'runtimeExecutionId')::uuid from execution_context
  ) $$,
  array['queued'::text],
  'code execution starts queued'
);

select results_eq(
  $$ select status from public.action_contracts where id = (
    select (value->>'actionId')::uuid from execution_context
  ) $$,
  array['active'::text],
  'current build NBA becomes active'
);

select results_eq(
  $$ select status from public.code_changes where id = (
    select (value->>'codeChangeId')::uuid from execution_context
  ) $$,
  array['planned'::text],
  'code change starts planned'
);

select throws_ok(
  $$ select public.create_code_execution(
    (select id from public.projects where name = 'Increment 5 DB Test'),
    0,
    (select repository_id from repo_context),
    'aeos/duplicate'
  ) $$,
  '55000',
  'build action is not current and executable',
  'active build cannot start a duplicate execution'
);

set local role anon;
set local request.jwt.claim.sub = '';

select lives_ok(
  $$ select public.workflow_runtime_checkpoint(
    (select (value->>'runtimeExecutionId')::uuid from execution_context),
    (select value->>'capabilityToken' from execution_context),
    1,
    'sandbox_created',
    '{"sandboxRef":"sbx_test"}'::jsonb
  ) $$,
  'detached workflow capability can checkpoint sandbox identity'
);

select throws_ok(
  $$ select public.workflow_complete_code_execution(
    (select (value->>'runtimeExecutionId')::uuid from execution_context),
    'wrong-token',
    (select (value->>'codeChangeId')::uuid from execution_context),
    'aeos/abcd1234/first-build',
    'base123',
    'head456',
    '{}'::jsonb,
    '{}'::jsonb
  ) $$,
  '42501',
  'invalid or expired workflow capability',
  'invalid workflow capability cannot complete code execution'
);

select lives_ok(
  $$ select public.workflow_complete_code_execution(
    (select (value->>'runtimeExecutionId')::uuid from execution_context),
    (select value->>'capabilityToken' from execution_context),
    (select (value->>'codeChangeId')::uuid from execution_context),
    'aeos/abcd1234/first-build',
    'base123',
    'head456',
    '{"sandboxRef":"sbx_test","commands":["pnpm test","pnpm build"]}'::jsonb,
    '{"testsPassed":true,"buildPassed":true}'::jsonb
  ) $$,
  'verified local code execution can complete with scoped workflow capability'
);

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select results_eq(
  $$ select status || ':' || base_commit || ':' || head_commit
     from public.code_changes where id = (
       select (value->>'codeChangeId')::uuid from execution_context
     ) $$,
  array['pushed:base123:head456'::text],
  'verified code change records pushed branch commits'
);

select results_eq(
  $$ select state from public.runtime_executions where id = (
    select (value->>'runtimeExecutionId')::uuid from execution_context
  ) $$,
  array['succeeded'::text],
  'sandbox code execution is recorded as succeeded'
);

select results_eq(
  $$ select status from public.verification_results where runtime_execution_id = (
    select (value->>'runtimeExecutionId')::uuid from execution_context
  ) $$,
  array['pass'::text],
  'sandbox build/test verification is persisted'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 5 DB Test'
  ) $$,
  array[0::bigint],
  'local code verification does not prematurely advance canonical revision'
);

select results_eq(
  $$ select status from public.action_contracts where id = (
    select (value->>'actionId')::uuid from execution_context
  ) $$,
  array['active'::text],
  'build action remains active until preview/browser verification'
);

set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

select results_eq(
  $$ select count(*) from public.repositories $$,
  array[0::bigint],
  'other user cannot read project repository'
);

select results_eq(
  $$ select count(*) from public.code_changes $$,
  array[0::bigint],
  'other user cannot read project code changes'
);

set local role anon;
set local request.jwt.claim.sub = '';

select ok(
  not has_function_privilege('anon', 'public.create_code_execution(uuid,bigint,uuid,text)', 'EXECUTE'),
  'anonymous role cannot start code execution'
);

select ok(
  not has_function_privilege('anon', 'public.register_project_repository(uuid,uuid,text,text,text,text)', 'EXECUTE'),
  'anonymous role cannot register project repository'
);

select * from finish();
rollback;
