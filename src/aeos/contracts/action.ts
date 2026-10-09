import { z } from "zod";

export const actionOwnerSchema = z.enum(["aeos", "user", "shared"]);
export const actionStatusSchema = z.enum([
  "proposed",
  "ready",
  "active",
  "blocked",
  "completed",
  "cancelled",
  "superseded",
]);

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const actionContractSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  profileRevision: z.number().int().nonnegative(),
  parentActionId: z.string().uuid().nullable(),
  actionType: z.string().min(1),
  title: z.string().min(1).max(200),
  objective: z.string().min(1),
  owner: actionOwnerSchema,
  status: actionStatusSchema,
  expectedResult: jsonObjectSchema,
  acceptanceCondition: jsonObjectSchema,
  requiredCapabilities: z.array(z.unknown()),
  verificationRequirements: z.array(z.unknown()),
  authorityRequirements: jsonObjectSchema,
  input: jsonObjectSchema,
});

export type ActionContract = z.infer<typeof actionContractSchema>;
export type ActionStatus = z.infer<typeof actionStatusSchema>;
