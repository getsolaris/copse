import type { CommandModule } from "yargs";
import { loadConfig, getConfigPath, initConfig, validateConfig } from "../../core/config.ts";
import { deleteProfile, getActiveProfile, listProfiles, setActiveProfile } from "../../core/profiles.ts";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const cmd: CommandModule = {
  command: "config",
  describe: "Manage copse configuration",
  builder: (yargs) =>
    yargs
      .option("init", {
        type: "boolean",
        describe: "Create default config file",
      })
      .option("show", { type: "boolean", alias: "s", describe: "Print current config as JSON" })
      .option("edit", { type: "boolean", alias: "e", describe: "Open config in $EDITOR" })
      .option("path", { type: "boolean", describe: "Print config file path" })
      .option("validate", { type: "boolean", describe: "Validate config against schema" })
      .option("profiles", { type: "boolean", describe: "List config profiles" })
      .option("profile", { type: "string", describe: "Profile name for activation/deletion" })
      .option("activate", { type: "boolean", describe: "Activate the specified profile" })
      .option("delete", { type: "boolean", describe: "Delete the specified profile" }),
  handler: async (argv) => {
    const configPath = getConfigPath();

    if (argv.init) {
      const created = initConfig();
      console.log(`Config initialized: ${created}`);
      process.exit(0);
    }

    if (argv.path) {
      console.log(configPath);
      process.exit(0);
    }

    if (argv.show) {
      try {
        const config = loadConfig();
        console.log(JSON.stringify(config, null, 2));
      } catch (err) {
        console.error(`Error loading config: ${(err as Error).message}`);
        process.exit(1);
      }
      process.exit(0);
    }

    if (argv.edit) {
      const editor = process.env.EDITOR ?? process.env.VISUAL ?? "vi";
      initConfig();
      const result = spawnSync(editor, [configPath], { stdio: "inherit" });
      process.exit(result.status ?? 0);
    }

    if (argv.validate) {
      try {
        const raw = readFileSync(configPath, "utf-8");
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.error(`Error: invalid JSON in config file: ${configPath}`);
          process.exit(1);
        }
        const errors = validateConfig(parsed);
        if (errors.length === 0) {
          console.log(`✓ Config is valid: ${configPath}`);
          process.exit(0);
        } else {
          console.error(`Config validation failed (${errors.length} error(s)):`);
          for (const err of errors) {
            console.error(`  ${err.field}: ${err.message}`);
          }
          process.exit(1);
        }
      } catch (err) {
        console.error(`Error reading config: ${(err as Error).message}`);
        process.exit(1);
      }
    }

    if (argv.profiles) {
      try {
        const config = loadConfig();
        const profiles = listProfiles(config);
        const activeProfile = getActiveProfile(config);

        for (const profile of profiles) {
          const marker = profile === activeProfile ? " ★" : "";
          console.log(`${profile}${marker}`);
        }
      } catch (err) {
        console.error(`Error loading config: ${(err as Error).message}`);
        process.exit(1);
      }
      process.exit(0);
    }

    if (argv.profile && argv.activate) {
      try {
        const config = loadConfig();
        const profile = argv.profile as string;

        if (!listProfiles(config).includes(profile)) {
          console.error(`Error: profile '${profile}' does not exist.`);
          process.exit(1);
        }

        setActiveProfile(profile);
      } catch (err) {
        console.error(`Error loading config: ${(err as Error).message}`);
        process.exit(1);
      }

      process.exit(0);
    }

    if (argv.profile && argv.delete) {
      deleteProfile(argv.profile as string);
      process.exit(0);
    }

    console.log("Usage: copse config [options]");
    console.log("");
    console.log("Options:");
    console.log("  --init      Create default config file");
    console.log("  --show, -s  Print current config as JSON");
    console.log("  --edit, -e  Open config in $EDITOR");
    console.log("  --path      Print config file path");
    console.log("  --validate  Validate config against schema");
    console.log("  --profiles  List config profiles");
    console.log("  --profile   Profile name for activation/deletion");
    console.log("  --activate  Activate the specified profile");
    console.log("  --delete    Delete the specified profile");
    console.log("");
    console.log(`Config path: ${configPath}`);
    process.exit(0);
  },
};

export default cmd;
