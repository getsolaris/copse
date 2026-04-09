import { createContext, createResource, createMemo, useContext, type JSX } from "solid-js";
import { GitWorktree, invalidateGitCache } from "../../core/git.ts";
import type { Worktree } from "../../core/types.ts";

interface GitState {
  worktrees: () => Worktree[] | undefined;
  refetch: () => void;
  loading: () => boolean;
  error: () => Error | undefined;
  repoNames: () => string[];
  isMultiRepo: () => boolean;
}

const GitContext = createContext<GitState>();

export function GitProvider(props: { children: JSX.Element; repoPaths: string[] }) {
  const [worktrees, { refetch: rawRefetch }] = createResource(async () => {
    try {
      if (props.repoPaths.length <= 1) {
        return await GitWorktree.list(props.repoPaths[0]);
      }
      return await GitWorktree.listAll(props.repoPaths);
    } catch (err) {
      throw err;
    }
  });

  const refetch = () => {
    invalidateGitCache();
    rawRefetch();
  };

  // Solid's createResource accessor re-throws the stored error inside reactive
  // contexts when no ErrorBoundary wraps it. Without this gate, `git.worktrees()`
  // crashes keyboard/effect handlers whenever list() fails (e.g. non-git cwd).
  const safeWorktrees = () => {
    if (worktrees.error) return undefined;
    try {
      return worktrees();
    } catch {
      return undefined;
    }
  };

  const repoNames = createMemo(() => {
    const wts = safeWorktrees() ?? [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const wt of wts) {
      if (!seen.has(wt.repoName)) {
        seen.add(wt.repoName);
        names.push(wt.repoName);
      }
    }
    return names;
  });

  const isMultiRepo = createMemo(() => repoNames().length > 1);

  return (
    <GitContext.Provider
      value={{
        worktrees: safeWorktrees,
        refetch,
        loading: () => worktrees.loading,
        error: () => worktrees.error as Error | undefined,
        repoNames,
        isMultiRepo,
      }}
    >
      {props.children}
    </GitContext.Provider>
  );
}

export function useGit() {
  const ctx = useContext(GitContext);
  if (!ctx) throw new Error("useGit must be used within GitProvider");
  return ctx;
}
