import { z } from "zod";

export const runtimeRequirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string()),
  verificationMethods: z.array(z.string()),
  rationale: z.string(),
});

export const runtimeAnalysisOutputSchema = z.object({
  summary: z.string(),
  requirements: z.array(runtimeRequirementSchema),
  assumptions: z.array(z.string()),
  limitations: z.array(z.string()),
});

export type RuntimeRequirement = z.infer<typeof runtimeRequirementSchema>;
export type RuntimeAnalysisOutput = z.infer<typeof runtimeAnalysisOutputSchema>;

export type RuntimeUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type RuntimeModelProfile = {
  class: "fast" | "standard" | "deep" | "critical";
  model: string;
};

export type RuntimeProviderResult = {
  provider: "openai";
  model: string;
  providerResponseId: string;
  output: RuntimeAnalysisOutput;
  usage: RuntimeUsage;
};
