import type { CommandModule } from "yargs";

type SupportedShell = "bash" | "zsh" | "fish";

function detectShell(shellPath?: string): SupportedShell {
  if (shellPath?.includes("fish")) return "fish";
  if (shellPath?.includes("bash")) return "bash";
  return "zsh";
}

function getBashLikeInit(): string {
  return `copse() {
  if [ "$1" = "switch" ] || [ "$1" = "sw" ]; then
    local output
    output=$(command copse "$@" 2>/dev/null)
    local status=$?
    if [ $status -ne 0 ]; then
      command copse "$@"
      return $status
    fi

    if [[ "$output" == cd\\ * ]]; then
      eval "$output"
    elif [ -n "$output" ]; then
      printf '%s\\n' "$output"
    fi
  else
    command copse "$@"
  fi
}`;
}

function getFishInit(): string {
  return `function copse
  if test "$argv[1]" = "switch"; or test "$argv[1]" = "sw"
    set output (command copse $argv 2>/dev/null)
    set status_code $status
    if test $status_code -ne 0
      command copse $argv
      return $status_code
    end

    if string match -q 'cd *' -- $output
      eval $output
    else if test -n "$output"
      printf '%s\\n' $output
    end
  else
    command copse $argv
  end
end`;
}

function getBashCompletions(): string {
  return `_copse_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local commands="add list remove switch clean config doctor pin log archive rename clone import exec diff open status shell-init"

  if [ \$COMP_CWORD -eq 1 ]; then
    COMPREPLY=(\$(compgen -W "\$commands" -- "\$cur"))
    return
  fi

  case "\$prev" in
    add|switch|rename|pin|archive)
      local branches=\$(git branch --format='%(refname:short)' 2>/dev/null)
      COMPREPLY=(\$(compgen -W "\$branches" -- "\$cur"))
      ;;
    remove)
      local worktrees=\$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/worktree //' | xargs -I{} basename {})
      COMPREPLY=(\$(compgen -W "\$worktrees" -- "\$cur"))
      ;;
    *)
      COMPREPLY=()
      ;;
  esac
}
complete -F _copse_completions copse`;
}

function getZshCompletions(): string {
  return `_copse() {
  local -a commands
  commands=(
    'add:Add a new worktree'
    'list:List worktrees'
    'remove:Remove a worktree'
    'switch:Switch to a worktree'
    'clean:Clean merged/stale worktrees'
    'config:Manage configuration'
    'doctor:Health check'
    'pin:Pin a worktree'
    'log:Show activity log'
    'archive:Archive worktree changes'
    'rename:Rename worktree branch'
    'clone:Clone and init copse'
    'import:Adopt a worktree'
    'exec:Run command in worktrees'
    'diff:Show diff between worktrees'
    'open:Open worktree in editor'
    'status:Show worktree status'
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
  else
    case "\${words[2]}" in
      add|switch|rename|pin|archive)
        local branches=(\${(f)"\$(git branch --format='%(refname:short)' 2>/dev/null)"})
        compadd -a branches
        ;;
      remove)
        local worktrees=(\${(f)"\$(git worktree list --porcelain 2>/dev/null | grep '^worktree ' | sed 's/worktree //')"})
        compadd -a worktrees
        ;;
    esac
  fi
}
compdef _copse copse`;
}

function getFishCompletions(): string {
  return `complete -c copse -f
complete -c copse -n '__fish_use_subcommand' -a 'add' -d 'Add a new worktree'
complete -c copse -n '__fish_use_subcommand' -a 'list' -d 'List worktrees'
complete -c copse -n '__fish_use_subcommand' -a 'remove' -d 'Remove a worktree'
complete -c copse -n '__fish_use_subcommand' -a 'switch' -d 'Switch to a worktree'
complete -c copse -n '__fish_use_subcommand' -a 'clean' -d 'Clean worktrees'
complete -c copse -n '__fish_use_subcommand' -a 'config' -d 'Manage configuration'
complete -c copse -n '__fish_use_subcommand' -a 'doctor' -d 'Health check'
complete -c copse -n '__fish_use_subcommand' -a 'pin' -d 'Pin a worktree'
complete -c copse -n '__fish_use_subcommand' -a 'log' -d 'Activity log'
complete -c copse -n '__fish_use_subcommand' -a 'archive' -d 'Archive changes'
complete -c copse -n '__fish_use_subcommand' -a 'rename' -d 'Rename branch'
complete -c copse -n '__fish_use_subcommand' -a 'clone' -d 'Clone and init'
complete -c copse -n '__fish_use_subcommand' -a 'import' -d 'Adopt worktree'
complete -c copse -n '__fish_use_subcommand' -a 'exec' -d 'Run command'
complete -c copse -n '__fish_use_subcommand' -a 'diff' -d 'Show diff'
complete -c copse -n '__fish_use_subcommand' -a 'open' -d 'Open in editor'
complete -c copse -n '__fish_use_subcommand' -a 'status' -d 'Show status'
complete -c copse -n '__fish_seen_subcommand_from add switch rename pin archive' -a '(git branch --format="%(refname:short)" 2>/dev/null)'`;
}

function getCompletionsForShell(shell: SupportedShell): string {
  switch (shell) {
    case "bash":
      return getBashCompletions();
    case "zsh":
      return getZshCompletions();
    case "fish":
      return getFishCompletions();
  }
}

const cmd: CommandModule = {
  command: "shell-init [shell]",
  describe: "Print shell integration code for copse switch",
  builder: (yargs) =>
    yargs
      .positional("shell", {
        type: "string",
        choices: ["bash", "zsh", "fish"],
        describe: "Shell to generate integration for (auto-detected if omitted)",
      })
      .option("completions", {
        type: "string",
        describe: "Generate shell completions (bash, zsh, fish)",
        coerce: (v: string | boolean) => (v === true ? undefined : v),
      }),
  handler: async (argv) => {
    const hasCompletions = "completions" in argv;
    const explicitShell = argv.shell as string | undefined;
    const completionsShell = argv.completions as string | undefined;

    const shell = (
      explicitShell ??
      completionsShell ??
      detectShell(process.env.SHELL)
    ) as SupportedShell;

    if (hasCompletions) {
      const initOutput = shell === "fish" ? getFishInit() : getBashLikeInit();
      const completionsOutput = getCompletionsForShell(shell);
      console.log(initOutput + "\n" + completionsOutput);
      process.exit(0);
    }

    if (shell === "fish") {
      console.log(getFishInit());
      process.exit(0);
    }

    console.log(getBashLikeInit());
    process.exit(0);
  },
};

export default cmd;
