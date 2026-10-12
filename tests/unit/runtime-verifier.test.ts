import { describe, expect, it } from "vitest";
import { verifyRequirementsOutput } from "@/aeos/runtime/verifier";

describe("Runtime deterministic verification", () => {
  it("passes a build-ready requirements result", () => {
    const verification = verifyRequirementsOutput({
      summary: "Ready",
      requirements: [
        {
          id: "REQ-1",
          title: "Canonical state",
          description: "Persist the current state.",
          acceptanceCriteria: ["Revision is stored."],
          verificationMethods: ["Read the database row."],
          rationale: "Continuity",
        },
      ],
      assumptions: [],
      limitations: [],
    });

    expect(verification.passed).toBe(true);
    expect(verification.details.verificationPlanDefined).toBe(true);
  });

  it("fails when verification methods are absent", () => {
    const verification = verifyRequirementsOutput({
      summary: "Incomplete",
      requirements: [
        {
          id: "REQ-1",
          title: "Canonical state",
          description: "Persist the current state.",
          acceptanceCriteria: ["Revision is stored."],
          verificationMethods: [],
          rationale: "Continuity",
        },
      ],
      assumptions: [],
      limitations: [],
    });

    expect(verification.passed).toBe(false);
  });
});
