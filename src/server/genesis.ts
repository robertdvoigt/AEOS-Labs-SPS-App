import type { Json } from "@/lib/supabase/database.types";
import { genesisInputSchema, applyGenesisState, confirmProductModel } from "@/aeos/core/genesis";
import { parseCoreState } from "@/aeos/core/project-state";
import { deriveGenesisConfirmationNba, derivePostConfirmationNba } from "@/aeos/core/nba";
import { parseSoftwareProductState } from "@/aeos/specializations/software-product/product-model";
import { readProjectState, StaleProjectStateError } from "@/server/project-state";
import { requireUser } from "@/server/auth";

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function parseLineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function establishGenesis(input: {
  projectId: string;
  expectedRevision: number;
  mission: string;
  intendedUser: string;
  targetCondition: string;
  successBasis: string;
  problemOpportunity: string;
  promisedMinimumValue: string;
  productHypothesis: string;
  criticalWorkflow: string;
  mvpScope: string[];
  mvpExclusions: string[];
  constraints: string[];
  authorityBoundaries: string[];
}) {
  const parsedInput = genesisInputSchema.parse(input);
  const state = await readProjectState(input.projectId);
  const currentCore = parseCoreState(state.profile.core_state);
  const currentSpecialization = parseSoftwareProductState(state.profile.specialization_state);
  const next = applyGenesisState(currentCore, currentSpecialization, parsedInput);
  const nba = deriveGenesisConfirmationNba(next.specializationState.productModel);
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("establish_genesis_and_nba", {
    p_project_id: input.projectId,
    p_expected_revision: input.expectedRevision,
    p_core_state: toJson(next.coreState),
    p_specialization_state: toJson(next.specializationState),
    p_nba_title: nba.action.title,
    p_nba_objective: nba.action.objective,
    p_nba_expected_result: toJson(nba.action.expectedResult),
    p_nba_acceptance_condition: toJson(nba.action.acceptanceCondition),
    p_human_prompt: nba.humanDependency.prompt,
    p_human_why: nba.humanDependency.whyHuman,
    p_human_options: toJson(nba.humanDependency.options),
  });

  if (error) {
    if (error.code === "40001") throw new StaleProjectStateError();
    throw error;
  }

  return data;
}

export async function confirmMvpDirection(input: {
  projectId: string;
  expectedRevision: number;
}) {
  const state = await readProjectState(input.projectId);
  const currentSpecialization = parseSoftwareProductState(state.profile.specialization_state);
  const confirmedState = confirmProductModel(currentSpecialization);
  const nba = derivePostConfirmationNba(confirmedState.productModel);
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("confirm_mvp_direction", {
    p_project_id: input.projectId,
    p_expected_revision: input.expectedRevision,
    p_specialization_state: toJson(confirmedState),
    p_next_nba_title: nba.title,
    p_next_nba_objective: nba.objective,
    p_next_nba_expected_result: toJson(nba.expectedResult),
    p_next_nba_acceptance_condition: toJson(nba.acceptanceCondition),
  });

  if (error) {
    if (error.code === "40001") throw new StaleProjectStateError();
    throw error;
  }

  return data;
}
