import type { Json } from "@/lib/supabase/database.types";
import { requireUser } from "@/server/auth";

export class StaleProjectStateError extends Error {
  constructor() {
    super("Project state changed before this update could be applied.");
    this.name = "StaleProjectStateError";
  }
}

function asObject(value: Json): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

export function mergeMission(coreState: Json, mission: string): Json {
  return {
    ...asObject(coreState),
    mission,
  };
}

export async function listProjects() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("id,name,status,updated_at,core_version,software_product_version,runtime_version")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createProject(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 160) {
    throw new Error("Project name must be between 1 and 160 characters.");
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_project_with_profile", {
    p_name: trimmed,
    p_core_state: {
      mission: null,
      successStandard: null,
      status: "active",
    },
    p_specialization_state: {
      productModel: {
        status: "provisional",
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function readProjectState(projectId: string) {
  const { supabase } = await requireUser();

  const [projectResult, profileResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,status,core_version,software_product_version,runtime_version,created_at,updated_at")
      .eq("id", projectId)
      .single(),
    supabase
      .from("project_profiles")
      .select("project_id,revision,core_state,specialization_state,current_nba_action_id,updated_at,source_revision_parent")
      .eq("project_id", projectId)
      .single(),
  ]);

  if (projectResult.error) throw projectResult.error;
  if (profileResult.error) throw profileResult.error;

  return {
    project: projectResult.data,
    profile: profileResult.data,
  };
}

export async function reconcileProjectState(input: {
  projectId: string;
  expectedRevision: number;
  coreState: Json;
  specializationState: Json;
  changeSummary: string;
  currentNbaActionId?: string | null;
  actionId?: string | null;
}) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("reconcile_project_state", {
    p_project_id: input.projectId,
    p_expected_revision: input.expectedRevision,
    p_core_state: input.coreState,
    p_specialization_state: input.specializationState,
    p_change_summary: input.changeSummary,
    p_current_nba_action_id: input.currentNbaActionId ?? undefined,
    p_action_id: input.actionId ?? undefined,
  });

  if (error) {
    if (error.code === "40001") {
      throw new StaleProjectStateError();
    }
    throw error;
  }

  return data;
}

export async function updateProjectMission(input: {
  projectId: string;
  expectedRevision: number;
  mission: string;
}) {
  const state = await readProjectState(input.projectId);
  return reconcileProjectState({
    projectId: input.projectId,
    expectedRevision: input.expectedRevision,
    coreState: mergeMission(state.profile.core_state, input.mission.trim()),
    specializationState: state.profile.specialization_state,
    changeSummary: "Update project mission",
    currentNbaActionId: state.profile.current_nba_action_id,
  });
}
