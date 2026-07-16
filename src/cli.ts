import type { CommandDef } from "citty";

const meta = {
  name: "zhao",
  version: "0.1.0",
  description: "按域名、关键词和模块快速检索本地项目",
};

const searchArgs = {
  query: {
    type: "positional" as const,
    description: "域名、别名、关键词或项目名",
    required: false,
  },
  print: {
    type: "boolean" as const,
    description: "仅打印选中的项目路径",
    default: false,
  },
  claude: {
    type: "boolean" as const,
    description: "由 shell wrapper 在 cd 后启动 Claude Code",
    default: false,
  },
  tmux: {
    type: "boolean" as const,
    description: "由 shell wrapper 在 tmux 新窗口中打开",
    default: false,
  },
};

export const runCittyCli = async (rawArgs: string[]): Promise<void> => {
  const { defineCommand, renderUsage, runCommand } = await import("citty");
  const subCommands = {
    init: async () =>
      (await import("./commands/init.js")).default(defineCommand),
    setup: async () =>
      (await import("./commands/setup.js")).default(defineCommand),
    scan: async () =>
      (await import("./commands/scan.js")).default(defineCommand),
    browse: async () =>
      (await import("./commands/browse.js")).default(defineCommand),
    list: async () =>
      (await import("./commands/list.js")).default(defineCommand),
  };
  const rootCommand = defineCommand({
    meta: {
      ...meta,
      description: `${meta.description}；直接传 query 可检索项目`,
    },
    args: searchArgs,
    subCommands,
  });
  const firstPositional = rawArgs.find((argument) => !argument.startsWith("-"));

  if (rawArgs.length === 1 && rawArgs[0] === "--version") {
    process.stdout.write(`${meta.version}\n`);
    return;
  }
  if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
    let command: CommandDef<any> = rootCommand;
    let parent: CommandDef<any> | undefined;
    if (
      firstPositional &&
      Object.prototype.hasOwnProperty.call(subCommands, firstPositional)
    ) {
      command = await subCommands[
        firstPositional as keyof typeof subCommands
      ]();
      parent = rootCommand;
    }
    process.stdout.write(`${await renderUsage(command, parent)}\n`);
    return;
  }
  await runCommand(rootCommand, { rawArgs });
};
