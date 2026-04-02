import type { CommandModule } from "yargs";

type SupportedShell = "bash" | "zsh" | "fish";

function detectShell(shellPath?: string): SupportedShell {
  if (shellPath?.includes("fish")) return "fish";
  if (shellPath?.includes("bash")) return "bash";
  return "zsh";
}

function getBashLikeInit(): string {
  return `omw() {
  if [ "$1" = "switch" ] || [ "$1" = "sw" ]; then
    local output
    output=$(command omw "$@" 2>/dev/null)
    local status=$?
    if [ $status -ne 0 ]; then
      command omw "$@"
      return $status
    fi

    if [[ "$output" == cd\\ * ]]; then
      eval "$output"
    elif [ -n "$output" ]; then
      printf '%s\\n' "$output"
    fi
  else
    command omw "$@"
  fi
}`;
}

function getFishInit(): string {
  return `function omw
  if test "$argv[1]" = "switch"; or test "$argv[1]" = "sw"
    set output (command omw $argv 2>/dev/null)
    set status_code $status
    if test $status_code -ne 0
      command omw $argv
      return $status_code
    end

    if string match -q 'cd *' -- $output
      eval $output
    else if test -n "$output"
      printf '%s\\n' $output
    end
  else
    command omw $argv
  end
end`;
}

const cmd: CommandModule = {
  command: "shell-init [shell]",
  describe: "Print shell integration code for omw switch",
  builder: (yargs) =>
    yargs.positional("shell", {
      type: "string",
      choices: ["bash", "zsh", "fish"],
      describe: "Shell to generate integration for (auto-detected if omitted)",
    }),
  handler: async (argv) => {
    const shell = ((argv.shell as string | undefined) ?? detectShell(process.env.SHELL)) as SupportedShell;

    if (shell === "fish") {
      console.log(getFishInit());
      process.exit(0);
    }

    console.log(getBashLikeInit());
    process.exit(0);
  },
};

export default cmd;
