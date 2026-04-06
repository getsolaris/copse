import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { getMetadataFilePath } from "./metadata.ts";

export interface PRMeta {
  number: number;
  branch: string;
  createdAt: string;
}

function getPRMetaPath(worktreePath: string): string {
  return getMetadataFilePath(worktreePath, "omw-pr");
}

export function writePRMeta(worktreePath: string, meta: PRMeta): void {
  const metaPath = getPRMetaPath(worktreePath);
  mkdirSync(dirname(metaPath), { recursive: true });
  writeFileSync(metaPath, JSON.stringify(meta), { encoding: "utf-8", mode: 0o600 });
}


