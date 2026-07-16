import { describe, it, expect } from "vitest";
import {
  WORKSPACES,
  DEFAULT_WORKSPACE,
  getWorkspace,
  isWorkspaceSlug,
} from "@/lib/workspaces";

describe("getWorkspace", () => {
  it("resolves a known slug", () => {
    expect(getWorkspace("workvibe-spacex").label).toBe("SpaceX");
    expect(getWorkspace("workvibe-uber").label).toBe("Uber");
  });

  it("falls back to the first workspace for unknown / missing slugs", () => {
    const fallback = WORKSPACES[0];
    expect(getWorkspace("does-not-exist")).toBe(fallback);
    expect(getWorkspace(null)).toBe(fallback);
    expect(getWorkspace(undefined)).toBe(fallback);
  });
});

describe("isWorkspaceSlug", () => {
  it("is true only for registered slugs", () => {
    expect(isWorkspaceSlug("workvibe-uber")).toBe(true);
    expect(isWorkspaceSlug("workvibe-spacex")).toBe(true);
    expect(isWorkspaceSlug("acme")).toBe(false);
    expect(isWorkspaceSlug(null)).toBe(false);
    expect(isWorkspaceSlug(undefined)).toBe(false);
  });
});

describe("DEFAULT_WORKSPACE", () => {
  it("is the first registered workspace", () => {
    expect(DEFAULT_WORKSPACE).toBe(WORKSPACES[0].slug);
  });
});
