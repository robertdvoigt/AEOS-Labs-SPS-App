import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGitHubAppSlug } from "@/integrations/github/app";
import { readProjectState } from "@/server/project-state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.redirect(new URL("/projects", url.origin));
  }

  try {
    await readProjectState(projectId);
    const slug = getGitHubAppSlug();
    const cookieStore = await cookies();

    cookieStore.set("aeos_github_project", projectId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return NextResponse.redirect(
      "https://github.com/apps/" +
        encodeURIComponent(slug) +
        "/installations/new",
    );
  } catch {
    return NextResponse.redirect(
      new URL("/projects/" + projectId + "?github_error=config", url.origin),
    );
  }
}
