import type { ActionContract } from "@/aeos/contracts/action";
import type {
  ProviderAdapter,
  RuntimeExecutionResult,
  RuntimeModelClass,
  RuntimePersistence,
} from "@/aeos/runtime/contracts";

function chooseModelClass(action: ActionContract): RuntimeModelClass {
  const requested = action.input.modelClass;
  if (requested === "fast" || requested === "standard" || requested === "deep" || requested === "critical") {
    return requested;
  }
  return "standard";
}

function buildPrompt(action: ActionContract): { instructions: string; input: string } {
  return {
    instructions:
      "Execute only the bounded AEOS Action Contract. Return a concise result that directly satisfies the stated objective. Do not invent external facts or claim verification that has not occurred.",
    input: JSON.stringify({
      objective: action.objective,
      expectedResult: action.expectedResult,
      acceptanceCondition: action.acceptanceCondition,
      input: action.input,
    }),
  };
}

export async function executeRuntimeAction(input: {
  actionId: string;
  provider: ProviderAdapter;
  persistence: RuntimePersistence;
}): Promise<RuntimeExecutionResult> {
  const action = await input.persistence.loadAction(input.actionId);
  if (action.owner !== "aeos") {
    throw new Error("Runtime may only autonomously execute AEOS-owned actions in Slice 1.");
  }
  if (!["ready", "active"].includes(action.status)) {
    throw new Error(`Action ${action.id} is not executable from status ${action.status}.`);
  }

  const modelClass = chooseModelClass(action);
  const executionId = await input.persistence.createExecution({
    projectId: action.projectId,
    actionId: action.id,
    contextRevision: action.profileRevision,
    modelClass,
  });

  await input.persistence.updateActionStatus(action.id, "active");
  await input.persistence.updateExecution(executionId, {
    state: "running",
    startedAt: new Date().toISOString(),
  });

  try {
    const prompt = buildPrompt(action);
    const providerResult = await input.provider.invokeText({
      modelClass,
      ...prompt,
      metadata: {
        action_id: action.id,
        project_id: action.projectId,
        profile_revision: String(action.profileRevision),
      },
    });

    await input.persistence.updateExecution(executionId, {
      state: "verifying",
      provider: providerResult.provider,
      model: providerResult.model,
      providerResponseId: providerResult.responseId,
      usage: providerResult.usage,
      result: { outputText: providerResult.outputText },
    });

    const passed = providerResult.outputText.trim().length > 0;
    const verificationId = await input.persistence.createVerification({
      projectId: action.projectId,
      actionId: action.id,
      runtimeExecutionId: executionId,
      status: passed ? "pass" : "fail",
      verifierKind: "deterministic",
      method: "slice_1_nonempty_text_result",
      summary: passed ? "Provider returned a non-empty bounded result." : "Provider returned no usable text.",
      details: { outputLength: providerResult.outputText.length },
    });

    if (!passed) {
      await input.persistence.updateActionStatus(action.id, "blocked");
      await input.persistence.updateExecution(executionId, {
        state: "failed",
        completedAt: new Date().toISOString(),
        limitations: ["Provider returned no usable text."],
      });
      await input.persistence.createExecutionRecord({
        projectId: action.projectId,
        actionId: action.id,
        runtimeExecutionId: executionId,
        verificationResultId: verificationId,
        outcome: "failed",
        actualResult: { outputText: providerResult.outputText },
        profileRevisionBefore: action.profileRevision,
        profileRevisionAfter: action.profileRevision,
        limitations: ["Provider returned no usable text."],
      });
      return {
        actionId: action.id,
        runtimeExecutionId: executionId,
        outcome: "failed",
        verified: false,
        limitations: ["Provider returned no usable text."],
      };
    }

    await input.persistence.updateExecution(executionId, { state: "reconciling" });
    await input.persistence.createExecutionRecord({
      projectId: action.projectId,
      actionId: action.id,
      runtimeExecutionId: executionId,
      verificationResultId: verificationId,
      outcome: "no_change",
      expectedContribution: action.objective,
      actualResult: { outputText: providerResult.outputText },
      profileRevisionBefore: action.profileRevision,
      profileRevisionAfter: action.profileRevision,
      limitations: [],
    });
    await input.persistence.updateActionStatus(action.id, "completed");
    await input.persistence.updateExecution(executionId, {
      state: "succeeded",
      completedAt: new Date().toISOString(),
    });

    return {
      actionId: action.id,
      runtimeExecutionId: executionId,
      outcome: "succeeded",
      verified: true,
      limitations: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown runtime failure";
    await input.persistence.updateActionStatus(action.id, "blocked");
    await input.persistence.updateExecution(executionId, {
      state: "failed",
      errorCode: "runtime_execution_failed",
      errorMessage: message,
      completedAt: new Date().toISOString(),
      limitations: [message],
    });
    await input.persistence.createExecutionRecord({
      projectId: action.projectId,
      actionId: action.id,
      runtimeExecutionId: executionId,
      outcome: "failed",
      actualResult: {},
      profileRevisionBefore: action.profileRevision,
      profileRevisionAfter: action.profileRevision,
      limitations: [message],
    });
    throw error;
  }
}
