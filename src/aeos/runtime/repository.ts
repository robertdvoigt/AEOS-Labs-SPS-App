import type { SupabaseClient } from "@supabase/supabase-js";
import { actionContractSchema, type ActionContract, type ActionStatus } from "@/aeos/contracts/action";
import type {
  RuntimeExecutionState,
  RuntimeModelClass,
  RuntimePersistence,
  VerificationStatus,
} from "@/aeos/runtime/contracts";
import type { Database, Json } from "@/lib/supabase/database.types";

type ActionRow = Database["public"]["Tables"]["action_contracts"]["Row"];

function mapAction(row: ActionRow): ActionContract {
  return actionContractSchema.parse({
    id: row.id,
    projectId: row.project_id,
    profileRevision: row.profile_revision,
    parentActionId: row.parent_action_id,
    actionType: row.action_type,
    title: row.title,
    objective: row.objective,
    owner: row.owner,
    status: row.status,
    expectedResult: row.expected_result,
    acceptanceCondition: row.acceptance_condition,
    requiredCapabilities: row.required_capabilities,
    verificationRequirements: row.verification_requirements,
    authorityRequirements: row.authority_requirements,
    input: row.input,
  });
}

export class SupabaseRuntimePersistence implements RuntimePersistence {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async loadAction(actionId: string): Promise<ActionContract> {
    const { data, error } = await this.db
      .from("action_contracts")
      .select("*")
      .eq("id", actionId)
      .single();
    if (error) throw error;
    return mapAction(data);
  }

  async updateActionStatus(actionId: string, status: ActionStatus): Promise<void> {
    const { error } = await this.db
      .from("action_contracts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", actionId);
    if (error) throw error;
  }

  async createExecution(input: {
    projectId: string;
    actionId: string;
    contextRevision: number;
    modelClass: RuntimeModelClass;
  }): Promise<string> {
    const { data, error } = await this.db
      .from("runtime_executions")
      .insert({
        project_id: input.projectId,
        action_id: input.actionId,
        context_revision: input.contextRevision,
        model_class: input.modelClass,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async updateExecution(
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
  ): Promise<void> {
    const { error } = await this.db
      .from("runtime_executions")
      .update({
        state: patch.state,
        provider: patch.provider,
        model: patch.model,
        provider_response_id: patch.providerResponseId,
        result: patch.result as Json | undefined,
        limitations: patch.limitations as Json | undefined,
        usage: patch.usage as Json | undefined,
        error_code: patch.errorCode,
        error_message: patch.errorMessage,
        started_at: patch.startedAt,
        completed_at: patch.completedAt,
      })
      .eq("id", executionId);
    if (error) throw error;
  }

  async createVerification(input: {
    projectId: string;
    actionId: string;
    runtimeExecutionId: string;
    status: VerificationStatus;
    verifierKind: "deterministic" | "model" | "human" | "composite";
    method: string;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<string> {
    const { data, error } = await this.db
      .from("verification_results")
      .insert({
        project_id: input.projectId,
        action_id: input.actionId,
        runtime_execution_id: input.runtimeExecutionId,
        status: input.status,
        verifier_kind: input.verifierKind,
        method: input.method,
        summary: input.summary,
        details: (input.details ?? {}) as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async createExecutionRecord(input: {
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
  }): Promise<string> {
    const { data, error } = await this.db
      .from("execution_records")
      .insert({
        project_id: input.projectId,
        action_id: input.actionId,
        runtime_execution_id: input.runtimeExecutionId,
        verification_result_id: input.verificationResultId ?? null,
        outcome: input.outcome,
        expected_contribution: input.expectedContribution ?? null,
        actual_result: input.actualResult as Json,
        profile_revision_before: input.profileRevisionBefore,
        profile_revision_after: input.profileRevisionAfter ?? null,
        limitations: (input.limitations ?? []) as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}
