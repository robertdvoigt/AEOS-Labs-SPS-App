import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCoreState } from "@/aeos/core/project-state";
import { parseSoftwareProductState } from "@/aeos/specializations/software-product/product-model";
import { createProject } from "@/server/project-state";

const { requireUser, rpc } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ requireUser }));

const projectId = "55555555-5555-4555-8555-555555555555";

describe("goal-based project creation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireUser.mockResolvedValue({ supabase: { rpc } });
    rpc.mockResolvedValue({ data: projectId, error: null });
  });

  it("atomically persists the supplied goal in the initial canonical profile", async () => {
    const goal = "Help independent builders schedule customer interviews.";
    await expect(createProject("  Interview planner  ", `  ${goal}\n`))
      .resolves.toBe(projectId);

    expect(requireUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_project_with_profile", {
      p_name: "Interview planner",
      p_core_state: expect.objectContaining({ mission: goal }),
      p_specialization_state: expect.any(Object),
    });

    const state = rpc.mock.calls[0][1];
    const core = parseCoreState(state.p_core_state);
    const product = parseSoftwareProductState(state.p_specialization_state).productModel;
    expect(core.genesis.status).toBe("not_started");
    expect(core.successStandard).toBeNull();
    expect(core.targetCondition).toBeNull();
    expect(product.status).toBe("not_started");
    expect(product.intendedUser).toBeNull();
    expect(product.mvpScope).toEqual([]);
    expect(product.requirements).toEqual([]);
  });

  it.each(["", " \n\t ", "a".repeat(1201)])(
    "rejects an empty or oversized goal before persistence",
    async (goal) => {
      await expect(createProject("Valid name", goal)).rejects.toThrow("Project goal");
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it.each(["", " \n ", "a".repeat(161)])(
    "preserves project name validation",
    async (name) => {
      await expect(createProject(name, "Valid goal")).rejects.toThrow("Project name");
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("accepts the goal length boundary without truncating user input", async () => {
    const goal = "a".repeat(1200);
    await createProject("Valid name", goal);
    expect(rpc.mock.calls[0][1].p_core_state.mission).toBe(goal);
  });

  it("cannot create state when authentication fails", async () => {
    requireUser.mockRejectedValue(new Error("Authentication required"));
    await expect(createProject("Valid name", "Valid goal")).rejects.toThrow(
      "Authentication required",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("propagates persistence failures rather than returning a project identifier", async () => {
    const error = new Error("Project creation failed");
    rpc.mockResolvedValue({ data: null, error });
    await expect(createProject("Valid name", "Valid goal")).rejects.toBe(error);
  });
});