import { describe, expect, it } from "vitest";
import { buildExecutionContext } from "@/aeos/runtime/context-builder";
import { parseCoreState } from "@/aeos/core/project-state";
import { parseSoftwareProductState } from "@/aeos/specializations/software-product/product-model";

describe("Runtime context builder", () => {
  it("builds context from canonical state rather than conversation history", () => {
    const context = buildExecutionContext({
      project: { id: "project-1", name: "Project" },
      revision: 3,
      coreState: parseCoreState({
        mission: "Create verified progress",
        successStandard: "A verified result exists",
      }),
      specializationState: parseSoftwareProductState({
        productModel: {
          status: "confirmed",
          mvpScope: ["Runtime"],
        },
      }),
      action: {
        id: "action-1",
        profileRevision: 3,
        actionType: "analysis",
        title: "Define requirements",
        objective: "Define build-ready requirements",
        expectedResult: {},
        acceptanceCondition: {},
        requiredCapabilities: [],
      },
    });

    expect(context.project.revision).toBe(3);
    expect(context.productModel.status).toBe("confirmed");
    expect(context.action.title).toBe("Define requirements");
  });
});
