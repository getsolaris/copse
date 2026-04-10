import type { CommandModule } from "yargs";
import { runAllChecks, runFixes } from "../../core/doctor.ts";

const cmd: CommandModule = {
  command: "doctor",
  describe: "Check worktree health and diagnose issues",
  builder: (yargs) =>
    yargs
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("fix", {
        type: "boolean",
        describe: "Auto-fix issues (prune stale, remove orphans, unlock stale locks)",
      }),
  handler: async (argv) => {
    const cwd = process.cwd();
    const report = await runAllChecks(cwd);

    if (argv.json && !argv.fix) {
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

    console.log("copse doctor\n");
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

    if (argv.fix) {
      if (report.healthy) {
        console.log("\nNothing to fix.");
        process.exit(0);
      }

      console.log("\nRunning auto-fix...\n");
      const fixes = await runFixes(cwd);

      if (fixes.length === 0) {
        console.log("No auto-fixable issues found.");
      } else {
        for (const fix of fixes) {
          const icon = fix.success ? "\u2713" : "\u2717";
          const detail = fix.detail ? ` (${fix.detail})` : "";
          console.log(`${icon} ${fix.action}${detail}`);
        }

        const successCount = fixes.filter((f) => f.success).length;
        const failCount = fixes.filter((f) => !f.success).length;

        console.log(
          `\nFixed ${successCount} issue(s)${failCount > 0 ? `, ${failCount} failed` : ""}.`,
        );
      }

      const recheck = await runAllChecks(cwd);
      if (recheck.healthy) {
        console.log("All checks now pass.");
      }

      process.exit(recheck.healthy ? 0 : 1);
    }

    process.exit(report.healthy ? 0 : 1);
  },
};

export default cmd;
