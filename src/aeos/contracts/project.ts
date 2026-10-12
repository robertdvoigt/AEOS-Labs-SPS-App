import { z } from "zod";
import { coreStateSchema } from "@/aeos/core/project-state";
import { softwareProductStateSchema } from "@/aeos/specializations/software-product/product-model";

export const projectProfileSchema = z.object({
  projectId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  coreState: coreStateSchema,
  specializationState: softwareProductStateSchema,
  currentNbaActionId: z.string().uuid().nullable(),
});

export type ProjectProfile = z.infer<typeof projectProfileSchema>;
