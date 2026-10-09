import { describe, expect, it } from "vitest";
import { GOVERNING_VERSIONS } from "@/aeos/contracts/versions";

describe("governing versions", () => {
  it("binds the intended specifications", () => {
    expect(GOVERNING_VERSIONS.core).toBe("1.1");
    expect(GOVERNING_VERSIONS.softwareProduct).toBe("1.1");
    expect(GOVERNING_VERSIONS.runtime).toBe("1.0");
  });
});
