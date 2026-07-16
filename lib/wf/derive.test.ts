import { describe, it, expect } from "vitest";
import { deriveWfModel, type Workflow } from "@/lib/wf/derive";

const wf = (nodes: Workflow["tree"]["nodes"], extra: Partial<Workflow> = {}): Workflow => ({
  slug: "wf",
  name: "WF",
  trigger_type: "api",
  tree: { nodes },
  ...extra,
});

describe("deriveWfModel", () => {
  it("always frames the flow with a Trigger and an Exit", () => {
    const m = deriveWfModel(wf([]));
    const types = m.nodes.map((n) => n.type);
    expect(types).toEqual(["trigger", "exit"]);
    expect(m.edges).toEqual([{ from: "trigger", to: "exit", kind: "v" }]);
  });

  it("reflects the trigger type in the Trigger node", () => {
    const m = deriveWfModel(wf([], { trigger_type: "event" }));
    expect(m.nodes[0]).toMatchObject({ id: "trigger", sub: "via EVENT" });
  });

  it("lays a single send node on the spine between trigger and exit", () => {
    const m = deriveWfModel(
      wf([{ node_type: "send_multi_channel", properties: { channels: ["inbox", "email"], template: "welcome" } }]),
    );
    expect(m.nodes.map((n) => n.type)).toEqual(["trigger", "multichannel", "exit"]);
    const node = m.nodes.find((n) => n.type === "multichannel")!;
    // channels are de-duped, ordered (email before inbox), and the template shown
    expect(node.sub).toBe("Email · Inbox");
    expect(node.sub2).toBe("template: welcome");
  });

  it("formats delays in human units", () => {
    expect(deriveWfModel(wf([{ node_type: "delay", properties: { value: "2d" } }])).nodes.find((n) => n.type === "delay")!.sub).toBe("2 days");
    expect(deriveWfModel(wf([{ node_type: "delay", properties: { value: "1d" } }])).nodes.find((n) => n.type === "delay")!.sub).toBe("1 day");
  });

  it("peels an empty wait-until condition branch to Exit and keeps the max-time branch on the spine", () => {
    const m = deriveWfModel(
      wf([
        { node_type: "send_multi_channel", properties: { channels: ["email"], template: "invite" } },
        {
          node_type: "branch_waituntil",
          branches: [
            { name: "Responded", is_default: false, conditions: [{ event_name: "responded" }], nodes: [] },
            {
              name: "No response after 3 days",
              is_default: true,
              conditions: [{ delay_properties: { value: "3d" } }],
              nodes: [{ node_type: "send_multi_channel", properties: { channels: ["email"], template: "reminder" } }],
            },
          ],
        },
      ]),
    );
    expect(m.nodes.map((n) => n.type)).toEqual(["trigger", "multichannel", "wait", "multichannel", "exit"]);
    // the empty "Responded" branch leaves the Wait node via a "stop" edge to Exit
    const stop = m.edges.find((e) => e.kind === "stop")!;
    expect(stop).toMatchObject({ to: "exit", label: "Responded" });
    // the max-time branch's first edge carries the branch label
    const labelled = m.edges.find((e) => e.label === "No response after 3 days")!;
    expect(labelled.kind).toBe("v");
  });
});
