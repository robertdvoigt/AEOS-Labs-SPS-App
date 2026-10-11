begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'action_contracts', 'action contracts exist');
select has_table('public', 'runtime_executions', 'runtime executions exist');
select has_table('public', 'runtime_steps', 'runtime steps exist');
select has_table('public', 'verification_results', 'verification results exist');
select has_table('public', 'execution_records', 'execution records exist');

insert into auth.users (id, email) values
  ('33333333-3333-4333-8333-333333333333', 'runtime-owner@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'runtime-other@example.test');

insert into public.projects (id, owner_user_id, name) values
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 'Runtime project');

insert into public.project_profiles (project_id, revision)
values ('55555555-5555-4555-8555-555555555555', 0);

insert into public.action_contracts (
  id, project_id, profile_revision, title, objective, owner, status
) values (
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  0, 'Runtime smoke', 'Verify runtime state', 'aeos', 'ready'
);

insert into public.runtime_executions (
  id, project_id, action_id, context_revision, state
) values (
  '77777777-7777-4777-8777-777777777777',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  0, 'succeeded'
);

insert into public.runtime_steps (
  id, runtime_execution_id, step_key, kind, state
) values (
  '88888888-8888-4888-8888-888888888888',
  '77777777-7777-4777-8777-777777777777',
  'execute', 'provider', 'succeeded'
);

insert into public.verification_results (
  id, project_id, action_id, runtime_execution_id, status, verifier_kind, method, summary
) values (
  '99999999-9999-4999-8999-999999999999',
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  'pass', 'deterministic', 'test', 'verified'
);

insert into public.execution_records (
  project_id, action_id, runtime_execution_id, verification_result_id,
  outcome, profile_revision_before, profile_revision_after
) values (
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777',
  '99999999-9999-4999-8999-999999999999',
  'no_change', 0, 0
);

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select results_eq($$select count(*) from public.action_contracts$$, array[1::bigint], 'owner sees action contract');
select results_eq($$select count(*) from public.runtime_executions$$, array[1::bigint], 'owner sees runtime execution');
select results_eq($$select count(*) from public.runtime_steps$$, array[1::bigint], 'owner sees runtime step');
select results_eq($$select count(*) from public.verification_results$$, array[1::bigint], 'owner sees verification result');
select results_eq($$select count(*) from public.execution_records$$, array[1::bigint], 'owner sees execution record');

set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

select results_eq($$select count(*) from public.action_contracts$$, array[0::bigint], 'other user cannot see action contract');
select results_eq($$select count(*) from public.runtime_executions$$, array[0::bigint], 'other user cannot see runtime execution');
select results_eq($$select count(*) from public.runtime_steps$$, array[0::bigint], 'other user cannot see runtime step');
select results_eq($$select count(*) from public.verification_results$$, array[0::bigint], 'other user cannot see verification result');
select results_eq($$select count(*) from public.execution_records$$, array[0::bigint], 'other user cannot see execution record');

select * from finish();
rollback;
