begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'projects', 'projects exists');
select has_table('public', 'project_profiles', 'project_profiles exists');
select has_table('public', 'project_profile_revisions', 'profile revisions exist');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

insert into public.projects (id, owner_user_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Owner project');

insert into public.project_profiles (project_id, revision, core_state, specialization_state)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0, '{}'::jsonb, '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq($$select count(*) from public.projects$$, array[1::bigint], 'owner sees own project');
select results_eq($$select count(*) from public.project_profiles$$, array[1::bigint], 'owner sees own profile');

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select results_eq($$select count(*) from public.projects$$, array[0::bigint], 'other user cannot see project');
select results_eq($$select count(*) from public.project_profiles$$, array[0::bigint], 'other user cannot see project profile');

select * from finish();
rollback;
