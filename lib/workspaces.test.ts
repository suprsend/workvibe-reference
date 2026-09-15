import { describe, it, expect } from "vitest";
import { connectedWorkspaces, envPrefix, readableOn, toWorkspaceView } from "@/lib/workspaces";

describe("envPrefix", () => {
  it("uppercases the slug and swaps dashes for underscores", () => {
    expect(envPrefix("workvibe-emberoak")).toBe("SUPRSEND_WORKVIBE_EMBEROAK");
  });
});

describe("connectedWorkspaces", () => {
  const account = [
    { slug: "shop-a", name: "shop-a", uid: "uid_a" },
    { slug: "shop-b", name: "shop-b", uid: "uid_b" },
    { slug: "other", uid: "uid_o" },
  ];

  it("keeps only workspaces whose key matches their UID and whose secret is set", () => {
    const env = {
      SUPRSEND_SHOP_A_WORKSPACE_KEY: "uid_a",
      SUPRSEND_SHOP_A_WORKSPACE_SECRET: "secret",
      SUPRSEND_SHOP_B_WORKSPACE_KEY: "uid_b", // no secret
      SUPRSEND_OTHER_WORKSPACE_KEY: "uid_a", // someone else's key
      SUPRSEND_OTHER_WORKSPACE_SECRET: "secret",
    };
    expect(connectedWorkspaces(account, env)).toEqual([{ slug: "shop-a", name: "shop-a" }]);
  });

  it("returns none when no keys are set", () => {
    expect(connectedWorkspaces(account, {})).toEqual([]);
  });
});

describe("readableOn", () => {
  it("picks white on dark colours and black on light ones", () => {
    expect(readableOn("#9A3412")).toBe("#ffffff");
    expect(readableOn("#FDE68A")).toBe("#000000");
  });

  it("returns null for anything that isn't #rrggbb", () => {
    expect(readableOn("")).toBeNull();
    expect(readableOn("red")).toBeNull();
    expect(readableOn("#fff")).toBeNull();
  });
});

describe("toWorkspaceView", () => {
  const ws = { slug: "shop-a", name: "shop-a" };

  it("takes name and colour from the brand", () => {
    expect(toWorkspaceView(ws, { name: "Ember & Oak", primaryColor: "#9A3412" })).toEqual({
      slug: "shop-a",
      name: "Ember & Oak",
      initial: "E",
      accent: "#9A3412",
      accentForeground: "#ffffff",
    });
  });

  it("uses the account name and no colour when the brand sets neither", () => {
    expect(toWorkspaceView(ws, {})).toMatchObject({ name: "shop-a", initial: "S", accent: null, accentForeground: null });
    expect(toWorkspaceView(ws, { name: " ", primaryColor: "blue" })).toMatchObject({ name: "shop-a", accent: null });
  });
});
