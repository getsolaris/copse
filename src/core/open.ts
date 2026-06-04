export class EmptyTerminalCommandError extends Error {
  constructor() {
    super("terminalCommand must not be empty");
    this.name = "EmptyTerminalCommandError";
  }
}

const DEFAULT_FILE_MANAGER_COMMANDS: Record<string, string[]> = {
  darwin: ["open"],
  linux: ["xdg-open"],
  win32: ["explorer"],
};

const DEFAULT_TERMINAL_COMMANDS: Record<string, string[]> = {
  darwin: ["open", "-a", "Terminal"],
  linux: ["x-terminal-emulator", "--working-directory"],
};

export function buildFileManagerCommand(path: string, platform = process.platform): string[] {
  const [command, ...baseArgs] = DEFAULT_FILE_MANAGER_COMMANDS[platform] ?? DEFAULT_FILE_MANAGER_COMMANDS.linux;

  return [command, ...baseArgs, path];
}

export function buildTerminalCommand(
  path: string,
  terminalCommand?: string[],
  platform = process.platform,
): string[] {
  if (terminalCommand && terminalCommand.length > 0) {
    const hasPathToken = terminalCommand.some((token) => token.includes("{path}"));
    const argv = terminalCommand.map((token) => token.replaceAll("{path}", path));
    return hasPathToken ? argv : [...argv, path];
  }

  if (terminalCommand && terminalCommand.length === 0) {
    throw new EmptyTerminalCommandError();
  }

  if (platform === "win32") {
    return ["cmd", "/c", "start", "", "/D", path];
  }

  const [command, ...baseArgs] =
    DEFAULT_TERMINAL_COMMANDS[platform] ?? DEFAULT_TERMINAL_COMMANDS.linux;

  return [command, ...baseArgs, path];
}
