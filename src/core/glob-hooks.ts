import { executeHooks } from "./hooks.ts";
import type { HookOptions } from "./hooks.ts";
import { copyFiles, linkFiles } from "./files.ts";

export interface MonorepoHookConfig {
  glob: string;
  copyFiles?: string[];
  linkFiles?: string[];
  postCreate?: string[];
  postRemove?: string[];
}

export interface GlobHookMatch {
  glob: string;
  matchedPaths: string[];
  copyFiles: string[];
  linkFiles: string[];
  postCreate: string[];
  postRemove: string[];
}

export interface GlobHookExecuteOptions extends HookOptions {
  repo: string;
  branch: string;
  focusPaths: string[];
  mainRepoPath: string;
}

export function matchHooksForFocus(
  hooks: MonorepoHookConfig[],
  focusPaths: string[],
): GlobHookMatch[] {
  return hooks
    .map((hook) => {
      const glob = new Bun.Glob(hook.glob);
      const matchedPaths = focusPaths.filter((focusPath) => glob.match(focusPath));

      return {
        glob: hook.glob,
        matchedPaths,
        copyFiles: hook.copyFiles ?? [],
        linkFiles: hook.linkFiles ?? [],
        postCreate: hook.postCreate ?? [],
        postRemove: hook.postRemove ?? [],
      };
    })
    .filter((match) => match.matchedPaths.length > 0);
}

export function expandHookCommand(
  command: string,
  context: { packagePath: string; repo: string; branch: string },
): string {
  return command
    .replace(/\{packagePath\}/g, context.packagePath)
    .replace(/\{repo\}/g, context.repo)
    .replace(/\{branch\}/g, context.branch);
}

export async function executeGlobHooks(
  matches: GlobHookMatch[],
  phase: "postCreate" | "postRemove",
  opts: GlobHookExecuteOptions,
): Promise<void> {
  for (const match of matches) {
    const commands = match[phase];
    const hasCopyFiles = phase === "postCreate" && match.copyFiles.length > 0;
    const hasLinkFiles = phase === "postCreate" && match.linkFiles.length > 0;
    const hasCommands = commands.length > 0;

    if (!hasCopyFiles && !hasLinkFiles && !hasCommands) {
      continue;
    }

    for (const packagePath of match.matchedPaths) {
      const { join } = await import("path");
      const srcPkgDir = join(opts.mainRepoPath, packagePath);
      const dstPkgDir = join(opts.cwd, packagePath);

      if (hasCopyFiles) {
        const result = copyFiles(srcPkgDir, dstPkgDir, match.copyFiles);
        for (const f of result.copied) {
          opts.onOutput?.(`Copied ${packagePath}/${f}`);
        }
        for (const w of result.warnings) {
          opts.onOutput?.(`⚠ ${w}`);
        }
      }

      if (hasLinkFiles) {
        const result = linkFiles(srcPkgDir, dstPkgDir, match.linkFiles);
        for (const f of result.linked) {
          opts.onOutput?.(`Linked ${packagePath}/${f}`);
        }
        for (const w of result.warnings) {
          opts.onOutput?.(`⚠ ${w}`);
        }
      }

      if (hasCommands) {
        const expandedCommands = commands.map((command) =>
          expandHookCommand(command, {
            packagePath,
            repo: opts.repo,
            branch: opts.branch,
          }),
        );

        const env: Record<string, string> = {
          ...(opts.env ?? {}),
          COPSE_FOCUS_PATHS: opts.focusPaths.join(","),
          COPSE_PACKAGE_PATH: packagePath,
        };

        await executeHooks(expandedCommands, {
          cwd: opts.cwd,
          timeout: opts.timeout,
          env,
          onOutput: opts.onOutput,
        });
      }
    }
  }
}
