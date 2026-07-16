import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const openExternalUrl = async (
  url: string,
  platform = process.platform,
): Promise<void> => {
  if (platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }
  if (platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
    return;
  }
  await execFileAsync("xdg-open", [url]);
};

const pipeToCommand = async (
  command: string,
  args: string[],
  content: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} 退出码 ${code ?? "unknown"}`));
      }
    });
    child.stdin.end(content);
  });

export const copyToClipboard = async (
  content: string,
  platform = process.platform,
): Promise<void> => {
  if (platform === "darwin") {
    await pipeToCommand("pbcopy", [], content);
    return;
  }
  if (platform === "win32") {
    await pipeToCommand("clip", [], content);
    return;
  }
  try {
    await pipeToCommand("wl-copy", [], content);
  } catch {
    await pipeToCommand("xclip", ["-selection", "clipboard"], content);
  }
};
