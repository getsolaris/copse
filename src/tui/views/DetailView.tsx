import { Show, For, createSignal, createEffect, on, onCleanup } from "solid-js";
import { useTerminalDimensions, useRenderer, useSelectionHandler } from "@opentui/solid";
import { useGit } from "../context/GitContext.tsx";
import { useToast } from "../context/ToastContext.tsx";
import { theme } from "../themes.ts";
import { readFocus } from "../../core/focus.ts";
import { readSessionMeta, sessionExists, type SessionInfo } from "../../core/session.ts";
import { GitWorktree } from "../../core/git.ts";
import type { Worktree } from "../../core/types.ts";
import { Spinner } from "./Spinner.tsx";

interface DetailData {
  commits: string[];
  diffStat: string;
  fullDiff: string;
  aheadBehind: { ahead: number; behind: number };
  focus: string[] | null;
  session: { meta: SessionInfo; active: boolean } | null;
}

const DEBOUNCE_MS = 150;
const LABEL_W = 16;

export function DetailView(props: { worktree: Worktree }) {
  const git = useGit();
  const toast = useToast();
  const renderer = useRenderer();
  const dims = useTerminalDimensions();

  const w = () => dims().width;
  const h = () => dims().height;

  const [data, setData] = createSignal<DetailData | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");

  useSelectionHandler((selection) => {
    const text = selection.getSelectedText();
    if (!text) return;

    renderer.copyToClipboardOSC52(text);
    toast.addToast({ type: "info", message: "Copied to clipboard" });
  });

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  const mainBranch = () => {
    const wts = git.worktrees() ?? [];
    const main = wts.find((wt) => wt.isMain);
    return main?.branch ?? "main";
  };

  createEffect(
    on(
      () => props.worktree.path,
      (path) => {
        if (debounceTimer) clearTimeout(debounceTimer);

        if (!path) {
          setData(null);
          setError("");
          setLoading(false);
          return;
        }

        setData(null);
        setError("");
        setLoading(true);

        debounceTimer = setTimeout(async () => {
          if (props.worktree.path !== path) return;

          try {
            const [commits, [diffStat, fullDiff], aheadBehind] = await Promise.all([
              fetchRecentCommits(path),
              props.worktree.branch && !props.worktree.isMain
                ? Promise.all([
                    GitWorktree.diffBetween(mainBranch(), props.worktree.branch, { stat: true }, path).catch(() => ""),
                    GitWorktree.diffBetween(mainBranch(), props.worktree.branch, undefined, path).catch(() => ""),
                  ])
                : Promise.resolve(["", ""]),
              props.worktree.branch
                ? GitWorktree.getAheadBehind(props.worktree.branch, path)
                : Promise.resolve({ ahead: 0, behind: 0 }),
            ]);

            if (props.worktree.path !== path) return;

            let focus: string[] | null = null;
            try {
              focus = readFocus(path);
            } catch {}

            let session: DetailData["session"] = null;
            const meta = readSessionMeta(path);
            if (meta) {
              const active = await sessionExists(meta.name).catch(() => false);
              session = { meta, active };
            }

            if (props.worktree.path !== path) return;

            setData({ commits, diffStat, fullDiff, aheadBehind, focus, session });
            setError("");
          } catch (err) {
            if (props.worktree.path !== path) return;
            setData(null);
            setError((err as Error).message);
          } finally {
            if (props.worktree.path === path) {
              setLoading(false);
            }
          }
        }, DEBOUNCE_MS);
      },
    ),
  );

  const statusLabel = () => {
    const wt = props.worktree;
    if (wt.isLocked) return "\uD83D\uDD12 locked";
    if (wt.isDirty) return "\u25CF dirty";
    return "\u2713 clean";
  };

  const statusColor = () => {
    const wt = props.worktree;
    if (wt.isLocked) return theme.text.warning;
    if (wt.isDirty) return theme.text.error;
    return theme.text.success;
  };

  const syncLabel = () => {
    const d = data();
    if (!d) return "";
    const parts: string[] = [];
    if (d.aheadBehind.ahead > 0) parts.push(`\u2191${d.aheadBehind.ahead}`);
    if (d.aheadBehind.behind > 0) parts.push(`\u2193${d.aheadBehind.behind}`);
    return parts.length > 0 ? parts.join(" ") : "\u2713 up to date";
  };

  const syncColor = () => {
    const d = data();
    if (!d) return theme.text.secondary;
    return d.aheadBehind.ahead || d.aheadBehind.behind
      ? theme.text.warning
      : theme.text.success;
  };

  const separator = () => "\u2500".repeat(Math.max(w() - 7, 10));

  return (
    <box x={0} y={0} width={w()} height={h()} backgroundColor={theme.bg.base}>
      <scrollbox x={2} y={1} width={w() - 3} height={h() - 3}>
        <box height={1}>
          <text x={0} y={0} fg={theme.text.accent} bold selectable>
            Worktree Detail
          </text>
          <text x={17} y={0} fg={theme.text.secondary} selectable>
            {"(Esc to close)"}
          </text>
        </box>

        <box height={1}>
          <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
        </box>

        <box height={1} />

        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text x={0} y={0} fg={theme.text.secondary} selectable>Branch</text>
          </box>
          <text selectable fg={theme.text.accent}>{props.worktree.branch ?? "(detached)"}</text>
        </box>

        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text x={0} y={0} fg={theme.text.secondary} selectable>Path</text>
          </box>
          <text selectable fg={theme.text.primary}>{props.worktree.path}</text>
        </box>

        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text x={0} y={0} fg={theme.text.secondary} selectable>Status</text>
          </box>
          <text selectable fg={statusColor()}>{statusLabel()}</text>
        </box>

        <box height={1} flexDirection="row">
          <box width={LABEL_W} height={1}>
            <text x={0} y={0} fg={theme.text.secondary} selectable>HEAD</text>
          </box>
          <text selectable fg={theme.text.secondary}>{props.worktree.head?.slice(0, 8)}</text>
        </box>

        <Show when={loading()}>
          <box height={1} />
          <box height={1}>
            <Spinner label="Loading details..." />
          </box>
        </Show>

        <Show when={!loading() && !!error()}>
          <box height={1} />
          <box height={1}>
            <text x={0} y={0} fg={theme.text.error} selectable>
              {`Failed to load details: ${error()}`}
            </text>
          </box>
        </Show>

        <Show when={!loading() && !error() && !!data()}>
          <box height={1} />
          <box height={1}>
            <text x={0} y={0} fg={theme.text.accent} bold selectable>
              Upstream
            </text>
          </box>
          <box height={1}>
            <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
          </box>
          <box height={1} flexDirection="row">
            <box width={LABEL_W} height={1}>
              <text x={0} y={0} fg={theme.text.secondary} selectable>Sync</text>
            </box>
            <text selectable fg={syncColor()}>{syncLabel()}</text>
          </box>
          <Show when={data()!.aheadBehind.ahead > 0}>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary} selectable>Ahead</text>
              </box>
              <text selectable fg={theme.text.warning}>{`${data()!.aheadBehind.ahead} commit(s)`}</text>
            </box>
          </Show>
          <Show when={data()!.aheadBehind.behind > 0}>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary} selectable>Behind</text>
              </box>
              <text selectable fg={theme.text.warning}>{`${data()!.aheadBehind.behind} commit(s)`}</text>
            </box>
          </Show>

          <box height={1} />
          <box height={1}>
            <text x={0} y={0} fg={theme.text.accent} bold selectable>
              Recent Commits
            </text>
          </box>
          <box height={1}>
            <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
          </box>
          <Show
            when={data()!.commits.length > 0}
            fallback={
              <box height={1}>
                <text x={0} y={0} fg={theme.text.secondary} selectable>No commits found</text>
              </box>
            }
          >
            <For each={data()!.commits}>
              {(line) => (
                <box height={1}>
                  <text x={0} y={0} fg={theme.text.primary} selectable>{line}</text>
                </box>
              )}
            </For>
          </Show>

          <Show when={!props.worktree.isMain}>
            <box height={1} />
            <box height={1}>
              <text x={0} y={0} fg={theme.text.accent} bold selectable>
                {`Diff vs ${mainBranch()}`}
              </text>
            </box>
            <box height={1}>
              <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
            </box>
            <Show when={data()!.diffStat.length > 0}>
              <code language="diff" code={data()!.diffStat} />
            </Show>
            <box height={1} />
            <Show
              when={data()!.fullDiff.length > 0}
              fallback={
                <box height={1}>
                  <text x={0} y={0} fg={theme.text.secondary} selectable>No changes</text>
                </box>
              }
            >
              <scrollbox height={15} width={w() - 3}>
                <diff diff={data()!.fullDiff} view="unified" />
              </scrollbox>
            </Show>
          </Show>

          <Show when={data()!.focus && data()!.focus!.length > 0}>
            <box height={1} />
            <box height={1}>
              <text x={0} y={0} fg={theme.text.accent} bold selectable>
                Focus Paths
              </text>
            </box>
            <box height={1}>
              <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
            </box>
            <For each={data()!.focus!}>
              {(p) => (
                <box height={1}>
                  <text x={0} y={0} fg={theme.text.primary} selectable>
                    {`  \u2022 ${p}`}
                  </text>
                </box>
              )}
            </For>
          </Show>

          <Show when={data()!.session}>
            <box height={1} />
            <box height={1}>
              <text x={0} y={0} fg={theme.text.accent} bold selectable>
                Session
              </text>
            </box>
            <box height={1}>
              <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
            </box>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary} selectable>Name</text>
              </box>
              <text selectable fg={theme.text.primary}>{data()!.session!.meta.name}</text>
            </box>
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary} selectable>Status</text>
              </box>
              <text selectable fg={data()!.session!.active ? theme.text.success : theme.text.error}>{data()!.session!.active ? "\u25CF active" : "\u25CB inactive"}</text>
            </box>
            <Show when={data()!.session!.meta.layout}>
              <box height={1} flexDirection="row">
                <box width={LABEL_W} height={1}>
                  <text x={0} y={0} fg={theme.text.secondary} selectable>Layout</text>
                </box>
                <text selectable fg={theme.text.primary}>{data()!.session!.meta.layout}</text>
              </box>
            </Show>
          </Show>

          <Show when={props.worktree.isMain}>
            <box height={1} />
            <box height={1} flexDirection="row">
              <box width={LABEL_W} height={1}>
                <text x={0} y={0} fg={theme.text.secondary} selectable>Type</text>
              </box>
              <text selectable fg={theme.text.accent}>main worktree</text>
            </box>
          </Show>
        </Show>

        <box height={1} />
        <box height={1}>
          <text x={0} y={0} fg={theme.border.subtle} selectable>{separator()}</text>
        </box>
        <box height={1}>
          <text x={0} y={0} fg={theme.text.secondary} selectable>
            {"Esc:back  d:delete  o:open  r:refresh"}
          </text>
        </box>
      </scrollbox>
    </box>
  );
}

async function fetchRecentCommits(cwd: string): Promise<string[]> {
  try {
    const proc = (Bun as any).spawn(["git", "log", "--oneline", "-10"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, LC_ALL: "C" },
    });
    const output: string = await new Response(proc.stdout).text();
    await proc.exited;
    if (proc.exitCode !== 0) return [];
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
