export interface Worktree {
  path: string;
  branch: string | null;
  head: string;
  isMain: boolean;
  isDirty: boolean;
  isLocked: boolean;
  lockReason?: string;
  repoName: string;
  repoPath: string;
}

export interface GitError extends Error {
  exitCode: number;
  stderr: string;
  command: string;
}

export class GitError extends Error {
  constructor(
    message: string,
    public exitCode: number,
    public stderr: string,
    public command: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

export class GitVersionError extends Error {
  constructor(public installed: string, public required: string) {
    super(`git version ${installed} is below minimum required ${required}`);
    this.name = "GitVersionError";
  }
}
