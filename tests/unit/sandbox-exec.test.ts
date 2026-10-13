import { describe, expect, it } from "vitest";
import { parseSandboxExecResponse } from "@/aeos/runtime/sandbox-exec";

describe("parseSandboxExecResponse", () => {
  it("parses a successful Vercel Sandbox command response", () => {
    const result = parseSandboxExecResponse(
      "Chunk ID: test\nWall time: 0.25 seconds\nProcess exited with code 0\nOutput:\nCloning into 'repo'...\n",
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("Cloning into 'repo'...\n");
  });

  it("parses a failed command response", () => {
    const result = parseSandboxExecResponse(
      "Process exited with code 128\nOutput:\nfatal: repository not found\n",
    );

    expect(result.exitCode).toBe(128);
    expect(result.output).toContain("fatal: repository not found");
  });
});
