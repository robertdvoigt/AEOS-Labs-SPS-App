import { z } from "zod";

const optionalText = z.string().trim().min(1).nullable();
const textList = z.array(z.string().trim().min(1));

export const coreStateSchema = z.object({
  status: z.enum(["active", "paused", "archived"]).default("active"),
  mission: optionalText.default(null),
  successStandard: optionalText.default(null),
  targetCondition: optionalText.default(null),
  constraints: textList.default([]),
  authorityBoundaries: textList.default([]),
  genesis: z.object({
    status: z.enum(["not_started", "in_progress", "established"]).default("not_started"),
  }).passthrough().default({ status: "not_started" }),
}).passthrough();

export type CoreState = z.infer<typeof coreStateSchema>;

export function parseCoreState(value: unknown): CoreState {
  return coreStateSchema.parse(value ?? {});
}
