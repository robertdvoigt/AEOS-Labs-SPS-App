import { executeRuntimeAction } from "@/aeos/runtime/execute";

export async function executeActionWorkflow(actionId: string) {
  "use workflow";
  return runActionStep(actionId);
}

async function runActionStep(actionId: string) {
  "use step";

  const [
    { OpenAIResponsesAdapter },
    { SupabaseRuntimePersistence },
    { getSupabaseAdmin },
    { getServerEnv },
  ] = await Promise.all([
    import("@/aeos/runtime/providers/openai"),
    import("@/aeos/runtime/repository"),
    import("@/lib/supabase/admin"),
    import("@/lib/env"),
  ]);

  const env = getServerEnv();
  return executeRuntimeAction({
    actionId,
    provider: new OpenAIResponsesAdapter(env.OPENAI_API_KEY),
    persistence: new SupabaseRuntimePersistence(getSupabaseAdmin()),
  });
}
