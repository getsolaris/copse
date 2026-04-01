import type { CommandModule } from "yargs";
import { runAllChecks } from "../../core/doctor.ts";

const cmd: CommandModule = {
  command: "doctor",
  describe: "Check worktree health and diagnose issues",
  builder: (yargs) =>
    yargs.option("json", {
      type: "boolean",
      alias: "j",
      describe: "Output as JSON",
    }),
  handler: async (argv) => {
    const cwd = process.cwd();
    const report = await runAllChecks(cwd);

    if (argv.json) {
      const summary = {
        pass: report.checks.filter((c) => c.status === "pass").length,
        warn: report.checks.filter((c) => c.status === "warn").length,
        fail: report.checks.filter((c) => c.status === "fail").length,
      };
      console.log(
        JSON.stringify(
          { healthy: report.healthy, checks: report.checks, summary },
          null,
          2,
        ),
      );
      process.exit(report.healthy ? 0 : 1);
    }

    console.log("oh-my-worktree doctor\n");
    for (const check of report.checks) {
      const icon =
        check.status === "pass"
          ? "\u2713"
          : check.status === "warn"
            ? "\u26A0"
            : "\u2717";
      console.log(`${icon} ${check.name}: ${check.message}`);
      if (check.detail) {
        for (const line of check.detail) {
          console.log(`  \u2192 ${line}`);
        }
      }
    }

    const warns = report.checks.filter((c) => c.status === "warn").length;
    const fails = report.checks.filter((c) => c.status === "fail").length;
    if (report.healthy) {
      console.log("\nAll checks passed.");
    } else {
      const parts: string[] = [];
      if (fails > 0) parts.push(`${fails} error(s)`);
      if (warns > 0) parts.push(`${warns} warning(s)`);
      console.log(`\n${parts.join(", ")} found.`);
    }

    process.exit(report.healthy ? 0 : 1);
  },
};

export default cmd;
