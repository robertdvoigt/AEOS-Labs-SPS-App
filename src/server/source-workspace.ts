import { z } from "zod";
import { start } from "workflow/api";
import type { Json } from "@/lib/supabase/database.types";
import {
  createRepositoryForInstallation,
  getRepositoryForInstallation,
} from "@/integrations/github/app";
import { requireUser } from "@/server/auth";
import { readLatestDurabilityProbe } from "@/server/durable-runtime";
import { readProjectState, StaleProjectStateError } from "@/server/project-state";
import { codeExecutionWorkflow } from "../../workflows/code-execution";

const codeExecutionStartSchema = z.object({
  runtimeExecutionId: z.string().uuid(),
  codeChangeId: z.string().uuid(),
  actionId: z.string().uuid(),
  capabilityToken: z.string().min(32),
});

export class SourceWorkspaceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SourceWorkspaceError";
  }
}

function jsonRecord(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : {};
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "project";
}

function parseFullName(value: string) {
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match) {
    throw new SourceWorkspaceError(
      "invalid_repository",
      "Repository must be in owner/name form.",
    );
  }
  return { owner: match[1], repo: match[2] };
}

export async function readSourceWorkspace(projectId: string) {
  const { supabase } = await requireUser();

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id,provider,external_account_id,installation_id,scopes,metadata,status,created_at,updated_at")
    .eq("project_id", projectId)
    .eq("provider", "github")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) throw connectionError;

  const { data: repository, error: repositoryError } = await supabase
    .from("repositories")
    .select("id,provider,owner,repo,external_id,default_branch,installation_connection_id,created_at,updated_at")
    .eq("project_id", projectId)
    .maybeSingle();

  if (repositoryError) throw repositoryError;

  const { data: codeChange, error: changeError } = await supabase
    .from("code_changes")
    .select("id,action_id,repository_id,branch,base_commit,head_commit,pull_request_ref,status,created_at,accepted_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (changeError) throw changeError;

  let execution = null;
  let verification = null;
  let checkpoints: Array<{
    sequence: number;
    phase: string;
    state: Json;
    created_at: string;
  }> = [];

  if (codeChange) {
    const { data: executionData, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id,action_id,state,workflow_run_id,cancel_requested_at,error_code,error_message,provider,started_at,completed_at,created_at,result,attempt,execution_strategy,strategy_revision,material_changes,failure_phase,failure_class,failure_signature,adaptation_review_required")
      .eq("action_id", codeChange.action_id)
      .eq("provider", "openai_agents_vercel_sandbox")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (executionError) throw executionError;
    execution = executionData;

    if (execution) {
      const [checkpointResult, verificationResult] = await Promise.all([
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

      if (checkpointResult.error) throw checkpointResult.error;
      if (verificationResult.error) throw verificationResult.error;
      checkpoints = checkpointResult.data ?? [];
      verification = verificationResult.data;
    }
  }

  const { data: adaptationReview, error: adaptationError } = await supabase
    .from("execution_adaptation_reviews")
    .select("id,action_id,trigger_runtime_execution_id,status,failure_phase,failure_class,failure_signature,repeated_failure_count,disposition,rationale,prior_attempt_ids,required_change,resolved_strategy_key,changed_variables,created_at,resolved_at")
    .eq("project_id", projectId)
    .eq("status", "required")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (adaptationError) throw adaptationError;

  let executionStrategy = null;
  const strategyActionId = adaptationReview?.action_id ?? codeChange?.action_id;
  if (strategyActionId) {
    const { data: strategyData, error: strategyError } = await supabase
      .from("action_execution_strategies")
      .select("action_id,project_id,strategy_key,strategy_revision,configuration,material_changes,change_rationale,updated_at")
      .eq("action_id", strategyActionId)
      .maybeSingle();

    if (strategyError) throw strategyError;
    executionStrategy = strategyData;
  }

  return {
    connection,
    connectionMetadata: jsonRecord(connection?.metadata),
    repository,
    codeChange,
    execution,
    verification,
    checkpoints,
    adaptationReview,
    executionStrategy,
  };
}

export async function connectExistingRepository(input: {
  projectId: string;
  fullName: string;
}) {
  const source = await readSourceWorkspace(input.projectId);
  if (!source.connection?.installation_id) {
    throw new SourceWorkspaceError(
      "github_not_connected",
      "Connect GitHub before registering a repository.",
    );
  }

  const { owner, repo } = parseFullName(input.fullName);
  const githubRepo = await getRepositoryForInstallation(
    source.connection.installation_id,
    owner,
    repo,
  );

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("register_project_repository", {
    p_project_id: input.projectId,
    p_connection_id: source.connection.id,
    p_owner: githubRepo.owner,
    p_repo: githubRepo.repo,
    p_external_id: githubRepo.id,
    p_default_branch: githubRepo.defaultBranch,
  });

  if (error) throw new SourceWorkspaceError(error.code || "repo_register_failed", error.message);
  return data;
}

export async function createProjectRepository(projectId: string) {
  const [state, source] = await Promise.all([
    readProjectState(projectId),
    readSourceWorkspace(projectId),
  ]);

  if (!source.connection?.installation_id) {
    throw new SourceWorkspaceError(
      "github_not_connected",
      "Connect GitHub before creating a repository.",
    );
  }

  const repoName = (
    "aeos-" +
    slugify(state.project.name).slice(0, 52) +
    "-" +
    state.project.id.slice(0, 8)
  ).slice(0, 90);

  const githubRepo = await createRepositoryForInstallation({
    installationId: source.connection.installation_id,
    name: repoName,
    description: "Source workspace created by AEOS for " + state.project.name,
  });

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("register_project_repository", {
    p_project_id: projectId,
    p_connection_id: source.connection.id,
    p_owner: githubRepo.owner,
    p_repo: githubRepo.repo,
    p_external_id: githubRepo.id,
    p_default_branch: githubRepo.defaultBranch,
  });

  if (error) throw new SourceWorkspaceError(error.code || "repo_register_failed", error.message);
  return data;
}

export async function startCodeExecution(input: {
  projectId: string;
  expectedRevision: number;
}) {
  const [state, source, durability] = await Promise.all([
    readProjectState(input.projectId),
    readSourceWorkspace(input.projectId),
    readLatestDurabilityProbe(input.projectId),
  ]);

  if (state.profile.revision !== input.expectedRevision) {
    throw new StaleProjectStateError();
  }

  if (
    !state.currentAction ||
    state.currentAction.action_type !== "build" ||
    state.currentAction.owner !== "aeos" ||
    state.currentAction.status !== "ready"
  ) {
    throw new SourceWorkspaceError(
      "build_not_ready",
      "The current build action is not ready.",
    );
  }

  const actionInput = jsonRecord(state.currentAction.input);
  const buildUnit = jsonRecord(actionInput.buildUnit);

  if (
    typeof buildUnit.outcome !== "string" ||
    !buildUnit.outcome.trim() ||
    typeof buildUnit.scope !== "string" ||
    !buildUnit.scope.trim() ||
    buildUnit.acceptance == null ||
    buildUnit.verification == null
  ) {
    throw new SourceWorkspaceError(
      "build_unit_required",
      "AEOS must define a bounded Build Unit with outcome, scope, acceptance, and verification before starting software execution.",
    );
  }

  if (
    !durability ||
    durability.execution.state !== "succeeded" ||
    durability.verification?.status !== "pass"
  ) {
    throw new SourceWorkspaceError(
      "durability_not_verified",
      "Complete the durable Runtime continuity check before starting code execution.",
    );
  }

  if (!source.repository || !source.connection?.installation_id) {
    throw new SourceWorkspaceError(
      "repository_missing",
      "Connect and register a GitHub repository before starting code execution.",
    );
  }

  const branch =
    "aeos/" +
    state.currentAction.id.slice(0, 8) +
    "/first-build";

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_code_execution", {
    p_project_id: input.projectId,
    p_expected_revision: input.expectedRevision,
    p_repository_id: source.repository.id,
    p_branch: branch,
  });

  if (error) {
    if (error.code === "40001") throw new StaleProjectStateError();
    throw new SourceWorkspaceError(
      error.code || "code_execution_start_failed",
      error.message,
    );
  }

  const execution = codeExecutionStartSchema.parse(data);
  const task = {
    projectName: state.project.name,
    projectRevision: state.profile.revision,
    mission: state.canonical.coreState.mission,
    constraints: state.canonical.coreState.constraints,
    action: {
      id: state.currentAction.id,
      title: state.currentAction.title,
      objective: state.currentAction.objective,
      expectedResult: state.currentAction.expected_result,
      acceptanceCondition: state.currentAction.acceptance_condition,
      requiredCapabilities: state.currentAction.required_capabilities,
      verificationRequirements: state.currentAction.verification_requirements,
      authorityRequirements: state.currentAction.authority_requirements,
      input: state.currentAction.input,
    },
    productModel: {
      intendedUser: state.canonical.specializationState.productModel.intendedUser,
      promisedMinimumValue:
        state.canonical.specializationState.productModel.promisedMinimumValue,
      criticalWorkflow:
        state.canonical.specializationState.productModel.criticalWorkflow,
    },
  };

  try {
    const run = await start(codeExecutionWorkflow, [
      {
        runtimeExecutionId: execution.runtimeExecutionId,
        codeChangeId: execution.codeChangeId,
        capabilityToken: execution.capabilityToken,
        installationId: source.connection.installation_id,
        repository: {
          owner: source.repository.owner,
          repo: source.repository.repo,
          defaultBranch: source.repository.default_branch,
        },
        branch,
        task,
      },
    ]);

    const { error: bindError } = await supabase.rpc("bind_durable_workflow", {
      p_runtime_execution_id: execution.runtimeExecutionId,
      p_workflow_run_id: run.runId,
    });

    if (bindError) {
      throw new SourceWorkspaceError("workflow_bind_failed", bindError.message);
    }

    return {
      runtimeExecutionId: execution.runtimeExecutionId,
      workflowRunId: run.runId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code workflow did not start.";

    await supabase.rpc("workflow_fail_code_execution", {
      p_runtime_execution_id: execution.runtimeExecutionId,
      p_capability_token: execution.capabilityToken,
      p_code_change_id: execution.codeChangeId,
      p_error_message: message,
    });

    if (error instanceof SourceWorkspaceError) throw error;
    throw new SourceWorkspaceError("code_workflow_start_failed", message);
  }
}

export async function cancelCodeExecution(runtimeExecutionId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("request_cancel_runtime_execution", {
    p_runtime_execution_id: runtimeExecutionId,
  });

  if (error) {
    throw new SourceWorkspaceError(error.code || "code_cancel_failed", error.message);
  }
}
