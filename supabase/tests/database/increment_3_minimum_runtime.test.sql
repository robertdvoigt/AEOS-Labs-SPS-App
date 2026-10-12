begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('77777777-7777-4777-8777-777777777777', 'increment3-owner@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'increment3-other@example.test');

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';

select public.create_project_with_profile(
  'Increment 3 DB Test',
  '{"status":"active","mission":null,"successStandard":null}'::jsonb,
  '{"productModel":{"status":"provisional"}}'::jsonb
);

select public.establish_genesis_and_nba(
  (select id from public.projects where name = 'Increment 3 DB Test'),
  0,
  '{"status":"active","mission":"Build useful software","successStandard":"Core workflow verified","targetCondition":"Working product","constraints":[],"authorityBoundaries":[],"genesis":{"status":"established"}}'::jsonb,
  '{"productModel":{"status":"provisional","intendedUser":"Builder","problemOpportunity":"Needs coherent execution","promisedMinimumValue":"Verified progress","productHypothesis":"AEOS coordinates work","criticalWorkflow":"Goal to result","mvpScope":["Runtime"],"mvpExclusions":[],"requirements":[]}}'::jsonb,
  'Confirm MVP',
  'Confirm scope.',
  '{"type":"decision"}'::jsonb,
  '{"confirmed":true}'::jsonb,
  'Confirm.',
  'Owner authority.',
  '[{"value":"confirm","label":"Confirm"}]'::jsonb
);

select public.confirm_mvp_direction(
  (select id from public.projects where name = 'Increment 3 DB Test'),
  1,
  '{"productModel":{"status":"confirmed","intendedUser":"Builder","problemOpportunity":"Needs coherent execution","promisedMinimumValue":"Verified progress","productHypothesis":"AEOS coordinates work","criticalWorkflow":"Goal to result","mvpScope":["Runtime"],"mvpExclusions":[],"requirements":[]}}'::jsonb,
  'Define build-ready requirements for the confirmed MVP',
  'Translate scope into requirements.',
  '{"type":"requirements_and_validation_plan"}'::jsonb,
  '{"requirementsDefined":true,"verificationPlanDefined":true}'::jsonb
);

select lives_ok(
  $$ select public.start_runtime_execution(
    (select current_nba_action_id from public.project_profiles where project_id = (
      select id from public.projects where name = 'Increment 3 DB Test'
    )),
    2,
    'deep',
    'openai',
    'gpt-test'
  ) $$,
  'owner can start the current AEOS-owned action'
);

select results_eq(
  $$ select state from public.runtime_executions
     where project_id = (select id from public.projects where name = 'Increment 3 DB Test') $$,
  array['running'::text],
  'runtime execution starts in running state'
);

select throws_ok(
  $$ select public.start_runtime_execution(
    (select current_nba_action_id from public.project_profiles where project_id = (
      select id from public.projects where name = 'Increment 3 DB Test'
    )),
    2,
    'deep',
    'openai',
    'gpt-test'
  ) $$,
  '55000',
  'action is not current and executable',
  'active action cannot be started a second time'
);

select lives_ok(
  $$ select public.complete_runtime_analysis(
    (select id from public.runtime_executions where project_id = (
      select id from public.projects where name = 'Increment 3 DB Test'
    )),
    2,
    'resp_test',
    '{"summary":"Requirements ready","requirements":[{"id":"REQ-1","title":"Runtime","description":"Execute action","acceptanceCriteria":["Result verified"],"verificationMethods":["Deterministic schema check"],"rationale":"Core value"}],"assumptions":[],"limitations":[]}'::jsonb,
    '{"inputTokens":100,"outputTokens":50,"totalTokens":150}'::jsonb,
    '[]'::jsonb,
    'pass',
    'deterministic structured-output validation',
    'Requirements and verification methods are present.',
    '{"requirementsDefined":true,"verificationPlanDefined":true}'::jsonb,
    '{"productModel":{"status":"confirmed","intendedUser":"Builder","problemOpportunity":"Needs coherent execution","promisedMinimumValue":"Verified progress","productHypothesis":"AEOS coordinates work","criticalWorkflow":"Goal to result","mvpScope":["Runtime"],"mvpExclusions":[],"requirements":[{"id":"REQ-1","title":"Runtime","description":"Execute action","acceptanceCriteria":["Result verified"],"verificationMethods":["Deterministic schema check"],"rationale":"Core value"}]}}'::jsonb,
    'build',
    'Execute the first build-ready MVP increment',
    'Implement the first bounded build unit and verify it.',
    '{"type":"verified_build_increment"}'::jsonb,
    '{"buildImplemented":true,"verificationPassed":true}'::jsonb,
    '["code_execution","repository_write","tests"]'::jsonb
  ) $$,
  'verified Runtime result reconciles atomically'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 3 DB Test'
  ) $$,
  array[3::bigint],
  'successful Runtime reconciliation advances revision'
);

select results_eq(
  $$ select state from public.runtime_executions
     where project_id = (select id from public.projects where name = 'Increment 3 DB Test') $$,
  array['succeeded'::text],
  'runtime execution is persisted as succeeded'
);

select results_eq(
  $$ select status from public.verification_results
     where project_id = (select id from public.projects where name = 'Increment 3 DB Test') $$,
  array['pass'::text],
  'verification result is persisted'
);

select results_eq(
  $$ select count(*) from public.execution_records
     where project_id = (select id from public.projects where name = 'Increment 3 DB Test')
       and outcome = 'succeeded' $$,
  array[1::bigint],
  'execution history is persisted separately'
);

select results_eq(
  $$ select a.owner || ':' || a.status || ':' || a.action_type
     from public.project_profiles pp
     join public.action_contracts a on a.id = pp.current_nba_action_id
     where pp.project_id = (select id from public.projects where name = 'Increment 3 DB Test') $$,
  array['aeos:ready:build'::text],
  'successful Runtime result advances to exactly one new AEOS-owned NBA'
);

select results_eq(
  $$ select jsonb_array_length(pp.specialization_state->'productModel'->'requirements')
     from public.project_profiles pp
     where pp.project_id = (select id from public.projects where name = 'Increment 3 DB Test') $$,
  array[1],
  'verified requirements are reconciled into canonical specialization state'
);

set local request.jwt.claim.sub = '88888888-8888-4888-8888-888888888888';

select throws_ok(
  $$ select public.start_runtime_execution(
    (select current_nba_action_id from public.project_profiles where project_id = (
      select id from public.projects where name = 'Increment 3 DB Test'
    )),
    3,
    'deep',
    'openai',
    'gpt-test'
  ) $$,
  '55000',
  'action is not current and executable',
  'other user cannot discover or start owner Runtime action'
);

set local request.jwt.claim.sub = '77777777-7777-4777-8777-777777777777';

select public.start_runtime_execution(
  (select current_nba_action_id from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 3 DB Test'
  )),
  3,
  'deep',
  'openai',
  'gpt-test'
);

select lives_ok(
  $$ select public.fail_runtime_execution(
    (select id from public.runtime_executions
     where project_id = (select id from public.projects where name = 'Increment 3 DB Test')
       and state = 'running'
     order by created_at desc limit 1),
    'provider_unavailable',
    'Provider unavailable',
    true,
    '{}'::jsonb,
    '{}'::jsonb,
    '["retry later"]'::jsonb
  ) $$,
  'failed execution is recorded without changing canonical revision'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 3 DB Test'
  ) $$,
  array[3::bigint],
  'failed Runtime attempt does not alter canonical project state'
);

set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.start_runtime_execution(gen_random_uuid(), 0, 'deep', 'openai', 'gpt-test') $$,
  '42501',
  null,
  'anonymous role cannot start Runtime execution'
);

select * from finish();
rollback;
