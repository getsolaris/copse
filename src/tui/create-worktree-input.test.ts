import { describe, expect, it } from "bun:test";
import { createSourceBaseOption, formatCreateSourceBase, nextCreateFocusField, resolveCreateSourceBase } from "./create-worktree-input.ts";

describe("resolveCreateSourceBase", () => {
  it("leaves base undefined when source branch input is empty", () => {
    // Given: the optional source branch field is left blank.
    const input = "";

    // When: the TUI resolves the base branch for createWorktreeFlow.
    const base = resolveCreateSourceBase(input);

    expect(base).toBeUndefined();
  });

  it("leaves base undefined when source branch input is whitespace", () => {
    // Given: the optional source branch field contains only whitespace.
    const input = " \t ";

    // When: the TUI resolves the base branch for createWorktreeFlow.
    const base = resolveCreateSourceBase(input);

    expect(base).toBeUndefined();
  });

  it("passes typed source branch refs unchanged after trimming", () => {
    // Given: the user entered a direct branch/ref with surrounding whitespace.
    const input = "  release/2026.06  ";

    // When: the TUI resolves the base branch for createWorktreeFlow.
    const base = resolveCreateSourceBase(input);

    // Then: the typed ref text is preserved after trim.
    expect(base).toBe("release/2026.06");
  });
});

describe("formatCreateSourceBase", () => {
  it("shows the configured fallback when source branch input is empty", () => {
    expect(formatCreateSourceBase("", "origin/main")).toBe("origin/main");
  });

  it("shows origin/main when no configured fallback exists", () => {
    expect(formatCreateSourceBase("", undefined)).toBe("origin/main");
  });
});

describe("createSourceBaseOption", () => {
  it("sets origin/main when source branch input is empty and no config fallback exists", () => {
    expect(createSourceBaseOption("", undefined)).toEqual({ base: "origin/main" });
  });

  it("uses the configured fallback when source branch input is empty", () => {
    expect(createSourceBaseOption("", "upstream/trunk")).toEqual({ base: "upstream/trunk" });
  });

  it("sets base when source branch input is typed", () => {
    expect(createSourceBaseOption(" develop ", "origin/main")).toEqual({ base: "develop" });
  });
});

describe("nextCreateFocusField", () => {
  it("cycles branch, source, and focus fields in tab order", () => {
    // Given: each field in the create form tab cycle.
    const fields = ["branch", "source", "focus"] as const;

    // When: the TUI advances focus with Tab.
    const nextFields = fields.map((field) => nextCreateFocusField(field));

    // Then: focus moves through branch -> source -> focus -> branch.
    expect(nextFields).toEqual(["source", "focus", "branch"]);
  });
});
