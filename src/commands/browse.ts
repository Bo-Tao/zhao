import { copyToClipboard, openExternalUrl } from "../core/actions.js";
import { remoteToWebUrl } from "../core/giturl.js";
import { resolveStoredProject } from "../core/runtime.js";
import { ensureOnboarded } from "../middleware/onboard.js";
import type { DefineCommand } from "./types.js";

export const parseBrowsePositionals = (
  positionals: string[],
): string | undefined => {
  if (positionals.length > 1) {
    throw new Error("browse 只接受一个 query，不会把参数透传给 git。");
  }
  return positionals[0];
};

export const shouldUseGraphicalOpen = ({
  platform,
  env,
}: {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
}): boolean => {
  if (env.SSH_CONNECTION || env.SSH_TTY) {
    return false;
  }
  if (platform === "linux" && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    return false;
  }
  return true;
};

export default (defineCommand: DefineCommand) =>
  defineCommand({
  meta: {
    name: "browse",
    description: "打开项目 GitLab 页面",
  },
  args: {
    query: {
      type: "positional",
      description: "项目查询",
      required: false,
    },
    copy: {
      type: "boolean",
      description: "复制 URL 到剪贴板",
      default: false,
    },
    print: {
      type: "boolean",
      description: "只打印 URL",
      default: false,
    },
  },
  async run({ args }) {
    const query = parseBrowsePositionals(args._ as string[]);
    await ensureOnboarded();
    const project = await resolveStoredProject(query);
    const url = remoteToWebUrl(project.remote);

    if (args.copy) {
      await copyToClipboard(url);
      process.stderr.write(`已复制：${url}\n`);
    }
    if (
      args.print ||
      !shouldUseGraphicalOpen({ platform: process.platform, env: process.env })
    ) {
      process.stdout.write(`${url}\n`);
      return;
    }
    await openExternalUrl(url);
  },
  });
