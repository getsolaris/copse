import type { CommandModule } from "yargs";
import { loadRawConfig } from "../../core/config.ts";
import { checkForUpdate } from "../../core/updater.ts";
import { executeInstallPlan, InstallExecutionError } from "../../core/updater-execute.ts";
import { confirm } from "../utils.ts";
import { buildInstallPlan, readCurrentVersion, testReleaseFetch, writeIgnoredVersion } from "../update-shared.ts";
import { printNonInteractiveUpdate, printStatus, resultToJson, unsupportedMessage, updateAvailableStatus, updateSummary } from "./update-output.ts";

const cmd: CommandModule = {
  command: "update",
  describe: "Check for and install copse updates",
  builder: (yargs) =>
    yargs
      .option("check", {
        type: "boolean",
        describe: "Check for updates without installing",
      })
      .option("yes", {
        type: "boolean",
        alias: "y",
        describe: "Install without prompting",
      })
      .option("json", {
        type: "boolean",
        alias: "j",
        describe: "Output as JSON",
      })
      .option("ignore", {
        type: "boolean",
        describe: "Ignore the current latest version",
      }),
  handler: async (argv) => {
    try {
      const json = argv.json === true;
      const checkOnly = argv.check === true;
      const assumeYes = argv.yes === true;
      const ignore = argv.ignore === true;
      const config = loadRawConfig();
      const result = await checkForUpdate({
        currentVersion: readCurrentVersion(),
        ignoredVersion: config.updates?.ignoredVersion,
        fetchImpl: testReleaseFetch(),
      });

      if (result.status !== "update-available") {
        printStatus(resultToJson(result), json);
        process.exit(result.status === "check-failed" ? 1 : 0);
      }

      if (ignore) {
        writeIgnoredVersion(result.latestVersion);
        printStatus({
          status: "ignored-version",
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseUrl: result.releaseUrl,
          message: `Ignored ${result.latestVersion}`,
        }, json);
        process.exit(0);
      }

      const plan = buildInstallPlan(result);
      if (checkOnly || (json && !assumeYes)) {
        printStatus(updateAvailableStatus(result, plan), json);
        process.exit(0);
      }

      if (plan.kind === "unsupported-install") {
        printStatus({
          status: "unsupported-install",
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseUrl: result.releaseUrl,
          installMethod: plan.method,
          reason: plan.reason,
          message: unsupportedMessage(plan.method),
        }, json);
        process.exit(assumeYes ? 1 : 0);
      }

      if (!assumeYes) {
        if (!process.stdin.isTTY) {
          printNonInteractiveUpdate(result);
          process.exit(0);
        }
        console.log(updateSummary(result, plan));
        if (!(await confirm("Install update now? [y/N] "))) {
          printStatus({ ...updateAvailableStatus(result, plan), status: "cancelled", message: "Update cancelled." }, json);
          process.exit(0);
        }
      }

      const installed = await executeInstallPlan(plan);
      printStatus({
        status: "updated",
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        releaseUrl: result.releaseUrl,
        installMethod: installed.method,
        stdout: installed.stdout,
        stderr: installed.stderr,
      }, json);
      process.exit(0);
    } catch (err) {
      if (err instanceof InstallExecutionError) {
        if (err.stderr && err.stderr.length > 0) console.error(err.stderr);
        console.error(`Error: ${err.message}`);
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  },
};

export default cmd;
