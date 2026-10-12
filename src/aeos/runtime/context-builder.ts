import type { CoreState } from "@/aeos/core/project-state";
import type { SoftwareProductState } from "@/aeos/specializations/software-product/product-model";

export type RuntimeActionContext = {
  id: string;
  profileRevision: number;
  actionType: string;
  title: string;
  objective: string;
  expectedResult: unknown;
  acceptanceCondition: unknown;
  requiredCapabilities: unknown;
};

export type RuntimeContextInput = {
  project: { id: string; name: string };
  revision: number;
  coreState: CoreState;
  specializationState: SoftwareProductState;
  action: RuntimeActionContext;
};

export function buildExecutionContext(input: RuntimeContextInput) {
  return {
    project: {
      id: input.project.id,
      name: input.project.name,
      revision: input.revision,
      mission: input.coreState.mission,
      successStandard: input.coreState.successStandard,
      targetCondition: input.coreState.targetCondition,
      constraints: input.coreState.constraints,
      authorityBoundaries: input.coreState.authorityBoundaries,
    },
    productModel: input.specializationState.productModel,
    action: input.action,
    sourcePolicy: {
      canonicalProjectStateIsAuthoritative: true,
      doNotInventMissingThresholds: true,
      preserveUnknownsExplicitly: true,
    },
  };
}

export type RuntimeExecutionContext = ReturnType<typeof buildExecutionContext>;
