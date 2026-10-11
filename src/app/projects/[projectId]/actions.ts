"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  StaleProjectStateError,
  updateProjectMission,
} from "@/server/project-state";

export async function updateMissionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));
  const mission = String(formData.get("mission") ?? "").trim();

  if (!projectId || !Number.isInteger(expectedRevision) || !mission) {
    redirect(`/projects/${projectId}?error=invalid`);
  }

  try {
    await updateProjectMission({
      projectId,
      expectedRevision,
      mission,
    });
  } catch (error) {
    if (error instanceof StaleProjectStateError) {
      redirect(`/projects/${projectId}?error=stale`);
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect(`/projects/${projectId}?error=update`);
  }

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?updated=1`);
}
