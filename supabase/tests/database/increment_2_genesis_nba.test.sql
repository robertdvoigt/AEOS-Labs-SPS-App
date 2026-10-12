begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('55555555-5555-4555-8555-555555555555', 'increment2-owner@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'increment2-other@example.test');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-4555-8555-555555555555';

select public.create_project_with_profile(
  'Increment 2 DB Test',
  '{"status":"active","mission":null,"successStandard":null}'::jsonb,
  '{"productModel":{"status":"provisional"}}'::jsonb
);

select lives_ok(
  $$ select public.establish_genesis_and_nba(
    (select id from public.projects where name = 'Increment 2 DB Test'),
    0,
    '{"status":"active","mission":"Create useful software","successStandard":"Representative user completes the core workflow","targetCondition":"Core workflow works end to end","constraints":[],"authorityBoundaries":[],"genesis":{"status":"established"}}'::jsonb,
    '{"productModel":{"status":"provisional","intendedUser":"Independent builder","problemOpportunity":"Needs coherent execution","promisedMinimumValue":"Working verified MVP direction","productHypothesis":"AEOS can coordinate project state","criticalWorkflow":"Goal to verified result","mvpScope":["Genesis","NBA"],"mvpExclusions":[],"requirements":[]}}'::jsonb,
    'Confirm the provisional MVP direction',
    'Confirm or correct the MVP scope before implementation commitments.',
    '{"type":"decision","outcome":"confirmed_or_corrected"}'::jsonb,
    '{"confirmed":true}'::jsonb,
    'Confirm this MVP direction or correct it.',
    'Material product-scope commitment requires user authority.',
    '[{"value":"confirm","label":"Confirm MVP direction"}]'::jsonb
  ) $$,
  'owner can atomically establish Genesis, Product Model, NBA, and human dependency'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 2 DB Test'
  ) $$,
  array[1::bigint],
  'Genesis advances canonical revision'
);

select results_eq(
  $$ select count(*) from public.action_contracts a
     join public.project_profiles pp on pp.current_nba_action_id = a.id
     where a.project_id = (select id from public.projects where name = 'Increment 2 DB Test')
       and a.owner = 'user'
       and a.status = 'blocked' $$,
  array[1::bigint],
  'exactly one current user-owned NBA is adopted'
);

select results_eq(
  $$ select count(*) from public.human_dependencies
     where project_id = (select id from public.projects where name = 'Increment 2 DB Test')
       and status = 'open' $$,
  array[1::bigint],
  'current NBA has one open human dependency'
);

select throws_ok(
  $$ select public.establish_genesis_and_nba(
    (select id from public.projects where name = 'Increment 2 DB Test'),
    0,
    '{}'::jsonb,
    '{}'::jsonb,
    'Stale',
    'Stale',
    '{}'::jsonb,
    '{}'::jsonb,
    'Stale',
    'Stale',
    '[]'::jsonb
  ) $$,
  '40001',
  'stale project revision',
  'stale Genesis correction is rejected'
);

select lives_ok(
  $$ select public.establish_genesis_and_nba(
    (select id from public.projects where name = 'Increment 2 DB Test'),
    1,
    '{"status":"active","mission":"Create better software","successStandard":"Representative user completes the core workflow","targetCondition":"Core workflow works end to end","constraints":[],"authorityBoundaries":[],"genesis":{"status":"established"}}'::jsonb,
    '{"productModel":{"status":"provisional","intendedUser":"Independent builder","problemOpportunity":"Needs coherent execution","promisedMinimumValue":"Working verified MVP direction","productHypothesis":"AEOS can coordinate project state","criticalWorkflow":"Goal to verified result","mvpScope":["Genesis","Product Model","NBA"],"mvpExclusions":[],"requirements":[]}}'::jsonb,
    'Confirm the revised MVP direction',
    'Confirm or correct the revised MVP scope.',
    '{"type":"decision","outcome":"confirmed_or_corrected"}'::jsonb,
    '{"confirmed":true}'::jsonb,
    'Confirm this revised MVP direction or correct it.',
    'Material product-scope commitment requires user authority.',
    '[{"value":"confirm","label":"Confirm revised MVP direction"}]'::jsonb
  ) $$,
  'correction re-reconciles state and replaces the current NBA'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 2 DB Test'
  ) $$,
  array[2::bigint],
  'correction advances revision again'
);

select results_eq(
  $$ select count(*) from public.action_contracts
     where project_id = (select id from public.projects where name = 'Increment 2 DB Test')
       and status = 'superseded' $$,
  array[1::bigint],
  'prior NBA is superseded after material correction'
);

select results_eq(
  $$ select count(*) from public.human_dependencies
     where project_id = (select id from public.projects where name = 'Increment 2 DB Test')
       and status = 'cancelled' $$,
  array[1::bigint],
  'prior human dependency is cancelled after correction'
);

select lives_ok(
  $$ select public.confirm_mvp_direction(
    (select id from public.projects where name = 'Increment 2 DB Test'),
    2,
    '{"productModel":{"status":"confirmed","intendedUser":"Independent builder","problemOpportunity":"Needs coherent execution","promisedMinimumValue":"Working verified MVP direction","productHypothesis":"AEOS can coordinate project state","criticalWorkflow":"Goal to verified result","mvpScope":["Genesis","Product Model","NBA"],"mvpExclusions":[],"requirements":[]}}'::jsonb,
    'Define build-ready requirements for the confirmed MVP',
    'Translate the confirmed MVP scope into bounded requirements and verification criteria.',
    '{"type":"requirements_and_validation_plan"}'::jsonb,
    '{"requirementsDefined":true,"verificationPlanDefined":true}'::jsonb
  ) $$,
  'user confirmation resolves dependency and advances to AEOS-owned NBA'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 2 DB Test'
  ) $$,
  array[3::bigint],
  'confirmation advances canonical revision'
);

select results_eq(
  $$ select count(*) from public.action_contracts a
     join public.project_profiles pp on pp.current_nba_action_id = a.id
     where a.project_id = (select id from public.projects where name = 'Increment 2 DB Test')
       and a.owner = 'aeos'
       and a.status = 'ready' $$,
  array[1::bigint],
  'confirmation produces exactly one current AEOS-owned NBA'
);

select results_eq(
  $$ select count(*) from public.human_dependencies
     where project_id = (select id from public.projects where name = 'Increment 2 DB Test')
       and status = 'resolved' $$,
  array[1::bigint],
  'current confirmation dependency is resolved'
);

set local request.jwt.claim.sub = '66666666-6666-4666-8666-666666666666';

select results_eq(
  $$ select count(*) from public.human_dependencies
     where project_id = (select id from public.projects where name = 'Increment 2 DB Test') $$,
  array[0::bigint],
  'other user cannot read human dependencies'
);

select throws_ok(
  $$ select public.establish_genesis_and_nba(
    (select id from public.projects where name = 'Increment 2 DB Test'),
    3,
    '{}'::jsonb,
    '{}'::jsonb,
    'Unauthorized',
    'Unauthorized',
    '{}'::jsonb,
    '{}'::jsonb,
    'Unauthorized',
    'Unauthorized',
    '[]'::jsonb
  ) $$,
  '42501',
  'project access denied',
  'other user cannot mutate Genesis/NBA state'
);

set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.establish_genesis_and_nba(
    gen_random_uuid(),
    0,
    '{}'::jsonb,
    '{}'::jsonb,
    'Anonymous',
    'Anonymous',
    '{}'::jsonb,
    '{}'::jsonb,
    'Anonymous',
    'Anonymous',
    '[]'::jsonb
  ) $$,
  '42501',
  null,
  'anonymous role cannot execute Genesis/NBA RPC'
);

select * from finish();
rollback;
