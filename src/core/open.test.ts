import { describe, expect, it } from "bun:test";
import { EmptyTerminalCommandError, buildFileManagerCommand, buildTerminalCommand } from "./open.ts";

describe("buildFileManagerCommand", () => {
  it("builds default mac finder command", () => {
    expect(buildFileManagerCommand("/workspaces/repo", "darwin")).toEqual([
      "open",
      "/workspaces/repo",
    ]);
  });

  it("builds default linux file manager command", () => {
    expect(buildFileManagerCommand("/workspaces/repo", "linux")).toEqual([
      "xdg-open",
      "/workspaces/repo",
    ]);
  });
});

describe("buildTerminalCommand", () => {
  it("builds configured terminal command", () => {
    expect(
      buildTerminalCommand("/workspaces/repo", ["bash", "-lc", "cd", "{path}", "&&", "zsh"]),
    ).toEqual(["bash", "-lc", "cd", "/workspaces/repo", "&&", "zsh"]);
  });

  it("appends path when custom terminal command has no {path}", () => {
    expect(buildTerminalCommand("/workspaces/repo", ["npm", "run", "dev"]))
      .toEqual(["npm", "run", "dev", "/workspaces/repo"]);
  });

  it("builds default mac terminal command", () => {
    expect(buildTerminalCommand("/workspaces/repo", undefined, "darwin")).toEqual([
      "open",
      "-a",
      "Terminal",
      "/workspaces/repo",
    ]);
  });

  it("builds default linux terminal command with working directory", () => {
    expect(buildTerminalCommand("/workspaces/repo", undefined, "linux")).toEqual([
      "x-terminal-emulator",
      "--working-directory",
      "/workspaces/repo",
    ]);
  });

  it("builds default windows terminal command", () => {
    expect(buildTerminalCommand("/workspaces/repo", undefined, "win32")).toEqual([
      "cmd",
      "/c",
      "start",
      "",
      "/D",
      "/workspaces/repo",
    ]);
  });

  it("throws for empty custom terminal command", () => {
    expect(() => buildTerminalCommand("/workspaces/repo", [])).toThrow(EmptyTerminalCommandError);
  });
});
