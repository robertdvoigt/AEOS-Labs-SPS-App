import { App } from "@octokit/app";

export type GitHubInstallationInfo = {
  installationId: string;
  accountId: string;
  login: string;
  accountType: "User" | "Organization";
  repositorySelection: string;
  permissions: Record<string, string>;
};

export type GitHubRepositoryInfo = {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  htmlUrl: string;
};

export class GitHubAppConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAppConfigurationError";
  }
}

function requireConfig() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const slug = process.env.GITHUB_APP_SLUG?.trim();

  if (!appId || !privateKey || !slug) {
    throw new GitHubAppConfigurationError(
      "GitHub App configuration is incomplete.",
    );
  }

  return { appId, privateKey, slug };
}

export function getGitHubAppSlug() {
  return requireConfig().slug;
}

export function createGitHubApp() {
  const { appId, privateKey } = requireConfig();
  return new App({ appId, privateKey });
}

export async function getGitHubInstallationInfo(
  installationId: string,
): Promise<GitHubInstallationInfo> {
  const app = createGitHubApp();
  const { data } = await app.octokit.request(
    "GET /app/installations/{installation_id}",
    { installation_id: Number(installationId) },
  );

  const account = data.account;
  if (!account || !("login" in account) || !account.login) {
    throw new Error("GitHub installation account is unavailable.");
  }

  const accountType =
    "type" in account && account.type === "Organization"
      ? "Organization"
      : "User";

  return {
    installationId: String(data.id),
    accountId: String(account.id),
    login: account.login,
    accountType,
    repositorySelection: data.repository_selection,
    permissions: { ...data.permissions } as Record<string, string>,
  };
}

export async function getGitHubInstallationOctokit(installationId: string) {
  return await createGitHubApp().getInstallationOctokit(Number(installationId));
}

export async function getGitHubInstallationToken(installationId: string) {
  const app = createGitHubApp();
  const auth = (await app.octokit.auth({
    type: "installation",
    installationId: Number(installationId),
  })) as { token?: string };

  if (!auth.token) {
    throw new Error("GitHub installation token was not returned.");
  }

  return auth.token;
}

export async function getRepositoryForInstallation(
  installationId: string,
  owner: string,
  repo: string,
): Promise<GitHubRepositoryInfo> {
  const octokit = await getGitHubInstallationOctokit(installationId);
  const { data } = await octokit.request("GET /repos/{owner}/{repo}", {
    owner,
    repo,
  });

  return {
    id: String(data.id),
    owner: data.owner.login,
    repo: data.name,
    defaultBranch: data.default_branch || "main",
    htmlUrl: data.html_url,
  };
}

export async function createRepositoryForInstallation(input: {
  installationId: string;
  name: string;
  description: string;
}): Promise<GitHubRepositoryInfo> {
  const info = await getGitHubInstallationInfo(input.installationId);

  if (info.repositorySelection !== "all") {
    throw new Error(
      "Automatic repository creation requires this GitHub App installation to have access to all repositories. Existing selected repositories can still be connected.",
    );
  }

  const octokit = await getGitHubInstallationOctokit(input.installationId);
  const common = {
    name: input.name,
    description: input.description,
    private: true,
    auto_init: true,
  };

  const response =
    info.accountType === "Organization"
      ? await octokit.request("POST /orgs/{org}/repos", {
          org: info.login,
          ...common,
        })
      : await octokit.request("POST /user/repos", common);

  const data = response.data;
  return {
    id: String(data.id),
    owner: data.owner.login,
    repo: data.name,
    defaultBranch: data.default_branch || "main",
    htmlUrl: data.html_url,
  };
}
