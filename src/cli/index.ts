import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dir, "../../package.json"), "utf-8"),
) as { version: string };

if (process.argv.length === 2) {
  const { launchTUI } = await import("../tui/App.tsx");
  await launchTUI();
} else {
  const [addCmd, listCmd, removeCmd, switchCmd, cleanCmd, configCmd, doctorCmd] =
    await Promise.all([
      import("./cmd/add.ts"),
      import("./cmd/list.ts"),
      import("./cmd/remove.ts"),
      import("./cmd/switch.ts"),
      import("./cmd/clean.ts"),
      import("./cmd/config.ts"),
      import("./cmd/doctor.ts"),
    ]);

  yargs(hideBin(process.argv))
    .locale("en")
    .scriptName("omw")
    .version(`oh-my-worktree v${pkg.version}`)
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
    .demandCommand(
      1,
      "Please specify a command. Run --help to see available commands.",
    )
    .strict()
    .parse();
}
