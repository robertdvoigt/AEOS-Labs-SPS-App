import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Json } from "@/lib/supabase/database.types";
import {
  assertGitHubUserCanAccessInstallation,
  exchangeGitHubAppUserCode,
  getGitHubInstallationInfo,
} from "@/integrations/github/app";
import { requireUser } from "@/server/auth";
import { readProjectState } from "@/server/project-state";

function equalState(actual: string, expected: string) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const projectId = cookieStore.get("aeos_github_project")?.value;
  const installationId = cookieStore.get("aeos_github_installation")?.value;
  const expectedState = cookieStore.get("aeos_github_oauth_state")?.value;

  if (
    !projectId ||
    !installationId ||
    !code ||
    !state ||
    !expectedState ||
    !equalState(state, expectedState)
  ) {
    return NextResponse.redirect(
      new URL(
        "/projects/" + (projectId ?? "") + "?github_error=authorization",
        url.origin,
      ),
    );
  }

  try {
    await readProjectState(projectId);

    const callbackUrl = new URL("/api/github/callback", url.origin).toString();
    const userToken = await exchangeGitHubAppUserCode({
      code,
      redirectUri: callbackUrl,
    });

    await assertGitHubUserCanAccessInstallation(userToken, installationId);

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
    cookieStore.delete("aeos_github_installation");
    cookieStore.delete("aeos_github_oauth_state");

    return NextResponse.redirect(
      new URL("/projects/" + projectId + "?github=connected", url.origin),
    );
  } catch {
    return NextResponse.redirect(
      new URL(
        "/projects/" + projectId + "?github_error=authorization",
        url.origin,
      ),
    );
  }
}
