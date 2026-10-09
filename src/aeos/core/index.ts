export type ActionOwner = "aeos" | "user" | "shared";

export const CORE_INVARIANTS = {
  oneCanonicalProjectState: true,
  onePrimaryNextBestAction: true,
  verificationBeforeAcceptance: true,
  toolAccessIsNotAuthority: true,
  uncertainEffectsBeforeRetry: true,
} as const;
