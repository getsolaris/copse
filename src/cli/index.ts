import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureConfigInitialized } from "../core/config.ts";

function findPackageJson(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "package.json");
    try { readFileSync(candidate, "utf-8"); return candidate; } catch {}
    dir = join(dir, "..");
  }
  return join(import.meta.dir, "../../package.json");
}

const pkg = JSON.parse(
  readFileSync(findPackageJson(), "utf-8"),
) as { version: string };

const isInitCommand = process.argv[2] === "init";
if (!isInitCommand) {
  try {
    const ensured = ensureConfigInitialized();
    if (ensured.created && process.stdout.isTTY) {
      process.stderr.write(`copse: created default config at ${ensured.path}\n`);
    }
  } catch {}
}

if (process.argv.length === 2) {
  const { launchTUI } = await import("../tui/App.tsx");
  await launchTUI();
} else {
  const [addCmd, listCmd, removeCmd, switchCmd, cleanCmd, configCmd, doctorCmd, shellInitCmd, statusCmd, openCmd, execCmd, diffCmd, pinCmd, logCmd, archiveCmd, renameCmd, cloneCmd, importCmd, sessionCmd, initCmd] =
    await Promise.all([
      import("./cmd/add.ts"),
      import("./cmd/list.ts"),
      import("./cmd/remove.ts"),
      import("./cmd/switch.ts"),
      import("./cmd/clean.ts"),
      import("./cmd/config.ts"),
      import("./cmd/doctor.ts"),
      import("./cmd/shell-init.ts"),
      import("./cmd/status.ts"),
      import("./cmd/open.ts"),
      import("./cmd/exec.ts"),
      import("./cmd/diff.ts"),
      import("./cmd/pin.ts"),
      import("./cmd/log.ts"),
      import("./cmd/archive.ts"),
      import("./cmd/rename.ts"),
      import("./cmd/clone.ts"),
      import("./cmd/import.ts"),
      import("./cmd/session.ts"),
      import("./cmd/init.ts"),
    ]);

  yargs(hideBin(process.argv))
    .locale("en")
    .scriptName("copse")
    .version(`copse v${pkg.version}`)
    .alias("version", "v")
    .help("help")
    .alias("help", "h")
    .option("no-color", {
      type: "boolean",
      description: "Disable color output",
    })
    .command(addCmd.default)
    .command(listCmd.default)
    .command(removeCmd.default)
    .command(switchCmd.default)
    .command(cleanCmd.default)
    .command(configCmd.default)
    .command(doctorCmd.default)
    .command(shellInitCmd.default)
    .command(statusCmd.default)
    .command(openCmd.default)
    .command(execCmd.default)
    .command(diffCmd.default)
    .command(pinCmd.default)
    .command(logCmd.default)
    .command(archiveCmd.default)
    .command(renameCmd.default)
    .command(cloneCmd.default)
    .command(importCmd.default)
    .command(sessionCmd.default)
    .command(initCmd.default)
    .completion("completion", "Generate shell completion script")
    .demandCommand(
      1,
      "Please specify a command. Run --help to see available commands.",
    )
    .strict()
    .parse();
}
