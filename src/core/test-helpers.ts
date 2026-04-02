import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tempDirs: string[] = [];

export function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

export function cleanupTempDirs(): void {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

export async function runGit(args: string[], cwd?: string): Promise<void> {
  const proc = (Bun as any).spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...(Bun as any).env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });

  const [stderr, exitCode] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  }
}

export async function createTempRepo(prefix = "omw-test-"): Promise<string> {
  const dir = createTempDir(prefix);
  writeFileSync(join(dir, "README.md"), "# temp repo\n");

  await runGit(["init"], dir);
  await runGit(["add", "."], dir);
  await runGit(["commit", "-m", "init"], dir);

  return dir;
}

export async function createTempRepoWithRemote(
  prefix = "omw-test-",
): Promise<{ repoPath: string; remotePath: string }> {
  const repoPath = await createTempRepo(prefix);
  const remotePath = createTempDir(`${prefix}remote-`);

  await runGit(["init", "--bare"], remotePath);
  await runGit(["remote", "add", "origin", remotePath], repoPath);
  await runGit(["push", "origin", "HEAD"], repoPath);

  return { repoPath, remotePath };
}
