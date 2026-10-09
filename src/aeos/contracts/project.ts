import { z } from "zod";

export const projectProfileSchema = z.object({
  projectId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  coreState: z.record(z.string(), z.unknown()),
  specializationState: z.record(z.string(), z.unknown()),
  currentNbaActionId: z.string().uuid().nullable(),
});

export type ProjectProfile = z.infer<typeof projectProfileSchema>;
