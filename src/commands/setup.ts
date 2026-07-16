import { ensureOnboarded } from "../middleware/onboard.js";
import { installWrapperInteractively } from "../shell/install.js";
import type { DefineCommand } from "./types.js";

export default (defineCommand: DefineCommand) =>
  defineCommand({
  meta: {
    name: "setup",
    description: "把 zhao wrapper 安装到 shell rc 文件",
  },
  args: {
    shell: {
      type: "string",
      description: "覆盖自动检测的 shell（zsh 或 bash）",
    },
  },
  async run({ args }) {
    await installWrapperInteractively(args.shell);
    await ensureOnboarded({
      checkWrapper: false,
      ensureIndex: true,
      scanAfterConfig: true,
    });
  },
  });
