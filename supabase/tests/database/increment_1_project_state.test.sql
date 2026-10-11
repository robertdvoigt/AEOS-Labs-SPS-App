begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'increment1-owner@example.test'),
  ('44444444-4444-4444-4444-444444444444', 'increment1-other@example.test');

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

select lives_ok(
  $$ select public.create_project_with_profile(
    'Increment 1 Project',
    '{"mission":"Build the first canonical project"}'::jsonb,
    '{"mvpScope":"Increment 1"}'::jsonb
  ) $$,
  'owner can atomically create project and canonical profile'
);

select results_eq(
  $$ select count(*) from public.projects where name = 'Increment 1 Project' $$,
  array[1::bigint],
  'project exists'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 1 Project'
  ) $$,
  array[0::bigint],
  'new project profile starts at revision zero'
);

select results_eq(
  $$ select count(*) from public.project_profile_revisions where project_id = (
    select id from public.projects where name = 'Increment 1 Project'
  ) and revision = 0 $$,
  array[1::bigint],
  'initial canonical revision is recorded'
);

select lives_ok(
  $$ select public.reconcile_project_state(
    (select id from public.projects where name = 'Increment 1 Project'),
    0,
    '{"mission":"Build the first canonical project safely"}'::jsonb,
    '{"mvpScope":"Increment 1"}'::jsonb,
    'Update mission',
    null,
    null
  ) $$,
  'owner can reconcile current project state'
);

select results_eq(
  $$ select revision from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 1 Project'
  ) $$,
  array[1::bigint],
  'reconciliation increments revision'
);

select results_eq(
  $$ select core_state->>'mission' from public.project_profiles where project_id = (
    select id from public.projects where name = 'Increment 1 Project'
  ) $$,
  array['Build the first canonical project safely'::text],
  'reconciliation stores new canonical state'
);

select throws_ok(
  $$ select public.reconcile_project_state(
    (select id from public.projects where name = 'Increment 1 Project'),
    0,
    '{"mission":"stale overwrite"}'::jsonb,
    '{"mvpScope":"Increment 1"}'::jsonb,
    'stale write',
    null,
    null
  ) $$,
  '40001',
  'stale project revision',
  'stale canonical write is rejected'
);

set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select results_eq(
  $$ select count(*) from public.projects where name = 'Increment 1 Project' $$,
  array[0::bigint],
  'other user cannot read owner project'
);

select throws_ok(
  $$ select public.reconcile_project_state(
    (select id from public.projects where name = 'Increment 1 Project'),
    1,
    '{}'::jsonb,
    '{}'::jsonb,
    'unauthorized write',
    null,
    null
  ) $$,
  '42501',
  'project access denied',
  'other user cannot reconcile owner project'
);

set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $sql$ select public.create_project_with_profile('Anonymous project', '{}'::jsonb, '{}'::jsonb) $sql$,
  '42501',
  null,
  'anonymous role cannot execute project creation RPC'
);

select * from finish();
rollback;
