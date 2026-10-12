import { sleep } from "workflow";
import { createWorkflowSupabaseClient } from "@/integrations/supabase/workflow-client";
import type { Json } from "@/lib/supabase/database.types";

export type DurabilityProbeWorkflowInput = {
  runtimeExecutionId: string;
  capabilityToken: string;
};

type WorkflowControl = {
  cancelRequested: boolean;
  state?: string;
};

function normalizeControl(value: unknown): WorkflowControl {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { cancelRequested: false };
  }

  const record = value as Record<string, unknown>;
  return {
    cancelRequested: record.cancelRequested === true,
    state: typeof record.state === "string" ? record.state : undefined,
  };
}

async function checkpointStep(
  input: DurabilityProbeWorkflowInput,
  sequence: number,
  phase: string,
  state: Record<string, Json | undefined>,
): Promise<WorkflowControl> {
  "use step";

  const supabase = createWorkflowSupabaseClient();
  const { data, error } = await supabase.rpc("workflow_runtime_checkpoint", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
    p_sequence: sequence,
    p_phase: phase,
    p_state: state,
  });

  if (error) throw new Error(error.message);
  return normalizeControl(data);
}

async function controlStep(
  input: DurabilityProbeWorkflowInput,
): Promise<WorkflowControl> {
  "use step";

  const supabase = createWorkflowSupabaseClient();
  const { data, error } = await supabase.rpc("workflow_runtime_control", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
  });

  if (error) throw new Error(error.message);
  return normalizeControl(data);
}

async function completeStep(input: DurabilityProbeWorkflowInput) {
  "use step";

  const supabase = createWorkflowSupabaseClient();
  const { error } = await supabase.rpc("workflow_complete_durability_probe", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
    p_result: {
      completed: true,
      survivedRequestBoundary: true,
      checkpointSequence: ["created", "started", "resumed", "verified"],
    },
  });

  if (error) throw new Error(error.message);
}

async function cancelStep(input: DurabilityProbeWorkflowInput) {
  "use step";

  const supabase = createWorkflowSupabaseClient();
  const { error } = await supabase.rpc("workflow_cancel_durability_probe", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
  });

  if (error) throw new Error(error.message);
}

async function failStep(
  input: DurabilityProbeWorkflowInput,
  message: string,
) {
  "use step";

  const supabase = createWorkflowSupabaseClient();
  const { error } = await supabase.rpc("workflow_fail_durability_probe", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
    p_error_message: message,
  });

  if (error) throw new Error(error.message);
}

export async function durabilityProbeWorkflow(
  input: DurabilityProbeWorkflowInput,
) {
  "use workflow";

  try {
    const started = await checkpointStep(input, 1, "started", {
      message: "Durable workflow accepted control.",
    });

    if (started.cancelRequested) {
      await cancelStep(input);
      return { status: "cancelled", phase: "started" };
    }

    await sleep("12 seconds");

    const resumed = await checkpointStep(input, 2, "resumed", {
      resumedAfterDurableWait: true,
    });

    if (resumed.cancelRequested) {
      await cancelStep(input);
      return { status: "cancelled", phase: "resumed" };
    }

    await sleep("8 seconds");

    await checkpointStep(input, 3, "verified", {
      requestBoundaryIndependent: true,
    });

    const finalControl = await controlStep(input);
    if (finalControl.cancelRequested) {
      await cancelStep(input);
      return { status: "cancelled", phase: "verified" };
    }

    await completeStep(input);

    return {
      status: "succeeded",
      runtimeExecutionId: input.runtimeExecutionId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Durability workflow failed.";

    try {
      await failStep(input, message);
    } catch {
      // The terminal DB state may already be committed by an idempotent retry.
    }

    throw error;
  }
}
