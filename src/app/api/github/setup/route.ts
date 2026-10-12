import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Json } from "@/lib/supabase/database.types";
import { getGitHubInstallationInfo } from "@/integrations/github/app";
import { requireUser } from "@/server/auth";
import { readProjectState } from "@/server/project-state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const cookieStore = await cookies();
  const projectId = cookieStore.get("aeos_github_project")?.value;

  if (!projectId || !installationId) {
    return NextResponse.redirect(new URL("/projects?github_error=missing", url.origin));
  }

  try {
    await readProjectState(projectId);
    const installation = await getGitHubInstallationInfo(installationId);
    const { supabase } = await requireUser();

    const { error } = await supabase.rpc("upsert_github_installation", {
      p_project_id: projectId,
      p_external_account_id: installation.accountId,
      p_installation_id: installation.installationId,
      p_scopes: installation.permissions as Json,
      p_metadata: {
        login: installation.login,
        accountType: installation.accountType,
        repositorySelection: installation.repositorySelection,
      },
    });

    if (error) throw error;

    cookieStore.delete("aeos_github_project");
    return NextResponse.redirect(
      new URL("/projects/" + projectId + "?github=connected", url.origin),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/projects/" + projectId + "?github_error=setup", url.origin),
    );
  }
}
