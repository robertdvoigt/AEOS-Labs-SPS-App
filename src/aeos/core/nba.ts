import type { ProductModel } from "@/aeos/specializations/software-product/product-model";

export type NbaProposal = {
  title: string;
  objective: string;
  expectedResult: Record<string, unknown>;
  acceptanceCondition: Record<string, unknown>;
};

export type HumanDependencyProposal = {
  prompt: string;
  whyHuman: string;
  options: Array<{ value: string; label: string }>;
};

export function deriveGenesisConfirmationNba(productModel: ProductModel): {
  action: NbaProposal;
  humanDependency: HumanDependencyProposal;
} {
  return {
    action: {
      title: "Confirm the provisional MVP direction",
      objective:
        "Confirm or correct the provisional MVP scope before AEOS makes implementation commitments from it.",
      expectedResult: {
        type: "decision",
        outcome: "confirmed_or_corrected_mvp_direction",
        mvpScope: productModel.mvpScope,
      },
      acceptanceCondition: {
        confirmed: true,
        scopeRemainsCoherent: true,
      },
    },
    humanDependency: {
      prompt: "Confirm this MVP direction or correct the Genesis/Product Model first.",
      whyHuman:
        "The MVP scope is a consequential product commitment, so final confirmation remains with the project owner.",
      options: [{ value: "confirm", label: "Confirm MVP direction" }],
    },
  };
}

export function derivePostConfirmationNba(productModel: ProductModel): NbaProposal {
  return {
    title: "Define build-ready requirements for the confirmed MVP",
    objective:
      "Translate the confirmed MVP scope into bounded requirements and verification criteria for the first executable increment.",
    expectedResult: {
      type: "requirements_and_validation_plan",
      mvpScope: productModel.mvpScope,
    },
    acceptanceCondition: {
      requirementsDefined: true,
      verificationPlanDefined: true,
    },
  };
}
