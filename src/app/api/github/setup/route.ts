import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGitHubAppOAuthConfig } from "@/integrations/github/app";
import { readProjectState } from "@/server/project-state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const cookieStore = await cookies();
  const projectId = cookieStore.get("aeos_github_project")?.value;

  if (!projectId || !installationId) {
    return NextResponse.redirect(
      new URL("/projects?github_error=missing", url.origin),
    );
  }

  try {
    await readProjectState(projectId);

    const { clientId } = getGitHubAppOAuthConfig();
    const state = randomBytes(32).toString("hex");
    const callbackUrl = new URL("/api/github/callback", url.origin).toString();

    cookieStore.set("aeos_github_installation", installationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    cookieStore.set("aeos_github_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", callbackUrl);
    authorize.searchParams.set("state", state);

    return NextResponse.redirect(authorize);
  } catch {
    return NextResponse.redirect(
      new URL("/projects/" + projectId + "?github_error=setup", url.origin),
    );
  }
}
