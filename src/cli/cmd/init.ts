import type { CommandModule } from "yargs";
import { dirname } from "node:path";
import {
  writeSkillFile,
  SUPPORTED_PLATFORMS,
} from "../../core/skill-templates.ts";
import type { SkillPlatform } from "../../core/skill-templates.ts";

const cmd: CommandModule = {
  command: "init",
  describe: "Initialize omw integrations",
  builder: (yargs) =>
    yargs.option("skill", {
      type: "string",
      alias: "s",
      describe: `Install AI agent skill (${SUPPORTED_PLATFORMS.join(", ")})`,
      choices: SUPPORTED_PLATFORMS,
    }),
  handler: async (argv) => {
    const platform = argv.skill as SkillPlatform | undefined;

    if (!platform) {
      console.error(
        "Please specify an option.\n\nExample:\n  omw init --skill claude-code\n  omw init --skill codex\n\nSupported platforms: " +
          SUPPORTED_PLATFORMS.join(", "),
      );
      process.exit(1);
    }

    try {
      const result = writeSkillFile(platform);
      const actionWord = result.action === "created" ? "Installed" : "Updated";
      console.log(`✓ ${actionWord} → ${dirname(result.filePath)}/`);
      console.log("    SKILL.md");
      console.log(`    references/ (${result.referenceCount} commands)`);
      process.exit(0);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  },
};

export default cmd;
