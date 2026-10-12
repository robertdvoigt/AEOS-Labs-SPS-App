import { describe, expect, it } from "vitest";
import { isRuntimeStateActive } from "@/aeos/runtime/status";

describe("durable workflow UI state", () => {
  it("polls all durable active execution states", () => {
    expect(isRuntimeStateActive("queued")).toBe(true);
    expect(isRuntimeStateActive("running")).toBe(true);
    expect(isRuntimeStateActive("waiting_for_external")).toBe(true);
  });

  it("stops polling terminal durability states", () => {
    expect(isRuntimeStateActive("succeeded")).toBe(false);
    expect(isRuntimeStateActive("cancelled")).toBe(false);
    expect(isRuntimeStateActive("failed")).toBe(false);
  });
});
