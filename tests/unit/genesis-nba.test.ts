import { describe, expect, it } from "vitest";
import { applyGenesisState, confirmProductModel, genesisInputSchema } from "@/aeos/core/genesis";
import { parseCoreState } from "@/aeos/core/project-state";
import { deriveGenesisConfirmationNba, derivePostConfirmationNba } from "@/aeos/core/nba";
import { parseSoftwareProductState } from "@/aeos/specializations/software-product/product-model";

const input = genesisInputSchema.parse({
  mission: "Create a verified software-product workflow for an independent builder.",
  intendedUser: "Independent builder",
  targetCondition: "A coherent MVP direction can be resumed from durable state.",
  successBasis: "The user can confirm an MVP direction and one current NBA.",
  problemOpportunity: "Project intent is easily lost across fragmented tools and chats.",
  promisedMinimumValue: "A durable, coherent MVP direction with an actionable next step.",
  productHypothesis: "A governed project workspace can turn intent into canonical state.",
  criticalWorkflow: "Create project → Genesis → Product Model → NBA.",
  mvpScope: ["Genesis", "Product Model", "Primary NBA"],
  mvpExclusions: ["Runtime execution"],
  constraints: ["Keep one canonical Project Profile"],
  authorityBoundaries: ["User confirms consequential MVP scope"],
});

describe("Increment 2 Genesis and NBA", () => {
  it("upgrades Increment 1 state into a provisional Product Model", () => {
    const core = parseCoreState({ status: "active", mission: null, successStandard: null });
    const specialization = parseSoftwareProductState({ productModel: { status: "provisional" } });
    const result = applyGenesisState(core, specialization, input);

    expect(result.coreState.genesis.status).toBe("established");
    expect(result.specializationState.productModel.status).toBe("provisional");
    expect(result.specializationState.productModel.mvpScope).toEqual([
      "Genesis",
      "Product Model",
      "Primary NBA",
    ]);
  });

  it("derives one user-owned confirmation dependency from provisional scope", () => {
    const specialization = applyGenesisState(
      parseCoreState({}),
      parseSoftwareProductState({}),
      input,
    ).specializationState;

    const proposal = deriveGenesisConfirmationNba(specialization.productModel);
    expect(proposal.action.title).toMatch(/Confirm/);
    expect(proposal.humanDependency.options).toHaveLength(1);
  });

  it("confirmation advances the Product Model and yields an AEOS-ready next action", () => {
    const specialization = applyGenesisState(
      parseCoreState({}),
      parseSoftwareProductState({}),
      input,
    ).specializationState;

    const confirmed = confirmProductModel(specialization);
    const next = derivePostConfirmationNba(confirmed.productModel);

    expect(confirmed.productModel.status).toBe("confirmed");
    expect(next.title).toMatch(/build-ready requirements/i);
  });
});
