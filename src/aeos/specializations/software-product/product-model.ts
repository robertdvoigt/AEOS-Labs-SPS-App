import { z } from "zod";

const optionalText = z.string().trim().min(1).nullable();
const textList = z.array(z.string().trim().min(1));

export const productModelSchema = z.object({
  status: z.enum(["not_started", "provisional", "confirmed"]).default("not_started"),
  intendedUser: optionalText.default(null),
  problemOpportunity: optionalText.default(null),
  promisedMinimumValue: optionalText.default(null),
  productHypothesis: optionalText.default(null),
  criticalWorkflow: optionalText.default(null),
  mvpScope: textList.default([]),
  mvpExclusions: textList.default([]),
  requirements: z.array(z.record(z.string(), z.unknown())).default([]),
  experienceState: z.record(z.string(), z.unknown()).default({}),
  technicalModel: z.record(z.string(), z.unknown()).default({}),
  buildQualityState: z.record(z.string(), z.unknown()).default({}),
  releaseOperationState: z.record(z.string(), z.unknown()).default({}),
  adaptationState: z.record(z.string(), z.unknown()).default({}),
}).passthrough();

export const softwareProductStateSchema = z.object({
  productModel: productModelSchema.default({
    status: "not_started",
    intendedUser: null,
    problemOpportunity: null,
    promisedMinimumValue: null,
    productHypothesis: null,
    criticalWorkflow: null,
    mvpScope: [],
    mvpExclusions: [],
    requirements: [],
    experienceState: {},
    technicalModel: {},
    buildQualityState: {},
    releaseOperationState: {},
    adaptationState: {},
  }),
}).passthrough();

export type ProductModel = z.infer<typeof productModelSchema>;
export type SoftwareProductState = z.infer<typeof softwareProductStateSchema>;

export function parseSoftwareProductState(value: unknown): SoftwareProductState {
  return softwareProductStateSchema.parse(value ?? {});
}
