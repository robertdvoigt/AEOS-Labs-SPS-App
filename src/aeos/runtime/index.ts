export interface RuntimeExecutionResult {
  actionId: string;
  runtimeExecutionId: string;
  outcome: "succeeded" | "failed" | "blocked" | "inconclusive" | "cancelled";
  verified: boolean;
  limitations: string[];
}

export interface RuntimeController {
  executeAction(actionId: string): Promise<RuntimeExecutionResult>;
}
