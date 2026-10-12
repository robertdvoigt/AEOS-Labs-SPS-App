"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RuntimeControllerError, executeAction } from "@/aeos/runtime/runtime-controller";
import { confirmMvpDirection } from "@/server/genesis";
import {
  DurableRuntimeError,
  requestDurabilityProbeCancel,
  startDurabilityProbe,
} from "@/server/durable-runtime";
import { StaleProjectStateError } from "@/server/project-state";
import {
  SourceWorkspaceError,
  cancelCodeExecution,
  connectExistingRepository,
  createProjectRepository,
  startCodeExecution,
} from "@/server/source-workspace";

export async function confirmMvpAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));

  if (!projectId || !Number.isInteger(expectedRevision)) {
    redirect("/projects/" + projectId + "?error=invalid");
  }

  try {
    await confirmMvpDirection({ projectId, expectedRevision });
  } catch (error) {
    if (error instanceof StaleProjectStateError) {
      redirect("/projects/" + projectId + "?error=stale");
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?error=confirm");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?confirmed=1");
}

export async function executeCurrentActionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const actionId = String(formData.get("actionId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));

  if (!projectId || !actionId || !Number.isInteger(expectedRevision)) {
    redirect("/projects/" + projectId + "?runtime_error=invalid");
  }

  try {
    await executeAction({ projectId, actionId, expectedRevision });
  } catch (error) {
    if (error instanceof StaleProjectStateError) {
      redirect("/projects/" + projectId + "?error=stale");
    }
    if (error instanceof RuntimeControllerError) {
      redirect("/projects/" + projectId + "?runtime_error=" + encodeURIComponent(error.code));
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?runtime_error=runtime_execution_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?runtime=success");
}


export async function startDurabilityProbeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));

  if (!projectId || !Number.isInteger(expectedRevision)) {
    redirect("/projects/" + projectId + "?durability_error=invalid");
  }

  try {
    await startDurabilityProbe({ projectId, expectedRevision });
  } catch (error) {
    if (error instanceof StaleProjectStateError) {
      redirect("/projects/" + projectId + "?error=stale");
    }
    if (error instanceof DurableRuntimeError) {
      redirect(
        "/projects/" +
          projectId +
          "?durability_error=" +
          encodeURIComponent(error.code),
      );
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?durability_error=start_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?durability=started");
}

export async function cancelDurabilityProbeAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const runtimeExecutionId = String(formData.get("runtimeExecutionId") ?? "");

  if (!projectId || !runtimeExecutionId) {
    redirect("/projects/" + projectId + "?durability_error=invalid");
  }

  try {
    await requestDurabilityProbeCancel(runtimeExecutionId);
  } catch (error) {
    if (error instanceof DurableRuntimeError) {
      redirect(
        "/projects/" +
          projectId +
          "?durability_error=" +
          encodeURIComponent(error.code),
      );
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?durability_error=cancel_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?durability=cancel_requested");
}


export async function connectExistingRepositoryAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const fullName = String(formData.get("fullName") ?? "");

  try {
    await connectExistingRepository({ projectId, fullName });
  } catch (error) {
    if (error instanceof SourceWorkspaceError) {
      redirect("/projects/" + projectId + "?source_error=" + encodeURIComponent(error.code));
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?source_error=repo_connect_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?source=repository_connected");
}

export async function createProjectRepositoryAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");

  try {
    await createProjectRepository(projectId);
  } catch (error) {
    if (error instanceof SourceWorkspaceError) {
      redirect("/projects/" + projectId + "?source_error=" + encodeURIComponent(error.code));
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?source_error=repo_create_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?source=repository_created");
}

export async function startCodeExecutionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));

  try {
    await startCodeExecution({ projectId, expectedRevision });
  } catch (error) {
    if (error instanceof StaleProjectStateError) {
      redirect("/projects/" + projectId + "?error=stale");
    }
    if (error instanceof SourceWorkspaceError) {
      redirect("/projects/" + projectId + "?build_error=" + encodeURIComponent(error.code));
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?build_error=code_execution_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?build=started");
}

export async function cancelCodeExecutionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const runtimeExecutionId = String(formData.get("runtimeExecutionId") ?? "");

  try {
    await cancelCodeExecution(runtimeExecutionId);
  } catch (error) {
    if (error instanceof SourceWorkspaceError) {
      redirect("/projects/" + projectId + "?build_error=" + encodeURIComponent(error.code));
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "?build_error=cancel_failed");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?build=cancel_requested");
}
