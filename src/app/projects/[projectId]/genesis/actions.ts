"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { establishGenesis, parseLineList } from "@/server/genesis";
import { StaleProjectStateError } from "@/server/project-state";

export async function saveGenesisAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const expectedRevision = Number(formData.get("expectedRevision"));

  try {
    await establishGenesis({
      projectId,
      expectedRevision,
      mission: String(formData.get("mission") ?? ""),
      intendedUser: String(formData.get("intendedUser") ?? ""),
      targetCondition: String(formData.get("targetCondition") ?? ""),
      successBasis: String(formData.get("successBasis") ?? ""),
      problemOpportunity: String(formData.get("problemOpportunity") ?? ""),
      promisedMinimumValue: String(formData.get("promisedMinimumValue") ?? ""),
      productHypothesis: String(formData.get("productHypothesis") ?? ""),
      criticalWorkflow: String(formData.get("criticalWorkflow") ?? ""),
      mvpScope: parseLineList(String(formData.get("mvpScope") ?? "")),
      mvpExclusions: parseLineList(String(formData.get("mvpExclusions") ?? "")),
      constraints: parseLineList(String(formData.get("constraints") ?? "")),
      authorityBoundaries: parseLineList(String(formData.get("authorityBoundaries") ?? "")),
    });
  } catch (error) {
    if (error instanceof StaleProjectStateError) {
      redirect("/projects/" + projectId + "/genesis?error=stale");
    }
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects/" + projectId + "/genesis?error=invalid");
  }

  revalidatePath("/projects/" + projectId);
  redirect("/projects/" + projectId + "?genesis=1");
}
