export type InstallMethod = "homebrew" | "bun" | "npm" | "standalone" | "source";

export interface InstallDetectionEnv {
  readonly HOMEBREW_PREFIX?: string;
  readonly HOME?: string;
}

export interface InstallDetectionOptions {
  readonly executablePath: string;
  readonly realpath?: (path: string) => string;
  readonly which?: (command: string) => string | undefined;
  readonly pathExists?: (path: string) => boolean;
  readonly env?: InstallDetectionEnv;
}

export interface StandaloneUpdateAsset {
  readonly downloadUrl: string;
  readonly digest?: string;
}

export interface InstallUpdatePlanOptions {
  readonly method: InstallMethod;
  readonly latestVersion: string;
  readonly executablePath: string;
  readonly standaloneAsset?: StandaloneUpdateAsset;
}

export type InstallUpdatePlan =
  | { readonly kind: "command"; readonly method: "homebrew" | "bun" | "npm"; readonly command: readonly string[] }
  | {
    readonly kind: "standalone";
    readonly method: "standalone";
    readonly targetPath: string;
    readonly preserveModeFrom: string;
    readonly downloadUrl: string;
    readonly digest: string;
  }
  | {
    readonly kind: "unsupported-install";
    readonly method: "standalone" | "source";
    readonly reason: "digest-required" | "source-checkout";
  };

class InstallPlanError extends Error {
  readonly name = "InstallPlanError";
}

export function detectInstallMethod(options: InstallDetectionOptions): InstallMethod {
  const executablePath = options.realpath?.(options.executablePath) ?? options.executablePath;
  const homebrewPrefix = options.env?.HOMEBREW_PREFIX;
  if (
    executablePath.includes("/Cellar/copse/")
    || (homebrewPrefix !== undefined && executablePath.startsWith(`${homebrewPrefix}/Cellar/copse/`))
  ) {
    return "homebrew";
  }
  if (executablePath.includes("/.bun/install/global/")) return "bun";
  if (executablePath.includes("/node_modules/@getsolaris/copse/")) return "npm";
  if (executablePath.endsWith("/copse.js") || executablePath.endsWith("/copse")) return "standalone";
  return "source";
}

export function planInstallUpdate(options: InstallUpdatePlanOptions): InstallUpdatePlan {
  switch (options.method) {
    case "homebrew":
      return { kind: "command", method: "homebrew", command: ["brew", "upgrade", "getsolaris/tap/copse"] };
    case "bun":
      return { kind: "command", method: "bun", command: ["bun", "install", "-g", `@getsolaris/copse@${options.latestVersion}`] };
    case "npm":
      return { kind: "command", method: "npm", command: ["npm", "install", "-g", `@getsolaris/copse@${options.latestVersion}`] };
    case "standalone":
      return planStandaloneUpdate(options);
    case "source":
      return { kind: "unsupported-install", method: "source", reason: "source-checkout" };
    default:
      return assertNever(options.method);
  }
}

function planStandaloneUpdate(options: InstallUpdatePlanOptions): InstallUpdatePlan {
  const asset = options.standaloneAsset;
  if (asset?.digest === undefined || !asset.digest.startsWith("sha256:")) {
    return { kind: "unsupported-install", method: "standalone", reason: "digest-required" };
  }
  return {
    kind: "standalone",
    method: "standalone",
    targetPath: options.executablePath,
    preserveModeFrom: options.executablePath,
    downloadUrl: asset.downloadUrl,
    digest: asset.digest,
  };
}

function assertNever(value: never): never {
  throw new InstallPlanError(`unhandled install method: ${value}`);
}
