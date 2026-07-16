import { stat } from "node:fs/promises";
import { basename, dirname, join, parse } from "node:path";

import { readGitRemote } from "./gitconfig.js";
import { rankProjects } from "./rank.js";
import { remoteToProjectId } from "./giturl.js";
import type {
  MergedProject,
  RankedProject,
  ZhaoState,
} from "./types.js";

export interface ResolverOptions {
  projects: MergedProject[];
  state: ZhaoState;
  cwd?: string;
  selectProject: (projects: RankedProject[]) => Promise<MergedProject>;
  recordUse: (projectId: string) => Promise<void>;
}

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

export const findGitRoot = async (
  startPath: string,
): Promise<string | undefined> => {
  let current = startPath;
  const filesystemRoot = parse(startPath).root;
  while (true) {
    if (await pathExists(join(current, ".git"))) {
      return current;
    }
    if (current === filesystemRoot) {
      return undefined;
    }
    current = dirname(current);
  }
};

const currentDirectoryProject = async (
  cwd: string,
  projects: MergedProject[],
): Promise<MergedProject | undefined> => {
  const root = await findGitRoot(cwd);
  if (!root) {
    return undefined;
  }
  const remote = await readGitRemote(root);
  const id = remoteToProjectId(remote);
  const indexed = projects.find((project) => project.id === id);
  if (indexed) {
    return indexed;
  }
  return {
    id,
    name: basename(root),
    path: root,
    remote,
    group: id.split("/").slice(1, -1).join("/"),
    description: "",
    keywords: [],
    manualKeywords: [],
    aliases: [],
    stack: [],
    domains: [],
    links: {},
    scannedAt: new Date(0).toISOString(),
  };
};

export const resolveProject = async (
  rawQuery: string | undefined,
  options: ResolverOptions,
): Promise<MergedProject> => {
  const query = rawQuery?.trim();
  if (query) {
    const ranked = rankProjects(options.projects, query, options.state);
    if (ranked.length === 0) {
      throw new Error(`没有找到“${query}”。请运行 zhao scan 更新索引或换个关键词。`);
    }
    const project =
      ranked.length === 1
        ? ranked[0]!.project
        : await options.selectProject(ranked);
    await options.recordUse(project.id);
    return project;
  }

  const current = await currentDirectoryProject(
    options.cwd ?? process.cwd(),
    options.projects,
  );
  if (current) {
    return current;
  }
  if (options.projects.length === 0) {
    throw new Error("当前不在 Git 项目内，且索引中没有项目。请先运行 zhao scan。");
  }
  const project = await options.selectProject(
    options.projects.map((item) => ({
      project: item,
      score: 0,
      reason: "全部项目",
    })),
  );
  await options.recordUse(project.id);
  return project;
};
