export type ParsedSandboxExec = {
  raw: string;
  output: string;
  exitCode?: number;
};

export function parseSandboxExecResponse(raw: string): ParsedSandboxExec {
  const match = raw.match(/Process exited with code (\d+)/);
  const outputMarker = "\nOutput:\n";
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
