import type { Json } from "@/lib/supabase/database.types";
import { buildExecutionContext } from "@/aeos/runtime/context-builder";
import type {
  RuntimeAnalysisOutput,
  RuntimeProviderResult,
  RuntimeUsage,
} from "@/aeos/runtime/contracts";
import { selectExecutionStrategy } from "@/aeos/runtime/router";
import { verifyRequirementsOutput } from "@/aeos/runtime/verifier";
import { OpenAIProvider, RuntimeProviderError } from "@/integrations/openai/provider";
import { requireUser } from "@/server/auth";
import { readProjectState, StaleProjectStateError } from "@/server/project-state";

export class RuntimeControllerError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "RuntimeControllerError";
  }
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function addUsage(a: RuntimeUsage, b: RuntimeUsage): RuntimeUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

function emptyUsage(): RuntimeUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function buildUpdatedSpecialization(
  state: Awaited<ReturnType<typeof readProjectState>>,
  output: RuntimeAnalysisOutput,
  runtimeExecutionId: string,
) {
  const current = state.canonical.specializationState;

  return {
    ...current,
    productModel: {
      ...current.productModel,
      requirements: output.requirements,
      buildQualityState: {
        ...current.productModel.buildQualityState,
        requirementsDefined: true,
        verificationPlanDefined: true,
        sourceRuntimeExecutionId: runtimeExecutionId,
      },
    },
  };
}

async function recordFailure(
  runtimeExecutionId: string,
  error: RuntimeControllerError,
  usage: RuntimeUsage,
  limitations: string[],
) {
  const { supabase } = await requireUser();
  await supabase.rpc("fail_runtime_execution", {
    p_runtime_execution_id: runtimeExecutionId,
    p_error_code: error.code,
    p_error_message: error.message,
    p_retryable: error.retryable,
    p_result: {},
    p_usage: toJson(usage),
    p_limitations: toJson(limitations),
  });
}

function asControllerError(error: unknown): RuntimeControllerError {
  if (error instanceof RuntimeControllerError) return error;
  if (error instanceof RuntimeProviderError) {
    return new RuntimeControllerError(error.code, error.retryable, error.message);
  }
  if (error instanceof StaleProjectStateError) {
    return new RuntimeControllerError("stale_state", true, error.message);
  }

  const value = error as { code?: string; message?: string };
  return new RuntimeControllerError(
    value?.code || "runtime_execution_failed",
    false,
    value?.message || "Runtime execution failed.",
  );
}

export async function executeAction(input: {
  projectId: string;
  actionId: string;
  expectedRevision: number;
}) {
  const state = await readProjectState(input.projectId);
  const action = state.currentAction;

  if (!action || action.id !== input.actionId) {
    throw new RuntimeControllerError(
      "action_not_current",
      true,
      "The requested action is no longer the current Next Best Action.",
    );
  }

  if (
    state.profile.revision !== input.expectedRevision ||
    action.profile_revision !== input.expectedRevision
  ) {
    throw new StaleProjectStateError();
  }

  if (action.owner !== "aeos" || action.status !== "ready") {
    throw new RuntimeControllerError(
      "action_not_executable",
      true,
      "The current action is not ready for AEOS execution.",
    );
  }

  if (action.action_type !== "analysis") {
    throw new RuntimeControllerError(
      "capability_not_available",
      false,
      "This action requires Runtime capabilities that are not active in the Minimum Runtime.",
    );
  }

  const strategy = selectExecutionStrategy(action);
  const context = buildExecutionContext({
    project: { id: state.project.id, name: state.project.name },
    revision: state.profile.revision,
    coreState: state.canonical.coreState,
    specializationState: state.canonical.specializationState,
    action: {
      id: action.id,
      profileRevision: action.profile_revision,
      actionType: action.action_type,
      title: action.title,
      objective: action.objective,
      expectedResult: action.expected_result,
      acceptanceCondition: action.acceptance_condition,
      requiredCapabilities: action.required_capabilities,
    },
  });

  const { supabase } = await requireUser();
  const { data: runtimeExecutionId, error: startError } = await supabase.rpc(
    "start_runtime_execution",
    {
      p_action_id: action.id,
      p_expected_revision: input.expectedRevision,
      p_model_class: strategy.primary.class,
      p_provider: "openai",
      p_model: strategy.primary.model,
    },
  );

  if (startError || !runtimeExecutionId) {
    if (startError?.code === "40001") throw new StaleProjectStateError();
    throw new RuntimeControllerError(
      startError?.code || "runtime_start_failed",
      true,
      startError?.message || "Runtime execution could not start.",
    );
  }

  let usage = emptyUsage();
  const limitations: string[] = [];
  const provider = new OpenAIProvider();

  try {
    let providerResult: RuntimeProviderResult = await provider.executeStructuredAnalysis(
      context,
      strategy.primary,
    );
    usage = addUsage(usage, providerResult.usage);
    let verification = verifyRequirementsOutput(providerResult.output);

    if (!verification.passed && strategy.fallback) {
      limitations.push(
        "Primary model output did not satisfy deterministic acceptance; Runtime used the configured routine fallback.",
      );
      const fallbackResult = await provider.executeStructuredAnalysis(
        context,
        strategy.fallback,
      );
      usage = addUsage(usage, fallbackResult.usage);
      providerResult = fallbackResult;
      verification = verifyRequirementsOutput(providerResult.output);
    }

    if (!verification.passed) {
      throw new RuntimeControllerError(
        "verification_failed",
        true,
        verification.summary,
      );
    }

    const specializationState = buildUpdatedSpecialization(
      state,
      providerResult.output,
      runtimeExecutionId,
    );

    const result = {
      actionId: action.id,
      runtimeExecutionId,
      projectRevisionUsed: input.expectedRevision,
      observedResult: providerResult.output,
      outcome: "succeeded",
      verification,
      provider: {
        name: providerResult.provider,
        model: providerResult.model,
        responseId: providerResult.providerResponseId,
      },
      limitations: [...limitations, ...providerResult.output.limitations],
    };

    const { data: reconciliation, error: completionError } = await supabase.rpc(
      "complete_runtime_analysis",
      {
        p_runtime_execution_id: runtimeExecutionId,
        p_expected_revision: input.expectedRevision,
        p_provider_response_id: providerResult.providerResponseId,
        p_result: toJson(result),
        p_usage: toJson(usage),
        p_limitations: toJson(result.limitations),
        p_verification_status: verification.status,
        p_verification_method: verification.method,
        p_verification_summary: verification.summary,
        p_verification_details: toJson(verification.details),
        p_specialization_state: toJson(specializationState),
        p_next_action_type: "build",
        p_next_action_title: "Execute the first build-ready MVP increment",
        p_next_action_objective:
          "Implement the first bounded build unit from the confirmed requirements and verify it end to end.",
        p_next_action_expected_result: {
          type: "verified_build_increment",
        },
        p_next_action_acceptance_condition: {
          buildImplemented: true,
          verificationPassed: true,
        },
        p_next_required_capabilities: [
          "code_execution",
          "repository_write",
          "tests",
          "browser_verification",
        ],
      },
    );

    if (completionError) {
      if (completionError.code === "40001") throw new StaleProjectStateError();
      throw new RuntimeControllerError(
        completionError.code || "runtime_reconciliation_failed",
        true,
        completionError.message,
      );
    }

    return {
      runtimeExecutionId,
      reconciliation,
      result,
      usage,
    };
  } catch (error) {
    const normalized = asControllerError(error);
    await recordFailure(runtimeExecutionId, normalized, usage, limitations);
    throw normalized;
  }
}
