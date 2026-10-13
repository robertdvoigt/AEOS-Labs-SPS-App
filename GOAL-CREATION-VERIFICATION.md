# Bounded increment: goal-based project creation

Advances REQ-01 by accepting a required plain-language goal when an authenticated
user creates a project. The server trims and validates the name (1–160 characters)
and goal (1–1200 characters), then uses the existing transactional
`create_project_with_profile` RPC to persist the goal as `coreState.mission` in
both the initial canonical profile and revision zero.

Existing project reads and Genesis mission prefilling consume that canonical
value. No product facts, scope commitments, or execution eligibility are inferred
from the goal. Existing projects are unchanged. No schema, provider, infrastructure,
or architecture changes are required.

## Verification

- `pnpm install --frozen-lockfile`: passed; lockfile unchanged.
- Unit suite: 38 tests passed, including 10 new project-creation tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with an existing warning in `postcss.config.mjs`.
- `pnpm build`: passed.
- PostgreSQL assertions added for initial goal/history persistence, cross-account
  read denial, and a returning owner reading the current canonical goal.
- Database tests not run: Supabase CLI and Docker are unavailable in this sandbox.
  Run the existing database CI or `supabase start && supabase test db` locally.
  Database fixtures roll back their changes.
- Browser sign-in/create/sign-out/reopen journey not run. It requires a configured
  Supabase environment and test account. Verify that the created goal appears in
  the workspace and Genesis after reopening; clean up the test project/account.

This is an entry-point increment, not verification of the full critical journey.
Preview/browser verification, external GitHub operations, and the broader Runtime
review/reconciliation/recovery requirements are not newly implemented or verified.