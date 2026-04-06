import type { CommandModule } from "yargs";
import { basename, resolve } from "node:path";
import { GitWorktree } from "../../core/git.ts";
import { GitError } from "../../core/types.ts";
import { initConfig, loadConfig, resolveTemplate, mergeTemplateWithRepo, getRepoConfig } from "../../core/config.ts";
import { executeHooks, HookError, HookTimeoutError } from "../../core/hooks.ts";

const cmd: CommandModule = {
  command: "clone <url> [path]",
  describe: "Clone a repository and initialize omw config",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "Repository URL to clone",
        demandOption: true,
      })
      .positional("path", {
        type: "string",
        describe: "Target directory path",
      })
      .option("template", {
        type: "string",
        alias: "t",
        describe: "Apply a named template after cloning",
      })
      .option("init-config", {
        type: "boolean",
        describe: "Initialize omw config after cloning",
        default: true,
      }),
  handler: async (argv) => {
    const url = argv.url as string;
    const templateName = argv.template as string | undefined;
    const shouldInitConfig = argv["init-config"] as boolean;

    let targetPath = argv.path as string | undefined;
    if (!targetPath) {
      try {
        const parsed = new URL(url);
        targetPath = basename(parsed.pathname).replace(/\.git$/, "");
      } catch {
        // Not a valid URL — handle scp-style URLs (git@github.com:user/repo.git)
        const lastPart = url.split("/").pop() ?? url.split(":").pop() ?? url;
        targetPath = lastPart.replace(/\.git$/, "");
      }
    }

    if (!targetPath) {
      console.error("Error: could not determine target directory from URL");
      process.exit(1);
    }

    console.log(`Cloning ${url}...`);

    try {
      await GitWorktree.exec(["clone", url, targetPath]);
    } catch (err) {
      if (err instanceof GitError) {
        console.error(`Error: ${err.stderr || err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }

    if (shouldInitConfig) {
      try {
        const configPath = initConfig();
        console.log(`  ✓ Config initialized: ${configPath}`);
      } catch (err) {
        console.warn(`  ⚠ Could not initialize config: ${(err as Error).message}`);
      }
    }

    if (templateName) {
      try {
        const config = loadConfig();
        const template = resolveTemplate(config, templateName);
        if (!template) {
          const available = Object.keys(config.templates ?? {});
          console.error(`Error: template '${templateName}' not found.`);
          if (available.length > 0) {
            console.error(`Available templates: ${available.join(", ")}`);
          } else {
            console.error("No templates configured. Add templates to your config file.");
          }
          process.exit(1);
        }

        console.log(`  Using template '${templateName}'`);

        const clonedPath = resolve(targetPath);
        const repoConfig = getRepoConfig(config, clonedPath);
        const merged = mergeTemplateWithRepo(repoConfig, template);

        if (merged.postCreate.length > 0) {
          console.log("  Running postCreate hooks...");
          await executeHooks(merged.postCreate, {
            cwd: clonedPath,
            env: {
              OMW_REPO_PATH: clonedPath,
            },
            onOutput: (line) => console.log(`    ${line}`),
          });
          console.log("  ✓ Hooks completed");
        }

        console.log(`  ✓ Template '${templateName}' applied`);
      } catch (err) {
        if (err instanceof HookTimeoutError) {
          console.error(`Error: hook timed out: ${err.command}`);
        } else if (err instanceof HookError) {
          console.error(`Error: hook failed (exit ${err.exitCode}): ${err.command}`);
          if (err.stderr) {
            console.error(err.stderr);
          }
        } else {
          console.error(`Error applying template: ${(err as Error).message}`);
        }
        process.exit(1);
      }
    }

    console.log(`\nCloned: ${url} → ${targetPath}`);
    process.exit(0);
  },
};

export default cmd;
