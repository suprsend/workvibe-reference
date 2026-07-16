import { describe, it, expect } from "vitest";
import { flattenSteps, diffWorkflow } from "@/lib/wf/diff";
import type { Workflow } from "@/lib/wf/derive";

const survey = (delay: string): Workflow => ({
  slug: "survey",
  name: "Engagement Survey",
  trigger_type: "api",
  tree: {
    nodes: [
      { node_type: "send_multi_channel", properties: { template: "survey-invite" } },
      {
        node_type: "branch_waituntil",
        branches: [
          { name: "Responded", is_default: false, conditions: [{ event_name: "survey_responded" }], nodes: [] },
          {
            name: "No response",
            is_default: true,
            conditions: [{ delay_properties: { value: delay } }],
            nodes: [{ node_type: "send_multi_channel", properties: { template: "survey-reminder" } }],
          },
        ],
      },
    ],
  },
});

describe("flattenSteps", () => {
  it("produces ordered, human-readable step lines incl. the wait-for-response branch", () => {
    expect(flattenSteps(survey("3d"))).toEqual([
      "Send “survey-invite”",
      "Wait up to 3 days for survey_responded",
      "↳ if no response: Send “survey-reminder”",
    ]);
  });
});

describe("diffWorkflow", () => {
  it("reports no change for identical workflows", () => {
    const d = diffWorkflow(survey("3d"), survey("3d"));
    expect(d.changed).toBe(false);
    expect(d.settings).toEqual([]);
    expect(d.before.some((l) => l.removed)).toBe(false);
    expect(d.after.some((l) => l.added)).toBe(false);
  });

  it("flags the changed step line when a delay is edited", () => {
    const d = diffWorkflow(survey("3d"), survey("2d"));
    expect(d.changed).toBe(true);
    expect(d.before.find((l) => l.text.includes("3 days"))!.removed).toBe(true);
    expect(d.after.find((l) => l.text.includes("2 days"))!.added).toBe(true);
    // unchanged lines stay unflagged
    expect(d.before.find((l) => l.text.includes("survey-invite"))!.removed).toBe(false);
  });

  it("records changed settings (name)", () => {
    const renamed = { ...survey("3d"), name: "Quarterly Survey" };
    const d = diffWorkflow(survey("3d"), renamed);
    expect(d.changed).toBe(true);
    expect(d.settings).toContainEqual({ label: "Name", before: "Engagement Survey", after: "Quarterly Survey" });
  });
});
