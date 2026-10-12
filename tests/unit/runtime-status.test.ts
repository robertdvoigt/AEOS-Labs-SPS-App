import { describe, expect, it } from "vitest";
import { isRuntimeStateActive } from "@/aeos/runtime/status";

describe("Runtime active-state detection", () => {
  it.each(["queued", "preparing", "running", "waiting_for_human", "waiting_for_external", "verifying", "reconciling"])(
    "treats %s as active",
    (state) => {
      expect(isRuntimeStateActive(state)).toBe(true);
    },
  );

  it.each(["succeeded", "failed", "cancelled", "inconclusive", undefined])(
    "treats %s as inactive",
    (state) => {
      expect(isRuntimeStateActive(state)).toBe(false);
    },
  );
});
