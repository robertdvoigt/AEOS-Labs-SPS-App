import { run } from "@openai/agents";
import {
  Capabilities,
  Manifest,
  SandboxAgent,
  dir,
  file,
} from "@openai/agents/sandbox";
import { VercelSandboxClient } from "@openai/agents-extensions/sandbox/vercel";
import { createWorkflowSupabaseClient } from "@/integrations/supabase/workflow-client";
import { getGitHubInstallationToken } from "@/integrations/github/app";
import type { Json } from "@/lib/supabase/database.types";

type CodeExecutionInput = {
  runtimeExecutionId: string;
  codeChangeId: string;
  capabilityToken: string;
  installationId: string;
  repository: {
    owner: string;
    repo: string;
    defaultBranch: string;
  };
  branch: string;
  task: Record<string, unknown>;
};

function shellQuote(value: string) {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

type ExecCommandCapable = {
  execCommand?: (args: {
    cmd: string;
    workdir?: string;
    maxOutputTokens?: number;
  }) => Promise<string>;
};

type ParsedExec = {
  raw: string;
  output: string;
  exitCode?: number;
};

function parseExecResponse(raw: string): ParsedExec {
  const match = raw.match(/Process exited with code (\\d+)/);
  const outputMarker = "\\nOutput:\\n";
  const outputIndex = raw.indexOf(outputMarker);

  return {
    raw,
    output:
      outputIndex >= 0
        ? raw.slice(outputIndex + outputMarker.length)
        : raw,
    exitCode: match ? Number(match[1]) : undefined,
  };
}

async function exec(
  sandbox: ExecCommandCapable,
  cmd: string,
  workdir?: string,
  allowFailure = false,
): Promise<ParsedExec> {
  if (!sandbox.execCommand) {
    throw new Error("Sandbox does not expose command execution.");
  }

  const raw = await sandbox.execCommand({
    cmd,
    workdir,
    maxOutputTokens: 12000,
  });
  const result = parseExecResponse(raw);

  if (!allowFailure && result.exitCode !== 0) {
    throw new Error(
      "Sandbox command failed: " +
        cmd.slice(0, 120) +
        "\\n" +
        result.output.slice(-4000),
    );
  }

  return result;
}

async function checkpoint(
  input: CodeExecutionInput,
  sequence: number,
  phase: string,
  state: Record<string, Json | undefined>,
) {
  const supabase = createWorkflowSupabaseClient();
  const { data, error } = await supabase.rpc("workflow_runtime_checkpoint", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
    p_sequence: sequence,
    p_phase: phase,
    p_state: state,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

async function control(input: CodeExecutionInput) {
  const supabase = createWorkflowSupabaseClient();
  const { data, error } = await supabase.rpc("workflow_runtime_control", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
  });
  if (error) throw new Error(error.message);
  return data as { state?: string; cancelRequested?: boolean };
}

async function runCodeExecutionStep(input: CodeExecutionInput) {
  "use step";

  const initial = await control(input);
  if (initial.state === "succeeded") {
    return { status: "succeeded", recovered: true };
  }
  if (initial.state === "cancelled" || initial.state === "failed") {
    return { status: initial.state };
  }

  const token = await getGitHubInstallationToken(input.installationId);
  const manifest = new Manifest({
    entries: {
      task: dir({
        children: {
          "action-contract.json": file({
            content: JSON.stringify(input.task, null, 2),
          }),
          "README.md": file({
            content:
              "# AEOS bounded build task\n\nRead action-contract.json before editing the repository.\n",
          }),
        },
      }),
    },
  });

  const client = new VercelSandboxClient({
    runtime: "node24",
    timeoutMs: 30 * 60 * 1000,
    workspacePersistence: "tar",
    networkPolicy: {
      mode: "custom",
      allowedDomains: [
        "github.com",
        "*.githubusercontent.com",
        "registry.npmjs.org",
      ],
    },
  });

  const sandbox = await client.create({ manifest });
  const sandboxRef = sandbox.state.sandboxId;
  const root = sandbox.state.manifest.root;
  const credentialFile = root + "/.git-credentials";
  const repoDir = "repo";

  try {
    const credentialUrl =
      "https://x-access-token:" + encodeURIComponent(token) + "@github.com\n";

    await sandbox.materializeEntry?.({
      path: ".git-credentials",
      entry: file({ content: credentialUrl, ephemeral: true }),
    });

    const cloneUrl =
      "https://github.com/" +
      input.repository.owner +
      "/" +
      input.repository.repo +
      ".git";

    await exec(
      sandbox,
      "git -c credential.helper=" +
        shellQuote("store --file=" + credentialFile) +
        " clone --depth 50 --branch " +
        shellQuote(input.repository.defaultBranch) +
        " " +
        shellQuote(cloneUrl) +
        " " +
        shellQuote(repoDir),
      root,
    );

    const baseCommit = (
      await exec(
        sandbox,
        "git rev-parse origin/" + shellQuote(input.repository.defaultBranch),
        root + "/" + repoDir,
      )
    ).output.trim();

    const remoteBranchProbe = await exec(
      sandbox,
      "git -c credential.helper=" +
        shellQuote("store --file=" + credentialFile) +
        " ls-remote --exit-code --heads origin " +
        shellQuote("refs/heads/" + input.branch),
      root + "/" + repoDir,
      true,
    );

    const remoteBranchExists = remoteBranchProbe.exitCode === 0;

    if (remoteBranchExists) {
      await exec(
        sandbox,
        "git -c credential.helper=" +
          shellQuote("store --file=" + credentialFile) +
          " fetch origin " +
          shellQuote(input.branch) +
          ":" +
          shellQuote(input.branch) +
          " && git checkout " +
          shellQuote(input.branch),
        root + "/" + repoDir,
      );
    } else {
      await exec(
        sandbox,
        "git checkout -b " + shellQuote(input.branch),
        root + "/" + repoDir,
      );
    }

    await exec(sandbox, "rm -f " + shellQuote(credentialFile), root);

    await checkpoint(input, 1, "sandbox_created", {
      sandboxRef,
      baseCommit,
      branch: input.branch,
      recoveredRemoteBranch: remoteBranchExists,
    });

    const afterSetup = await control(input);
    if (afterSetup.cancelRequested) {
      const supabase = createWorkflowSupabaseClient();
      await supabase.rpc("workflow_cancel_code_execution", {
        p_runtime_execution_id: input.runtimeExecutionId,
        p_capability_token: input.capabilityToken,
        p_code_change_id: input.codeChangeId,
      });
      return { status: "cancelled" };
    }

    let agentSummary = "Recovered an already-pushed branch during a workflow retry.";

    if (!remoteBranchExists) {
      const model =
        process.env.OPENAI_MODEL_CODING?.trim() ||
        process.env.OPENAI_MODEL_DEEP?.trim() ||
        "gpt-6.1-sol";

      const agent = new SandboxAgent({
        name: "AEOS Coding Agent",
        model,
        instructions:
          "You are implementing one bounded AEOS Action Contract. Read ../task/action-contract.json before changing anything. Inspect the existing repository first. Implement the smallest coherent first build-ready increment that materially advances the supplied requirements. Do not broaden scope, modify secrets, change external infrastructure, push commits, or claim browser verification. Preserve existing behavior. Run targeted checks while working; the Runtime will run the full deterministic verification suite after you finish.",
        capabilities: Capabilities.default(),
      });

      const result = await run(
        agent,
        "Implement the bounded first build increment described in ../task/action-contract.json. Make the changes in this repository only, leave them uncommitted, and summarize what you changed.",
        {
          sandbox: {
            session: sandbox,
            cwd: repoDir,
          },
          maxTurns: 30,
        },
      );

      agentSummary =
        typeof result.finalOutput === "string"
          ? result.finalOutput.slice(0, 5000)
          : JSON.stringify(result.finalOutput).slice(0, 5000);

      await checkpoint(input, 2, "agent_completed", {
        sandboxRef,
        summary: agentSummary,
      });
    }

    const afterAgent = await control(input);
    if (afterAgent.cancelRequested) {
      const supabase = createWorkflowSupabaseClient();
      await supabase.rpc("workflow_cancel_code_execution", {
        p_runtime_execution_id: input.runtimeExecutionId,
        p_capability_token: input.capabilityToken,
        p_code_change_id: input.codeChangeId,
      });
      return { status: "cancelled" };
    }

    const verifyScript = [
      "set -e",
      "test -f package.json",
      "corepack enable",
      "if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install --no-frozen-lockfile; fi",
      "for s in typecheck lint test build; do",
      "  if node -e \"const p=require('./package.json'); process.exit(p.scripts&&p.scripts[process.argv[1]]?0:1)\" \"$s\"; then pnpm \"$s\"; fi",
      "done",
    ].join("\n");

    const verification = await exec(
      sandbox,
      "bash -lc " + shellQuote(verifyScript),
      root + "/" + repoDir,
    );

    await checkpoint(input, 3, "local_verification_passed", {
      sandboxRef,
      output: verification.output.slice(-6000),
    });

    let headCommit: string;

    if (remoteBranchExists) {
      headCommit = (
        await exec(sandbox, "git rev-parse HEAD", root + "/" + repoDir)
      ).output.trim();
    } else {
      const status = (
        await exec(sandbox, "git status --porcelain", root + "/" + repoDir)
      ).output.trim();

      if (!status) {
        throw new Error("Coding agent produced no repository changes.");
      }

      await exec(
        sandbox,
        "git config user.name " +
          shellQuote("AEOS Runtime") +
          " && git config user.email " +
          shellQuote("runtime@aeos.invalid") +
          " && git add -A && git commit -m " +
          shellQuote("AEOS: implement first bounded build increment"),
        root + "/" + repoDir,
      );

      headCommit = (
        await exec(sandbox, "git rev-parse HEAD", root + "/" + repoDir)
      ).output.trim();

      const pushToken = await getGitHubInstallationToken(input.installationId);
      await sandbox.materializeEntry?.({
        path: ".git-credentials",
        entry: file({
          content:
            "https://x-access-token:" +
            encodeURIComponent(pushToken) +
            "@github.com\n",
          ephemeral: true,
        }),
      });

      try {
        await exec(
          sandbox,
          "git -c credential.helper=" +
            shellQuote("store --file=" + credentialFile) +
            " push --set-upstream origin " +
            shellQuote(input.branch),
          root + "/" + repoDir,
        );
      } finally {
        await exec(sandbox, "rm -f " + shellQuote(credentialFile), root, true);
      }
    }

    await checkpoint(input, 4, "branch_pushed", {
      sandboxRef,
      baseCommit,
      headCommit,
      branch: input.branch,
    });

    const supabase = createWorkflowSupabaseClient();
    const { error: completeError } = await supabase.rpc(
      "workflow_complete_code_execution",
      {
        p_runtime_execution_id: input.runtimeExecutionId,
        p_capability_token: input.capabilityToken,
        p_code_change_id: input.codeChangeId,
        p_branch: input.branch,
        p_base_commit: baseCommit,
        p_head_commit: headCommit,
        p_result: {
          sandboxRef,
          branch: input.branch,
          baseCommit,
          headCommit,
          agentSummary,
          localVerificationPassed: true,
        },
        p_verification_details: {
          testsPassed: true,
          buildPassed: true,
          browserVerificationPending: true,
        },
      },
    );

    if (completeError) throw new Error(completeError.message);

    return {
      status: "succeeded",
      sandboxRef,
      branch: input.branch,
      baseCommit,
      headCommit,
    };
  } finally {
    await sandbox.delete?.();
  }
}

async function failCodeExecutionStep(
  input: CodeExecutionInput,
  message: string,
) {
  "use step";
  const supabase = createWorkflowSupabaseClient();
  const { error } = await supabase.rpc("workflow_fail_code_execution", {
    p_runtime_execution_id: input.runtimeExecutionId,
    p_capability_token: input.capabilityToken,
    p_code_change_id: input.codeChangeId,
    p_error_message: message,
  });
  if (error) throw new Error(error.message);
}

export async function codeExecutionWorkflow(input: CodeExecutionInput) {
  "use workflow";

  try {
    return await runCodeExecutionStep(input);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Code execution workflow failed.";
    try {
      await failCodeExecutionStep(input, message);
    } catch {
      // Terminal state may already have been committed by an idempotent retry.
    }
    throw error;
  }
}
