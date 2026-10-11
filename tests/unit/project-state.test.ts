import { describe, expect, it } from "vitest";
import { mergeMission } from "@/server/project-state";

describe("canonical project state helpers", () => {
  it("updates mission without dropping other core state", () => {
    expect(
      mergeMission(
        {
          status: "active",
          successStandard: "A verified MVP",
          mission: "Old mission",
        },
        "New mission",
      ),
    ).toEqual({
      status: "active",
      successStandard: "A verified MVP",
      mission: "New mission",
    });
  });

  it("normalizes non-object core state before adding mission", () => {
    expect(mergeMission([], "Mission")).toEqual({ mission: "Mission" });
  });
});
