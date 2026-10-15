begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'runtime-v12-owner@example.test');

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select public.create_project_with_profile(
  'Runtime v1.2 Adaptive Test',
  '{"status":"active","mission":"Verify adaptive execution control"}'::jsonb,
  '{"productModel":{"status":"confirmed"}}'::jsonb
);

reset role;

insert into public.action_contracts (
  project_id, profile_revision, action_type, title, objective, owner, status,
  expected_result, acceptance_condition, required_capabilities,
  verification_requirements, authority_requirements, input, created_by
)
select
  p.id, 0, 'build', 'Adaptive build', 'Execute one bounded Build Unit.', 'aeos', 'ready',
  '{}'::jsonb, '{"verified":true}'::jsonb, '["code_execution"]'::jsonb,
  '["verify failure adaptation"]'::jsonb, '{}'::jsonb,
  '{"buildUnit":{"outcome":"One bounded verified result","scope":"Adaptive Runtime test only","acceptance":{"verified":true},"dependencies":[],"verification":["database"]}}'::jsonb,
  p.owner_user_id
from public.projects p
where p.name='Runtime v1.2 Adaptive Test';

update public.project_profiles pp
set current_nba_action_id=a.id
from public.action_contracts a
join public.projects p on p.id=a.project_id
where pp.project_id=p.id and p.name='Runtime v1.2 Adaptive Test';

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

create temp table v12_connection as
select public.upsert_github_installation(
  (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
  'runtime-v12-owner','67890',
  '{"contents":"write","metadata":"read"}'::jsonb,
  '{"accountType":"User","login":"runtime-v12-owner"}'::jsonb
) as id;
grant select on v12_connection to authenticated, anon;

create temp table v12_repo as
select public.register_project_repository(
  (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
  (select id from v12_connection),
  'runtime-v12-owner','adaptive-repo','98760','main'
) as id;
grant select on v12_repo to authenticated, anon;

reset role;

update public.action_contracts
set input='{}'::jsonb
where id=(select current_nba_action_id from public.project_profiles
          where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test'));

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select throws_ok(
  $sql$ select public.create_code_execution(
    (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
    0,
    (select id from v12_repo),
    'aeos/adaptive/unbounded'
  ) $sql$,
  '55000',
  'bounded Build Unit required before software execution',
  'software execution requires a bounded Build Unit'
);

reset role;

update public.action_contracts
set input='{"buildUnit":{"outcome":"One bounded verified result","scope":"Adaptive Runtime test only","acceptance":{"verified":true},"dependencies":[],"verification":["database"]}}'::jsonb
where id=(select current_nba_action_id from public.project_profiles
          where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test'));

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

create temp table v12_first as
select public.create_code_execution(
  (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
  0,
  (select id from v12_repo),
  'aeos/adaptive/attempt-1'
) as value;
grant select on v12_first to authenticated, anon;

select results_eq(
  $$ select execution_strategy || ':' || strategy_revision::text
     from public.runtime_executions
     where id=(select (value->>'runtimeExecutionId')::uuid from v12_first) $$,
  array['sandbox_agent:1'::text],
  'initial execution records strategy identity'
);

set local role anon;
set local request.jwt.claim.sub = '';

select lives_ok(
  $$ select public.workflow_runtime_checkpoint(
    (select (value->>'runtimeExecutionId')::uuid from v12_first),
    (select value->>'capabilityToken' from v12_first),
    2,'agent_started','{"model":"test"}'::jsonb
  ) $$,
  'first attempt records agent phase'
);

select lives_ok(
  $$ select public.workflow_fail_code_execution(
    (select (value->>'runtimeExecutionId')::uuid from v12_first),
    (select value->>'capabilityToken' from v12_first),
    (select (value->>'codeChangeId')::uuid from v12_first),
    'Max turns (12) exceeded'
  ) $$,
  'first same-strategy failure is preserved'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select results_eq(
  $$ select failure_phase || ':' || failure_class || ':' || failure_signature
     from public.runtime_executions
     where id=(select (value->>'runtimeExecutionId')::uuid from v12_first) $$,
  array['agent_started:agent_budget:agent_started:agent_budget'::text],
  'failure phase, class, and signature are persisted'
);

select results_eq(
  $$ select status from public.action_contracts
     where id=(select current_nba_action_id from public.project_profiles
               where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')) $$,
  array['ready'::text],
  'one failure remains retryable'
);

create temp table v12_second as
select public.create_code_execution(
  (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
  0,
  (select id from v12_repo),
  'aeos/adaptive/attempt-2'
) as value;
grant select on v12_second to authenticated, anon;

set local role anon;
set local request.jwt.claim.sub = '';

select public.workflow_runtime_checkpoint(
  (select (value->>'runtimeExecutionId')::uuid from v12_second),
  (select value->>'capabilityToken' from v12_second),
  2,'agent_started','{"model":"test"}'::jsonb
);

select public.workflow_fail_code_execution(
  (select (value->>'runtimeExecutionId')::uuid from v12_second),
  (select value->>'capabilityToken' from v12_second),
  (select (value->>'codeChangeId')::uuid from v12_second),
  'Max turns (12) exceeded'
);

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select results_eq(
  $$ select status from public.action_contracts
     where id=(select current_nba_action_id from public.project_profiles
               where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')) $$,
  array['blocked'::text],
  'second materially similar failure blocks unchanged retry'
);

select results_eq(
  $$ select failure_class || ':' || repeated_failure_count::text || ':' || disposition
     from public.execution_adaptation_reviews
     where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')
       and status='required' $$,
  array['agent_budget:2:change_method'::text],
  'repeated failure creates required adaptive execution review'
);

select results_eq(
  $$ select adaptation_review_required::text
     from public.runtime_executions
     where id=(select (value->>'runtimeExecutionId')::uuid from v12_second) $$,
  array['true'::text],
  'triggering execution is marked for adaptive review'
);

select throws_ok(
  $$ select public.create_code_execution(
    (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
    0,
    (select id from v12_repo),
    'aeos/adaptive/unchanged'
  ) $$,
  '55000',
  'adaptive execution review required before another attempt',
  'unchanged retry is prohibited while review is required'
);

select throws_ok(
  $$ select public.resolve_execution_adaptation_review(
    (select current_nba_action_id from public.project_profiles
     where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')),
    'plan_then_execute',
    'change_method',
    'Switch method after repeated agent budget exhaustion.',
    '{}'::jsonb
  ) $$,
  '55000',
  'material execution change required before retry',
  'review cannot resolve without a material change'
);

select lives_ok(
  $$ select public.resolve_execution_adaptation_review(
    (select current_nba_action_id from public.project_profiles
     where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')),
    'plan_then_execute',
    'change_method',
    'Switch method after repeated agent budget exhaustion.',
    '{"executor":"plan_then_execute","reason":"agent_budget"}'::jsonb
  ) $$,
  'material strategy change resolves adaptive review'
);

select results_eq(
  $$ select strategy_key || ':' || strategy_revision::text
     from public.action_execution_strategies
     where action_id=(select current_nba_action_id from public.project_profiles
                      where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')) $$,
  array['plan_then_execute:2'::text],
  'resolved review advances execution strategy revision'
);

select results_eq(
  $$ select status from public.action_contracts
     where id=(select current_nba_action_id from public.project_profiles
               where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test')) $$,
  array['ready'::text],
  'action becomes ready only after strategy change is recorded'
);

create temp table v12_third as
select public.create_code_execution(
  (select id from public.projects where name='Runtime v1.2 Adaptive Test'),
  0,
  (select id from v12_repo),
  'aeos/adaptive/attempt-3'
) as value;

select results_eq(
  $$ select execution_strategy || ':' || strategy_revision::text
     from public.runtime_executions
     where id=(select (value->>'runtimeExecutionId')::uuid from v12_third) $$,
  array['plan_then_execute:2'::text],
  'next attempt uses the changed strategy identity'
);

select results_eq(
  $$ select revision from public.project_profiles
     where project_id=(select id from public.projects where name='Runtime v1.2 Adaptive Test') $$,
  array[0::bigint],
  'adaptive Runtime control does not mutate canonical project revision'
);

select * from finish();
rollback;
