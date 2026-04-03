import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { cleanupTempDirs, createTempDir } from "./test-helpers.ts";
import {
  generateReferenceFiles,
  generateSkillContent,
  getSkillDir,
  getSkillFilePath,
  writeSkillFile,
  SUPPORTED_PLATFORMS,
} from "./skill-templates.ts";

let origHome: string | undefined;

beforeEach(() => {
  origHome = process.env.HOME;
  process.env.HOME = createTempDir("omw-skill-home-");
});

afterEach(() => {
  process.env.HOME = origHome;
  cleanupTempDirs();
});

describe("SUPPORTED_PLATFORMS", () => {
  it("contains all expected platforms", () => {
    expect(SUPPORTED_PLATFORMS).toContain("claude-code");
    expect(SUPPORTED_PLATFORMS).toContain("codex");
    expect(SUPPORTED_PLATFORMS).toContain("opencode");
    expect(SUPPORTED_PLATFORMS).toHaveLength(3);
  });
});

describe("getSkillDir", () => {
  it("returns ~/.claude/skills/omw for claude-code", () => {
    const dir = getSkillDir("claude-code");
    expect(dir).toEndWith(join(".claude", "skills", "omw"));
  });

  it("returns ~/.agents/skills/omw for codex", () => {
    const dir = getSkillDir("codex");
    expect(dir).toEndWith(join(".agents", "skills", "omw"));
  });

  it("returns ~/.config/opencode/skill/omw for opencode", () => {
    const dir = getSkillDir("opencode");
    expect(dir).toEndWith(join(".config", "opencode", "skill", "omw"));
  });
});

describe("getSkillFilePath", () => {
  it("returns SKILL.md for all platforms", () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      const path = getSkillFilePath(platform);
      expect(path).toEndWith("SKILL.md");
    }
  });
});

describe("generateSkillContent", () => {
  it("includes SKILL.md frontmatter with metadata", () => {
    const content = generateSkillContent();
    expect(content).toStartWith("---\n");
    expect(content).toContain("name: omw");
    expect(content).toContain("description:");
    expect(content).toContain("metadata:");
    expect(content).toContain("author: getsolaris");
    expect(content).toContain('version: "1.0.0"');
  });

  it("includes quick start and command overview", () => {
    const content = generateSkillContent();
    expect(content).toContain("## Quick Start");
    expect(content).toContain("Create a feature worktree");
    expect(content).toContain("Clean up merged worktrees");
    expect(content).toContain("Run commands across worktrees");
    expect(content).toContain("## Command Overview");
    expect(content).toContain("| Command | Aliases | Description |");
    expect(content).toContain("| `add` |");
    expect(content).toContain("| `shell-init` |");
    expect(content).toContain("| `init` |");
  });

  it("includes monorepo, config, and command reference links", () => {
    const content = generateSkillContent();
    expect(content).toContain("## Monorepo Workflows");
    expect(content).toContain("--focus");
    expect(content).toContain("## Configuration");
    expect(content).toContain("--json");
    expect(content).toContain("~/.config/oh-my-worktree/config.json");
    expect(content).toContain("## Command Reference");
    expect(content).toContain("For detailed options and examples for each command:");
    expect(content).toContain("references/add.md");
    expect(content).toContain("references/shell-init.md");
    expect(content).toContain("references/init.md");
  });
});

describe("generateReferenceFiles", () => {
  it("returns all 20 command reference files", () => {
    const references = generateReferenceFiles();
    expect(references.size).toBe(20);
    expect(references.has("add.md")).toBeTrue();
    expect(references.has("remove.md")).toBeTrue();
    expect(references.has("shell-init.md")).toBeTrue();
    expect(references.has("init.md")).toBeTrue();
  });

  it("each reference includes required sections", () => {
    const references = generateReferenceFiles();

    for (const [name, content] of references.entries()) {
      const command = name.replace(".md", "");
      expect(content).toContain(`# omw ${command}`);
      expect(content).toContain("## Synopsis");
      expect(content).toContain("## Options");
      expect(content).toContain("## Examples");
      expect(content).toContain("## Notes");
      expect(content).toContain("| Flag | Type | Alias | Description |");
      expect(content).toContain("```bash");
    }
  });
});

describe("writeSkillFile", () => {
  it("creates SKILL.md and references directory", () => {
    const result = writeSkillFile("codex");

    expect(result.action).toBe("created");
    expect(result.platform).toBe("codex");
    expect(result.filePath).toContain(join(".agents", "skills", "omw", "SKILL.md"));
    expect(result.referenceDir).toContain(join(".agents", "skills", "omw", "references"));
    expect(result.referenceCount).toBe(20);
    expect(existsSync(result.filePath)).toBeTrue();
    expect(existsSync(result.referenceDir)).toBeTrue();

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("name: omw");
    expect(content).toContain("oh-my-worktree");

    const referenceFiles = readdirSync(result.referenceDir);
    expect(referenceFiles).toHaveLength(20);
    expect(referenceFiles).toContain("add.md");
    expect(referenceFiles).toContain("init.md");
  });

  it("creates claude-code skill in ~/.claude/skills/omw/", () => {
    const result = writeSkillFile("claude-code");

    expect(result.action).toBe("created");
    expect(result.filePath).toContain(join(".claude", "skills", "omw", "SKILL.md"));
    expect(result.referenceDir).toContain(join(".claude", "skills", "omw", "references"));
    expect(result.referenceCount).toBe(20);
    expect(existsSync(result.filePath)).toBeTrue();
    expect(existsSync(result.referenceDir)).toBeTrue();
  });

  it("creates opencode skill in ~/.config/opencode/skill/omw/", () => {
    const result = writeSkillFile("opencode");

    expect(result.action).toBe("created");
    expect(result.filePath).toContain(join(".config", "opencode", "skill", "omw", "SKILL.md"));
    expect(result.referenceDir).toContain(join(".config", "opencode", "skill", "omw", "references"));
    expect(result.referenceCount).toBe(20);
    expect(existsSync(result.filePath)).toBeTrue();
    expect(existsSync(result.referenceDir)).toBeTrue();
  });

  it("updates existing skill file", () => {
    writeSkillFile("codex");
    const result = writeSkillFile("codex");

    expect(result.action).toBe("updated");
  });

  it("is idempotent — running twice produces same content", () => {
    writeSkillFile("opencode");
    const first = readFileSync(getSkillFilePath("opencode"), "utf-8");
    const firstReference = readFileSync(join(getSkillDir("opencode"), "references", "add.md"), "utf-8");

    writeSkillFile("opencode");
    const second = readFileSync(getSkillFilePath("opencode"), "utf-8");
    const secondReference = readFileSync(join(getSkillDir("opencode"), "references", "add.md"), "utf-8");

    expect(first).toBe(second);
    expect(firstReference).toBe(secondReference);
  });

  it("creates nested directories when they do not exist", () => {
    const dir = getSkillDir("codex");
    expect(existsSync(dir)).toBeFalse();

    const result = writeSkillFile("codex");
    expect(existsSync(dir)).toBeTrue();
    expect(existsSync(result.referenceDir)).toBeTrue();
  });

  it("all platforms produce valid SKILL.md and references", () => {
    for (const platform of SUPPORTED_PLATFORMS) {
      const result = writeSkillFile(platform);
      const content = readFileSync(result.filePath, "utf-8");

      expect(content).toStartWith("---\n");
      expect(content).toContain("name: omw");
      expect(content).toContain("description:");
      expect(content).toContain("## Command Overview");
      expect(existsSync(result.referenceDir)).toBeTrue();
      expect(result.referenceCount).toBe(20);
      const referenceNames = readdirSync(result.referenceDir);
      expect(referenceNames).toContain("config.md");
      expect(referenceNames).toContain("open.md");
    }
  });
});
