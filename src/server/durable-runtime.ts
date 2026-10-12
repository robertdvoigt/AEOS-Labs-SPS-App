import { z } from "zod";
import { start } from "workflow/api";
import { isRuntimeStateActive } from "@/aeos/runtime/status";
import { requireUser } from "@/server/auth";
import { readProjectState, StaleProjectStateError } from "@/server/project-state";
import { durabilityProbeWorkflow } from "../../workflows/durability-probe";

const createProbeResultSchema = z.object({
  runtimeExecutionId: z.string().uuid(),
  actionId: z.string().uuid(),
  capabilityToken: z.string().min(32),
});

export class DurableRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DurableRuntimeError";
  }
}

export async function startDurabilityProbe(input: {
  projectId: string;
  expectedRevision: number;
}) {
  const state = await readProjectState(input.projectId);

  if (state.profile.revision !== input.expectedRevision) {
    throw new StaleProjectStateError();
  }

  if (
    !state.currentAction ||
    state.currentAction.owner !== "aeos" ||
    state.currentAction.status !== "ready" ||
    state.currentAction.action_type !== "build"
  ) {
    throw new DurableRuntimeError(
      "durability_probe_not_applicable",
      "The durability probe is only applicable when the next AEOS action requires durable build execution.",
    );
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_durability_probe", {
    p_project_id: input.projectId,
    p_expected_revision: input.expectedRevision,
  });

  if (error) {
    if (error.code === "40001") throw new StaleProjectStateError();
    throw new DurableRuntimeError(
      error.code || "durability_probe_start_failed",
      error.message,
    );
  }

  const probe = createProbeResultSchema.parse(data);

  let run;
  try {
    run = await start(durabilityProbeWorkflow, [
      {
        runtimeExecutionId: probe.runtimeExecutionId,
        capabilityToken: probe.capabilityToken,
      },
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vercel Workflow could not start.";

    await supabase.rpc("fail_runtime_execution", {
      p_runtime_execution_id: probe.runtimeExecutionId,
      p_error_code: "workflow_start_failed",
      p_error_message: message,
      p_retryable: true,
      p_result: {},
      p_usage: {},
      p_limitations: ["Workflow did not start."],
    });

    throw new DurableRuntimeError("workflow_start_failed", message);
  }

  const { error: bindError } = await supabase.rpc("bind_durable_workflow", {
    p_runtime_execution_id: probe.runtimeExecutionId,
    p_workflow_run_id: run.runId,
  });

  if (bindError) {
    throw new DurableRuntimeError(
      "workflow_bind_failed",
      bindError.message,
    );
  }

  return {
    runtimeExecutionId: probe.runtimeExecutionId,
    workflowRunId: run.runId,
  };
}

export async function requestDurabilityProbeCancel(runtimeExecutionId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("request_cancel_runtime_execution", {
    p_runtime_execution_id: runtimeExecutionId,
  });

  if (error) {
    throw new DurableRuntimeError(
      error.code || "runtime_cancel_failed",
      error.message,
    );
  }
}

export async function readLatestDurabilityProbe(projectId: string) {
  const { supabase } = await requireUser();

  const { data: action, error: actionError } = await supabase
    .from("action_contracts")
    .select("id,title,status,created_at")
    .eq("project_id", projectId)
    .eq("action_type", "durability_probe")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (actionError) throw actionError;
  if (!action) return null;

  const { data: execution, error: executionError } = await supabase
    .from("runtime_executions")
    .select("id,state,workflow_run_id,cancel_requested_at,error_code,error_message,started_at,completed_at,created_at,result")
    .eq("action_id", action.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (executionError) throw executionError;
  if (!execution) return null;

  const [{ data: checkpoints, error: checkpointError }, { data: verification, error: verificationError }] =
    await Promise.all([
      supabase
        .from("runtime_checkpoints")
        .select("sequence,phase,state,created_at")
        .eq("runtime_execution_id", execution.id)
        .order("sequence", { ascending: true }),
      supabase
        .from("verification_results")
        .select("status,method,summary,details,created_at")
        .eq("runtime_execution_id", execution.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (checkpointError) throw checkpointError;
  if (verificationError) throw verificationError;

  return {
    action,
    execution,
    checkpoints: checkpoints ?? [],
    verification,
    active: isRuntimeStateActive(execution.state),
  };
}
