import { getShellWrapper } from "../shell/templates.js";
import type { DefineCommand } from "./types.js";

export default (defineCommand: DefineCommand) =>
  defineCommand({
  meta: {
    name: "init",
    description: "输出 zsh 或 bash wrapper",
  },
  args: {
    shell: {
      type: "positional",
      description: "shell 类型",
      required: true,
    },
  },
  run({ args }) {
    process.stdout.write(`${getShellWrapper(args.shell)}\n`);
  },
  });
