import type { ActionContract, ActionStatus } from "@/aeos/contracts/action";

export type RuntimeModelClass = "fast" | "standard" | "deep" | "critical";
export type RuntimeExecutionState =
  | "queued"
  | "preparing"
  | "running"
  | "waiting_for_human"
  | "waiting_for_external"
  | "verifying"
  | "reconciling"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "inconclusive";

export type VerificationStatus =
  | "pass"
  | "pass_with_known_limitation"
  | "fail"
  | "inconclusive";

export interface ProviderTextRequest {
  modelClass: RuntimeModelClass;
  instructions: string;
  input: string;
  metadata?: Record<string, string>;
}

export interface ProviderTextResult {
  provider: string;
  model: string;
  responseId: string;
  outputText: string;
  usage: Record<string, unknown>;
}

export interface ProviderAdapter {
  invokeText(request: ProviderTextRequest): Promise<ProviderTextResult>;
}

export interface RuntimePersistence {
  loadAction(actionId: string): Promise<ActionContract>;
  updateActionStatus(actionId: string, status: ActionStatus): Promise<void>;
  createExecution(input: {
    projectId: string;
    actionId: string;
    contextRevision: number;
    modelClass: RuntimeModelClass;
  }): Promise<string>;
  updateExecution(
    executionId: string,
    patch: {
      state?: RuntimeExecutionState;
      provider?: string;
      model?: string;
      providerResponseId?: string;
      result?: Record<string, unknown>;
      limitations?: string[];
      usage?: Record<string, unknown>;
      errorCode?: string | null;
      errorMessage?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
    },
  ): Promise<void>;
  createVerification(input: {
    projectId: string;
    actionId: string;
    runtimeExecutionId: string;
    status: VerificationStatus;
    verifierKind: "deterministic" | "model" | "human" | "composite";
    method: string;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<string>;
  createExecutionRecord(input: {
    projectId: string;
    actionId: string;
    runtimeExecutionId: string;
    verificationResultId?: string | null;
    outcome: "succeeded" | "failed" | "blocked" | "inconclusive" | "cancelled" | "no_change";
    expectedContribution?: string | null;
    actualResult: Record<string, unknown>;
    profileRevisionBefore: number;
    profileRevisionAfter?: number | null;
    limitations?: string[];
  }): Promise<string>;
}

export interface RuntimeExecutionResult {
  actionId: string;
  runtimeExecutionId: string;
  outcome: "succeeded" | "failed" | "blocked" | "inconclusive" | "cancelled";
  verified: boolean;
  limitations: string[];
}
