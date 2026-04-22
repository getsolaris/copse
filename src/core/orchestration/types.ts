export interface StepPlanEntry {
  id: string;
  label: string;
}

export interface StepProgressHandler {
  onStepPlan?: (steps: readonly StepPlanEntry[]) => void;
  onStepStart?: (id: string, message?: string) => void;
  onStepDone?: (id: string, message?: string) => void;
  onStepError?: (id: string, message: string) => void;
  onHookOutput?: (line: string) => void;
}

export const CREATE_STEP_IDS = {
  fetch: "fetch",
  worktree: "worktree",
  upstream: "upstream",
  copyFiles: "copyFiles",
  linkFiles: "linkFiles",
  sharedDeps: "sharedDeps",
  focus: "focus",
  postCreate: "postCreate",
  monorepoHooks: "monorepoHooks",
  session: "session",
  prMeta: "prMeta",
  activityLog: "activityLog",
} as const;

export type CreateStepId = (typeof CREATE_STEP_IDS)[keyof typeof CREATE_STEP_IDS];

export const REMOVE_STEP_IDS = {
  postRemove: "postRemove",
  monorepoHooks: "monorepoHooks",
  session: "session",
  worktree: "worktree",
  activityLog: "activityLog",
} as const;

export type RemoveStepId = (typeof REMOVE_STEP_IDS)[keyof typeof REMOVE_STEP_IDS];

export const ARCHIVE_STEP_IDS = {
  createArchive: "createArchive",
  activityLogArchive: "activityLogArchive",
} as const;

export type ArchiveStepId = (typeof ARCHIVE_STEP_IDS)[keyof typeof ARCHIVE_STEP_IDS];

export const IMPORT_STEP_IDS = {
  validate: "validate",
  importWorktree: "importWorktree",
  activityLog: "activityLog",
} as const;

export type ImportStepId = (typeof IMPORT_STEP_IDS)[keyof typeof IMPORT_STEP_IDS];

export const RENAME_STEP_IDS = {
  renameBranch: "renameBranch",
  movePath: "movePath",
  activityLog: "activityLog",
} as const;

export type RenameStepId = (typeof RENAME_STEP_IDS)[keyof typeof RENAME_STEP_IDS];

export interface CreateWorktreeOpts {
  branch: string;
  worktreePath: string;
  mainRepoPath: string;
  repoName: string;
  base?: string;
  focusPaths?: string[];
  prNumber?: number;
  templateName?: string;
  session?: boolean;
  layoutName?: string;
  fetch?: boolean;
}

export interface CreateWorktreeResult {
  sessionName?: string;
  fetchWarning?: string;
  validFocusPaths: string[];
  invalidFocusPaths: string[];
}

export interface RemoveWorktreeOpts {
  worktreePath: string;
  mainRepoPath: string;
  repoName: string;
  branch: string | null;
  force?: boolean;
}

export interface ArchiveWorktreeOpts {
  worktreePath: string;
  mainRepoPath: string;
  repoName: string;
  branch: string | null;
  keep?: boolean;
  force?: boolean;
}

export interface ImportWorktreeOpts {
  targetPath: string;
  focusPaths?: string[];
  pin?: boolean;
}

export interface RenameWorktreeOpts {
  mainRepoPath: string;
  oldBranch: string;
  newBranch: string;
  worktreePath: string;
  movePath?: boolean;
}
