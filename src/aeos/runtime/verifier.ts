import type { RuntimeAnalysisOutput } from "@/aeos/runtime/contracts";

export type RuntimeVerification = {
  passed: boolean;
  status: "pass" | "fail";
  method: string;
  summary: string;
  details: {
    requirementsDefined: boolean;
    verificationPlanDefined: boolean;
    requirementCount: number;
  };
};

export function verifyRequirementsOutput(output: RuntimeAnalysisOutput): RuntimeVerification {
  const requirementsDefined =
    output.requirements.length > 0 &&
    output.requirements.every(
      (item) =>
        item.id.trim().length > 0 &&
        item.title.trim().length > 0 &&
        item.description.trim().length > 0 &&
        item.acceptanceCriteria.length > 0,
    );

  const verificationPlanDefined =
    output.requirements.length > 0 &&
    output.requirements.every(
      (item) =>
        item.verificationMethods.length > 0 &&
        item.verificationMethods.every((method) => method.trim().length > 0),
    );

  const passed = requirementsDefined && verificationPlanDefined;

  return {
    passed,
    status: passed ? "pass" : "fail",
    method: "deterministic structured-output validation",
    summary: passed
      ? "Build-ready requirements include acceptance criteria and verification methods."
      : "The structured result is missing build-ready requirements or verification methods.",
    details: {
      requirementsDefined,
      verificationPlanDefined,
      requirementCount: output.requirements.length,
    },
  };
}
