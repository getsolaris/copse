export type UpdateCheckSource = "network" | "cache";
export type UpdateFailureReason = "http" | "invalid-json" | "missing-tag" | "timeout" | "invalid-version" | "network";

export interface UpdateFetchInit {
  readonly headers: Record<string, string>;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface UpdateFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

export type UpdateFetch = (url: string, init: UpdateFetchInit) => Promise<UpdateFetchResponse>;

export type UpdateCheckResult =
  | { readonly status: "up-to-date"; readonly currentVersion: string; readonly latestVersion: string; readonly source: UpdateCheckSource }
  | { readonly status: "update-available"; readonly currentVersion: string; readonly latestVersion: string; readonly releaseUrl: string; readonly source: UpdateCheckSource }
  | { readonly status: "ignored-version"; readonly currentVersion: string; readonly latestVersion: string; readonly ignoredVersion: string; readonly source: UpdateCheckSource }
  | { readonly status: "check-failed"; readonly reason: UpdateFailureReason; readonly message: string; readonly source: UpdateCheckSource };

export interface UpdateCheckOptions {
  readonly currentVersion: string;
  readonly ignoredVersion?: string;
  readonly fetchImpl?: UpdateFetch;
  readonly nowMs?: number;
  readonly cachePath?: string;
}

export interface UpdateCacheEntry {
  readonly checkedAtMs: number;
  readonly result: UpdateCheckResult;
}

export interface WriteUpdateCacheOptions {
  readonly cachePath: string;
  readonly entry: UpdateCacheEntry;
  readonly nowMs?: number;
}
