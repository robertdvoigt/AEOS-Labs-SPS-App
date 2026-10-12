begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('99999999-9999-4999-8999-999999999999', 'increment4-owner@example.test'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'increment4-other@example.test');

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select public.create_project_with_profile(
  'Increment 4 DB Test',
  '{"status":"active","mission":"Test durability","successStandard":"Durable job completes"}'::jsonb,
  '{"productModel":{"status":"confirmed","requirements":[]}}'::jsonb
);

create temp table probe_context as
select public.create_durability_probe(
  (select id from public.projects where name = 'Increment 4 DB Test'),
  0
) as value;

grant select on probe_context to authenticated, anon;

select results_eq(
  $$ select state from public.runtime_executions where project_id = (
    select id from public.projects where name = 'Increment 4 DB Test'
  ) $$,
  array['queued'::text],
  'durability probe starts queued'
);

select results_eq(
  $$ select count(*) from public.runtime_checkpoints where runtime_execution_id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context
  ) $$,
  array[1::bigint],
  'initial checkpoint is persisted'
);

select throws_ok(
  $$ select public.create_durability_probe(
    (select id from public.projects where name = 'Increment 4 DB Test'),
    0
  ) $$,
  '55000',
  'durability probe already active',
  'duplicate active durability probe is rejected'
);

select lives_ok(
  $$ select public.bind_durable_workflow(
    (select (value->>'runtimeExecutionId')::uuid from probe_context),
    'wfr_test_1'
  ) $$,
  'owner can bind workflow run identity'
);

select results_eq(
  $$ select workflow_run_id from public.runtime_executions where id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context
  ) $$,
  array['wfr_test_1'::text],
  'workflow run identity is stored'
);

set local role anon;
set local request.jwt.claim.sub = '';

select lives_ok(
  $$ select public.workflow_runtime_checkpoint(
    (select (value->>'runtimeExecutionId')::uuid from probe_context),
    (select value->>'capabilityToken' from probe_context),
    1,
    'started',
    '{"message":"workflow started"}'::jsonb
  ) $$,
  'workflow capability can write a scoped checkpoint without user session'
);

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select results_eq(
  $ select count(*) from public.runtime_checkpoints where runtime_execution_id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context
  ) $,
  array[2::bigint],
  'workflow checkpoint is durable'
);

set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.workflow_runtime_checkpoint(
    (select (value->>'runtimeExecutionId')::uuid from probe_context),
    'wrong-token',
    2,
    'invalid',
    '{}'::jsonb
  ) $$,
  '42501',
  'invalid or expired workflow capability',
  'invalid workflow capability is rejected'
);

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select lives_ok(
  $$ select public.request_cancel_runtime_execution(
    (select (value->>'runtimeExecutionId')::uuid from probe_context)
  ) $$,
  'owner can request cancellation'
);

set local role anon;
set local request.jwt.claim.sub = '';

select results_eq(
  $$ select (public.workflow_runtime_control(
    (select (value->>'runtimeExecutionId')::uuid from probe_context),
    (select value->>'capabilityToken' from probe_context)
  )->>'cancelRequested')::boolean $$,
  array[true],
  'workflow observes cancellation request'
);

select lives_ok(
  $ select public.workflow_cancel_durability_probe(
    (select (value->>'runtimeExecutionId')::uuid from probe_context),
    (select value->>'capabilityToken' from probe_context)
  ) $,
  'workflow cancels at a safe boundary'
);

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select results_eq(
  $$ select state from public.runtime_executions where id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context
  ) $$,
  array['cancelled'::text],
  'cancelled workflow execution is persisted'
);

select results_eq(
  $$ select count(*) from public.execution_records where runtime_execution_id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context
  ) and outcome = 'cancelled' $$,
  array[1::bigint],
  'cancelled workflow creates an execution record'
);

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

create temp table probe_context_2 as
select public.create_durability_probe(
  (select id from public.projects where name = 'Increment 4 DB Test'),
  0
) as value;
grant select on probe_context_2 to authenticated, anon;

select public.bind_durable_workflow(
  (select (value->>'runtimeExecutionId')::uuid from probe_context_2),
  'wfr_test_2'
);

set local role anon;
set local request.jwt.claim.sub = '';

select public.workflow_runtime_checkpoint(
  (select (value->>'runtimeExecutionId')::uuid from probe_context_2),
  (select value->>'capabilityToken' from probe_context_2),
  1,
  'started',
  '{}'::jsonb
);

select public.workflow_runtime_checkpoint(
  (select (value->>'runtimeExecutionId')::uuid from probe_context_2),
  (select value->>'capabilityToken' from probe_context_2),
  2,
  'resumed',
  '{"resumed":true}'::jsonb
);

select lives_ok(
  $ select public.workflow_complete_durability_probe(
    (select (value->>'runtimeExecutionId')::uuid from probe_context_2),
    (select value->>'capabilityToken' from probe_context_2),
    '{"completed":true,"survivedRequestBoundary":true}'::jsonb
  ) $,
  'workflow can complete using only its scoped capability'
);

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select results_eq(
  $$ select state from public.runtime_executions where id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context_2
  ) $$,
  array['succeeded'::text],
  'durable workflow completion is persisted'
);

select results_eq(
  $$ select status from public.verification_results where runtime_execution_id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context_2
  ) $$,
  array['pass'::text],
  'durability completion is verified'
);

select results_eq(
  $$ select outcome from public.execution_records where runtime_execution_id = (
    select (value->>'runtimeExecutionId')::uuid from probe_context_2
  ) $$,
  array['succeeded'::text],
  'durability completion creates a separate execution record'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 4 DB Test'
  ) $$,
  array[0::bigint],
  'operational durability probe does not mutate canonical project revision'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select results_eq(
  $$ select count(*) from public.runtime_checkpoints $$,
  array[0::bigint],
  'other user cannot read owner Runtime checkpoints'
);

select * from finish();
rollback;
