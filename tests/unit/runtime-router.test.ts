import { describe, expect, it } from "vitest";
import { selectExecutionStrategy } from "@/aeos/runtime/router";

const config = {
  routine: { class: "fast" as const, model: "routine-model" },
  deep: { class: "deep" as const, model: "deep-model" },
};

describe("Runtime model routing", () => {
  it("routes requirements analysis to the deep profile with a routine fallback", () => {
    const strategy = selectExecutionStrategy(
      {
        action_type: "analysis",
        objective: "Define build-ready requirements",
        required_capabilities: [],
      },
      config,
    );

    expect(strategy.primary.model).toBe("deep-model");
    expect(strategy.fallback?.model).toBe("routine-model");
  });

  it("keeps routine reversible actions on the fast path", () => {
    const strategy = selectExecutionStrategy(
      {
        action_type: "classification",
        objective: "Classify the supplied record",
        required_capabilities: [],
      },
      config,
    );

    expect(strategy.primary.model).toBe("routine-model");
    expect(strategy.fallback).toBeNull();
  });
});
