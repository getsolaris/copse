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
  process.env.HOME = createTempDir("copse-skill-home-");
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
  it("returns ~/.claude/skills/copse for claude-code", () => {
    const dir = getSkillDir("claude-code");
    expect(dir).toEndWith(join(".claude", "skills", "copse"));
  });

  it("returns ~/.agents/skills/copse for codex", () => {
    const dir = getSkillDir("codex");
    expect(dir).toEndWith(join(".agents", "skills", "copse"));
  });

  it("returns ~/.config/opencode/skill/copse for opencode", () => {
    const dir = getSkillDir("opencode");
    expect(dir).toEndWith(join(".config", "opencode", "skill", "copse"));
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
    expect(content).toContain("name: copse");
    expect(content).toContain("description:");
    expect(content).toContain("metadata:");
    expect(content).toContain("author: getsolaris");
    expect(content).toContain('version: "1.0.0"');
  });

  it("includes quick start and command overview", () => {
    const content = generateSkillContent();
    expect(content).toContain("## Quick Start");
    expect(content).toContain("Create a feature worktree");
    expect(content).toContain("copse add feature/my-feature --base main");
    expect(content).toContain("Clean up merged worktrees");
    expect(content).toContain("Run commands across worktrees");
    expect(content).toContain("Review a GitHub PR");
    expect(content).toContain("Use templates");
    expect(content).toContain("Tmux session management");
    expect(content).toContain("Shell integration setup");
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
    expect(content).toContain("~/.config/copse/config.json");
    expect(content).toContain("## Command Reference");
    expect(content).toContain("For detailed options and examples for each command:");
    expect(content).toContain("references/add.md");
    expect(content).toContain("references/shell-init.md");
    expect(content).toContain("references/init.md");
    expect(content).toContain("references/config-schema.md");
  });
});

describe("generateReferenceFiles", () => {
  it("returns all 20 command reference files plus config schema", () => {
    const references = generateReferenceFiles();
    expect(references.size).toBe(21);
    expect(references.has("add.md")).toBeTrue();
    expect(references.has("remove.md")).toBeTrue();
    expect(references.has("shell-init.md")).toBeTrue();
    expect(references.has("init.md")).toBeTrue();
    expect(references.has("config-schema.md")).toBeTrue();
  });

  it("each reference includes required sections", () => {
    const references = generateReferenceFiles();

    for (const [name, content] of references.entries()) {
      if (name === "config-schema.md") {
        continue;
      }
      const command = name.replace(".md", "");
      expect(content).toContain(`# copse ${command}`);
      expect(content).toContain("## Synopsis");
      expect(content).toContain("## Options");
      expect(content).toContain("## Examples");
      expect(content).toContain("## Notes");
      expect(content).toContain("| Flag | Type | Alias | Description |");
      expect(content).toContain("```bash");
    }
  });

  it("renders Configuration section when config keys exist", () => {
    const references = generateReferenceFiles();
    const addRef = references.get("add.md");

    expect(addRef).toBeDefined();
    expect(addRef).toContain("missing branches are created automatically");
    expect(addRef).toContain("--base only applies when a new branch is created");
    expect(addRef).toContain("## Configuration");
    expect(addRef).toContain("Related config keys in `~/.config/copse/config.json`:");
    expect(addRef).toContain("`defaults.worktreeDir` — Directory pattern for new worktrees");
    expect(addRef).toContain("`sessions.layouts` — Tmux session layout definitions");
  });

  it("documents init config-first behavior", () => {
    const references = generateReferenceFiles();
    const initRef = references.get("init.md");

    expect(initRef).toBeDefined();
    expect(initRef).toContain("# Initialize config");
    expect(initRef).toContain("copse init");
    expect(initRef).toContain("Without --skill, reuses config initialization and creates only config.json.");
  });

  it("does not render Configuration section when config keys are empty", () => {
    const references = generateReferenceFiles();
    const diffRef = references.get("diff.md");

    expect(diffRef).toBeDefined();
    expect(diffRef).not.toContain("## Configuration");
  });

  it("includes config-schema reference with key sections and json examples", () => {
    const references = generateReferenceFiles();
    const schemaRef = references.get("config-schema.md");

    expect(schemaRef).toBeDefined();
    expect(schemaRef).toContain("# Configuration Schema");
    expect(schemaRef).toContain("## Minimal Example");
    expect(schemaRef).toContain("## Full Example");
    expect(schemaRef).toContain("## Key Reference");
    expect(schemaRef).toContain('"version": 1');
    expect(schemaRef).toContain('"defaults": {');
  });
});

describe("writeSkillFile", () => {
  it("creates SKILL.md and references directory", () => {
    const result = writeSkillFile("codex");

    expect(result.action).toBe("created");
    expect(result.platform).toBe("codex");
    expect(result.filePath).toContain(join(".agents", "skills", "copse", "SKILL.md"));
    expect(result.referenceDir).toContain(join(".agents", "skills", "copse", "references"));
    expect(result.referenceCount).toBe(21);
    expect(existsSync(result.filePath)).toBeTrue();
    expect(existsSync(result.referenceDir)).toBeTrue();

    const content = readFileSync(result.filePath, "utf-8");
    expect(content).toContain("name: copse");
    expect(content).toContain("copse");

    const referenceFiles = readdirSync(result.referenceDir);
    expect(referenceFiles).toHaveLength(21);
    expect(referenceFiles).toContain("add.md");
    expect(referenceFiles).toContain("init.md");
    expect(referenceFiles).toContain("config-schema.md");
  });

  it("creates claude-code skill in ~/.claude/skills/copse/", () => {
    const result = writeSkillFile("claude-code");

    expect(result.action).toBe("created");
    expect(result.filePath).toContain(join(".claude", "skills", "copse", "SKILL.md"));
    expect(result.referenceDir).toContain(join(".claude", "skills", "copse", "references"));
    expect(result.referenceCount).toBe(21);
    expect(existsSync(result.filePath)).toBeTrue();
    expect(existsSync(result.referenceDir)).toBeTrue();
  });

  it("creates opencode skill in ~/.config/opencode/skill/copse/", () => {
    const result = writeSkillFile("opencode");

    expect(result.action).toBe("created");
    expect(result.filePath).toContain(join(".config", "opencode", "skill", "copse", "SKILL.md"));
    expect(result.referenceDir).toContain(join(".config", "opencode", "skill", "copse", "references"));
    expect(result.referenceCount).toBe(21);
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
      expect(content).toContain("name: copse");
      expect(content).toContain("description:");
      expect(content).toContain("## Command Overview");
      expect(existsSync(result.referenceDir)).toBeTrue();
      expect(result.referenceCount).toBe(21);
      const referenceNames = readdirSync(result.referenceDir);
      expect(referenceNames).toContain("config.md");
      expect(referenceNames).toContain("open.md");
      expect(referenceNames).toContain("config-schema.md");
    }
  });
});
