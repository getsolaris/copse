import type { CommandModule } from "yargs";
import { dirname } from "node:path";
import { getConfigPath, initConfig } from "../../core/config.ts";
import {
  writeSkillFile,
  SUPPORTED_PLATFORMS,
} from "../../core/skill-templates.ts";
import type { SkillPlatform } from "../../core/skill-templates.ts";

const cmd: CommandModule = {
  command: "init",
  describe: "Initialize config or install copse integrations",
  builder: (yargs) =>
    yargs.option("skill", {
      type: "string",
      alias: "s",
      describe: `Install AI agent skill (${SUPPORTED_PLATFORMS.join(", ")})`,
      choices: SUPPORTED_PLATFORMS,
    }),
  handler: async (argv) => {
    const platform = argv.skill as SkillPlatform | undefined;

    try {
      if (!platform) {
        const configPath = initConfig();
        console.log(`✓ Initialized config → ${configPath}`);
        process.exit(0);
      }

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
