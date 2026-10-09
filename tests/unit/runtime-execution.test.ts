import { describe, expect, it } from "vitest";
import type { ActionContract, ActionStatus } from "@/aeos/contracts/action";
import { executeRuntimeAction } from "@/aeos/runtime/execute";
import type {
  ProviderAdapter,
  ProviderTextResult,
  RuntimeExecutionState,
  RuntimeModelClass,
  RuntimePersistence,
  VerificationStatus,
} from "@/aeos/runtime/contracts";

const action: ActionContract = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  profileRevision: 3,
  parentActionId: null,
  actionType: "runtime_smoke",
  title: "Verify Runtime foundation",
  objective: "Return a bounded Runtime foundation result.",
  owner: "aeos",
  status: "ready",
  expectedResult: {},
  acceptanceCondition: {},
  requiredCapabilities: [],
  verificationRequirements: [],
  authorityRequirements: {},
  input: { modelClass: "fast" },
};

class FakeProvider implements ProviderAdapter {
  constructor(private readonly result: ProviderTextResult) {}
  async invokeText() {
    return this.result;
  }
}

class FakePersistence implements RuntimePersistence {
  action = { ...action };
  executions: Array<{ id: string; state?: RuntimeExecutionState }> = [];
  verifications: Array<{ status: VerificationStatus }> = [];
  records: Array<{ outcome: string }> = [];

  async loadAction() { return this.action; }
  async updateActionStatus(_id: string, status: ActionStatus) { this.action.status = status; }
  async createExecution(_input: { projectId: string; actionId: string; contextRevision: number; modelClass: RuntimeModelClass }) {
    this.executions.push({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    return "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  }
  async updateExecution(id: string, patch: { state?: RuntimeExecutionState }) {
    const execution = this.executions.find((item) => item.id === id);
    if (execution) execution.state = patch.state;
  }
  async createVerification(input: { status: VerificationStatus }) {
    this.verifications.push({ status: input.status });
    return "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  }
  async createExecutionRecord(input: { outcome: string }) {
    this.records.push({ outcome: input.outcome });
    return "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  }
}

describe("Slice 1 Runtime execution", () => {
  it("executes, verifies, records, and completes an AEOS-owned action", async () => {
    const persistence = new FakePersistence();
    const provider = new FakeProvider({
      provider: "test",
      model: "test-model",
      responseId: "resp-1",
      outputText: "Runtime foundation verified.",
      usage: {},
    });

    const result = await executeRuntimeAction({
      actionId: action.id,
      provider,
      persistence,
    });

    expect(result.verified).toBe(true);
    expect(result.outcome).toBe("succeeded");
    expect(persistence.action.status).toBe("completed");
    expect(persistence.verifications.at(-1)?.status).toBe("pass");
    expect(persistence.records.at(-1)?.outcome).toBe("no_change");
    expect(persistence.executions.at(-1)?.state).toBe("succeeded");
  });

  it("fails verification when the provider returns no usable text", async () => {
    const persistence = new FakePersistence();
    const provider = new FakeProvider({
      provider: "test",
      model: "test-model",
      responseId: "resp-2",
      outputText: "",
      usage: {},
    });

    const result = await executeRuntimeAction({
      actionId: action.id,
      provider,
      persistence,
    });

    expect(result.verified).toBe(false);
    expect(result.outcome).toBe("failed");
    expect(persistence.action.status).toBe("blocked");
    expect(persistence.verifications.at(-1)?.status).toBe("fail");
  });
});
