import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export const readGitRemote = async (repositoryRoot: string): Promise<string> => {
  const dotGit = join(repositoryRoot, ".git");
  const dotGitStat = await stat(dotGit);
  let configPath = join(dotGit, "config");

  if (dotGitStat.isFile()) {
    const pointer = await readFile(dotGit, "utf8");
    const gitDir = pointer.match(/^gitdir:\s*(.+)$/im)?.[1]?.trim();
    if (!gitDir) {
      throw new Error(`${dotGit} 不是有效的 gitdir 指针`);
    }
    configPath = join(resolve(repositoryRoot, gitDir), "config");
  }

  const content = await readFile(configPath, "utf8");
  const sections = [
    ...content.matchAll(/\[remote\s+"([^"]+)"\]([\s\S]*?)(?=\n\[|$)/g),
  ];
  const origin =
    sections.find((section) => section[1] === "origin") ?? sections[0];
  const remote = origin?.[2]
    ?.match(/^\s*url\s*=\s*(.+)\s*$/m)?.[1]
    ?.trim();
  if (!remote) {
    throw new Error(`仓库 ${repositoryRoot} 没有可用的 Git remote`);
  }
  return remote;
};
