import { describe, expect, it } from "bun:test";
import { InvalidTerminalCommandError, buildFileManagerCommand, buildTerminalCommand } from "./open.ts";

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
  it("builds configured mac terminal command and appends path automatically", () => {
    expect(buildTerminalCommand("/workspaces/repo", "iTerm", "darwin")).toEqual([
      "open",
      "-a",
      "iTerm",
      "/workspaces/repo",
    ]);
  });

  it("builds configured linux terminal command and appends path automatically", () => {
    expect(buildTerminalCommand("/workspaces/repo", "gnome-terminal", "linux")).toEqual([
      "gnome-terminal",
      "--working-directory",
      "/workspaces/repo",
    ]);
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
    expect(() => buildTerminalCommand("/workspaces/repo", "")).toThrow(InvalidTerminalCommandError);
  });
});
