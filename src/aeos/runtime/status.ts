const ACTIVE_RUNTIME_STATES = new Set([
  "queued",
  "preparing",
  "running",
  "waiting_for_human",
  "waiting_for_external",
  "verifying",
  "reconciling",
]);

export function isRuntimeStateActive(state: string | null | undefined) {
  return state ? ACTIVE_RUNTIME_STATES.has(state) : false;
}
