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
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();

  if (!appId || !privateKey || !slug || !clientId || !clientSecret) {
    throw new GitHubAppConfigurationError(
      "GitHub App configuration is incomplete.",
    );
  }

  return { appId, privateKey, slug, clientId, clientSecret };
}

export function getGitHubAppOAuthConfig() {
  const { clientId, clientSecret } = requireConfig();
  return { clientId, clientSecret };
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


export async function exchangeGitHubAppUserCode(input: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getGitHubAppOAuthConfig();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("GitHub user authorization exchange failed.");
  }

  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        "GitHub did not return a user access token.",
    );
  }

  return payload.access_token;
}

export async function assertGitHubUserCanAccessInstallation(
  userAccessToken: string,
  installationId: string,
) {
  const targetId = Number(installationId);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) {
    throw new Error("Invalid GitHub installation id.");
  }

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      "https://api.github.com/user/installations?per_page=100&page=" + page,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + userAccessToken,
          "X-GitHub-Api-Version": "2026-03-10",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Could not verify GitHub installation access.");
    }

    const payload = (await response.json()) as {
      total_count?: number;
      installations?: Array<{ id: number }>;
    };
    const installations = payload.installations ?? [];

    if (installations.some((installation) => installation.id === targetId)) {
      return;
    }

    if (installations.length < 100) break;
  }

  throw new Error(
    "The authorized GitHub user cannot access this App installation.",
  );
}
