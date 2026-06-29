import { describe, expect, it } from "bun:test";
import type { Worktree } from "../core/types.ts";
import { resolveOpenShortcutCommand } from "./open-shortcuts.ts";

interface FileManagerCase {
  readonly platform: NodeJS.Platform;
  readonly command: readonly string[];
}

const selectedRoot = "/workspaces/copse-feature";

const selectedWorktree = {
  path: selectedRoot,
  branch: "feature/open-shortcuts",
  head: "abc1234",
  isMain: false,
  isDirty: false,
  isLocked: false,
  repoName: "copse",
  repoPath: "/repos/copse",
} satisfies Worktree;

describe("resolveOpenShortcutCommand", () => {
  it("resolves key o to the selected worktree root file manager command", () => {
    // Given
    const cases = [
      { platform: "darwin", command: ["open", selectedRoot] },
      { platform: "win32", command: ["explorer", selectedRoot] },
      { platform: "linux", command: ["xdg-open", selectedRoot] },
    ] satisfies readonly FileManagerCase[];

    for (const entry of cases) {
      // When
      const command = resolveOpenShortcutCommand({
        key: "o",
        selectedWorktree,
        platform: entry.platform,
      });

      // Then
      expect(command).toEqual([...entry.command]);
    }
  });

  it("resolves key t to a terminal command at the selected worktree root", () => {
    // Given
    const terminalCommand = "ghostty";

    // When
    const command = resolveOpenShortcutCommand({
      key: "t",
      selectedWorktree,
      terminalCommand,
      platform: "linux",
    });

    // Then
    expect(command).toEqual([terminalCommand, "--working-directory", selectedRoot]);
  });

  it("resolves key t to the current mac terminal when no terminal command is configured", () => {
    // Given
    const terminalProgram = "ghostty";

    // When
    const command = resolveOpenShortcutCommand({
      key: "t",
      selectedWorktree,
      terminalProgram,
      platform: "darwin",
    });

    // Then
    expect(command).toEqual(["open", "-a", "Ghostty", selectedRoot]);
  });
});
