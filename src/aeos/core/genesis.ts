import { z } from "zod";
import type { CoreState } from "@/aeos/core/project-state";
import type { SoftwareProductState } from "@/aeos/specializations/software-product/product-model";

const textList = z.array(z.string().trim().min(1));

export const genesisInputSchema = z.object({
  mission: z.string().trim().min(8).max(1200),
  intendedUser: z.string().trim().min(3).max(800),
  targetCondition: z.string().trim().min(5).max(1200),
  successBasis: z.string().trim().min(5).max(1200),
  problemOpportunity: z.string().trim().min(5).max(1600),
  promisedMinimumValue: z.string().trim().min(5).max(1200),
  productHypothesis: z.string().trim().min(5).max(1600),
  criticalWorkflow: z.string().trim().min(5).max(1600),
  mvpScope: textList.min(1).max(20),
  mvpExclusions: textList.max(20),
  constraints: textList.max(20),
  authorityBoundaries: textList.max(20),
});

export type GenesisInput = z.infer<typeof genesisInputSchema>;

export function applyGenesisState(
  coreState: CoreState,
  softwareProductState: SoftwareProductState,
  input: GenesisInput,
) {
  const nextCore: CoreState = {
    ...coreState,
    mission: input.mission,
    successStandard: input.successBasis,
    targetCondition: input.targetCondition,
    constraints: input.constraints,
    authorityBoundaries: input.authorityBoundaries,
    genesis: {
      ...coreState.genesis,
      status: "established",
    },
  };

  const nextSpecialization: SoftwareProductState = {
    ...softwareProductState,
    productModel: {
      ...softwareProductState.productModel,
      status: "provisional",
      intendedUser: input.intendedUser,
      problemOpportunity: input.problemOpportunity,
      promisedMinimumValue: input.promisedMinimumValue,
      productHypothesis: input.productHypothesis,
      criticalWorkflow: input.criticalWorkflow,
      mvpScope: input.mvpScope,
      mvpExclusions: input.mvpExclusions,
    },
  };

  return { coreState: nextCore, specializationState: nextSpecialization };
}

export function confirmProductModel(state: SoftwareProductState): SoftwareProductState {
  return {
    ...state,
    productModel: {
      ...state.productModel,
      status: "confirmed",
    },
  };
}
