# AEOS Repository Instructions

- src/aeos/core owns universal Core semantics.
- src/aeos/specializations/software-product owns domain specialization semantics.
- src/aeos/runtime owns execution-intelligence implementation.
- UI must not directly mutate canonical project state.
- Provider SDK objects must not become canonical AEOS state.
- Tool access is not authority.
- Executor self-report is not acceptance.
- Database changes require migrations and RLS tests.
- Do not store secrets in source, prompts, logs, fixtures, or artifacts.
