import { NextResponse } from "next/server";
import { z } from "zod";
import { start } from "workflow/api";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { executeActionWorkflow } from "../../../../../workflows/execute-action";

const requestSchema = z.object({ actionId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid actionId" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: action, error } = await supabase
    .from("action_contracts")
    .select("id, owner, status")
    .eq("id", parsed.data.actionId)
    .single();

  if (error || !action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }
  if (action.owner !== "aeos") {
    return NextResponse.json({ error: "Action requires human or shared ownership" }, { status: 409 });
  }
  if (!["ready", "active"].includes(action.status)) {
    return NextResponse.json({ error: `Action is not executable from status ${action.status}` }, { status: 409 });
  }

  const run = await start(executeActionWorkflow, [action.id]);
  return NextResponse.json(
    { actionId: action.id, runId: run.runId, status: "queued" },
    { status: 202 },
  );
}
