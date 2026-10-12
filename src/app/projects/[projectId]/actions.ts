"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
