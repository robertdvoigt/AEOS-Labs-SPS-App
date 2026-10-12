import { z } from "zod";

export const actionContractSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  profileRevision: z.number().int().nonnegative(),
  title: z.string().min(1),
  objective: z.string().min(1),
  owner: z.enum(["aeos", "user", "shared"]),
  status: z.string().min(1),
  expectedResult: z.unknown(),
  acceptanceCondition: z.unknown(),
});

export const humanDependencySchema = z.object({
  id: z.string().uuid(),
  actionId: z.string().uuid(),
  projectId: z.string().uuid(),
  kind: z.string().min(1),
  prompt: z.string().min(1),
  whyHuman: z.string().min(1),
  options: z.unknown(),
  status: z.enum(["open", "resolved", "cancelled"]),
  resolvedValue: z.unknown().nullable(),
});

export type ActionContract = z.infer<typeof actionContractSchema>;
export type HumanDependency = z.infer<typeof humanDependencySchema>;
