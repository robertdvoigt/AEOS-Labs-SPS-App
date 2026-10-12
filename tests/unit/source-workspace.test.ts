import { describe, expect, it } from "vitest";

function branchFor(actionId: string) {
  return "aeos/" + actionId.slice(0, 8) + "/first-build";
}

describe("Increment 5 code branch convention", () => {
  it("creates one stable action-scoped branch name", () => {
    expect(branchFor("62ab7abd-60a5-416e-a977-a145cbecb277")).toBe(
      "aeos/62ab7abd/first-build",
    );
  });
});
