"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProject } from "@/server/project-state";

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const goal = String(formData.get("goal") ?? "");

  try {
    const projectId = await createProject(name, goal);
    revalidatePath("/projects");
    redirect(`/projects/${projectId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/projects?error=create");
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
