"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RuntimeControllerError, executeAction } from "@/aeos/runtime/runtime-controller";
import { confirmMvpDirection } from "@/server/genesis";
import { StaleProjectStateError } from "@/server/project-state";

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
