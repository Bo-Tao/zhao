import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type {
  MergedProject,
  ZhaoConfig,
  ZhaoIndex,
  ZhaoProjectsFile,
  ZhaoState,
} from "./types.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.values(value).every((item) => typeof item === "string");

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isDomainType = (value: unknown): boolean =>
  value === "api" || value === "page" || value === "guess";

const isIndex = (value: unknown): value is ZhaoIndex => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.generatedAt !== "string" ||
    !Array.isArray(value.projects)
  ) {
    return false;
  }
  return value.projects.every(
    (project) =>
      isRecord(project) &&
      isNonEmptyString(project.id) &&
      isNonEmptyString(project.name) &&
      isNonEmptyString(project.path) &&
      isNonEmptyString(project.remote) &&
      typeof project.group === "string" &&
      typeof project.description === "string" &&
      isStringArray(project.keywords) &&
      isStringArray(project.stack) &&
      typeof project.scannedAt === "string" &&
      Array.isArray(project.domains) &&
      project.domains.every(
        (domain) =>
          isRecord(domain) &&
          isNonEmptyString(domain.value) &&
          isDomainType(domain.type) &&
          isNonEmptyString(domain.source) &&
          typeof domain.confidence === "number" &&
          domain.confidence >= 0 &&
          domain.confidence <= 1,
      ),
  );
};

const isConfig = (value: unknown): value is ZhaoConfig =>
  isRecord(value) &&
  isStringArray(value.scanRoots) &&
  value.scanRoots.every(isNonEmptyString) &&
  (value.useFzf === undefined || typeof value.useFzf === "boolean") &&
  (value.scanDepth === undefined ||
    (Number.isInteger(value.scanDepth) &&
      (value.scanDepth as number) >= 1 &&
      (value.scanDepth as number) <= 10)) &&
  (value.ciTemplates === undefined ||
    (isRecord(value.ciTemplates) &&
      (value.ciTemplates.test === undefined ||
        typeof value.ciTemplates.test === "string") &&
      (value.ciTemplates.prod === undefined ||
        typeof value.ciTemplates.prod === "string")));

const isProjectsFile = (value: unknown): value is ZhaoProjectsFile =>
  isRecord(value) &&
  Object.values(value).every(
    (project) =>
      isRecord(project) &&
      (project.aliases === undefined || isStringArray(project.aliases)) &&
      (project.keywords === undefined || isStringArray(project.keywords)) &&
      (project.blockedDomains === undefined ||
        isStringArray(project.blockedDomains)) &&
      (project.links === undefined || isStringRecord(project.links)) &&
      (project.domains === undefined ||
        (Array.isArray(project.domains) &&
          project.domains.every(
            (domain) =>
              isRecord(domain) &&
              isNonEmptyString(domain.value) &&
              isDomainType(domain.type),
          ))),
  );

const isState = (value: unknown): value is ZhaoState =>
  isRecord(value) &&
  value.version === 1 &&
  isRecord(value.entries) &&
  Object.values(value.entries).every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.count === "number" &&
      Number.isInteger(entry.count) &&
      entry.count >= 0 &&
      typeof entry.lastUsedAt === "string",
  );

const validateConfigForWrite = async (
  value: ZhaoConfig,
): Promise<ZhaoConfig> => {
  const { z } = await import("zod");
  return z
    .object({
      scanRoots: z.array(z.string().min(1)),
      ciTemplates: z
        .object({
          test: z.string().optional(),
          prod: z.string().optional(),
        })
        .optional(),
      useFzf: z.boolean().optional(),
      scanDepth: z.number().int().min(1).max(10).optional(),
    })
    .parse(value);
};

const validateIndexForWrite = async (value: ZhaoIndex): Promise<ZhaoIndex> => {
  const { z } = await import("zod");
  const domainType = z.enum(["api", "page", "guess"]);
  return z
    .object({
      version: z.literal(1),
      generatedAt: z.string(),
      projects: z.array(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          path: z.string().min(1),
          remote: z.string().min(1),
          group: z.string(),
          description: z.string(),
          keywords: z.array(z.string()),
          stack: z.array(z.string()),
          domains: z.array(
            z.object({
              value: z.string().min(1),
              type: domainType,
              source: z.string().min(1),
              confidence: z.number().min(0).max(1),
            }),
          ),
          scannedAt: z.string(),
        }),
      ),
    })
    .parse(value);
};

export interface StorePaths {
  directory: string;
  config: string;
  index: string;
  projects: string;
  state: string;
}

export const getStorePaths = (
  directory = process.env.ZHAO_CONFIG_DIR ??
    join(homedir(), ".config", "zhao"),
): StorePaths => ({
  directory,
  config: join(directory, "config.yml"),
  index: join(directory, "index.json"),
  projects: join(directory, "projects.yml"),
  state: join(directory, "state.json"),
});

const readOptional = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

const atomicWrite = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
};

export const loadConfig = async (
  paths = getStorePaths(),
): Promise<ZhaoConfig | undefined> => {
  const content = await readOptional(paths.config);
  if (content === undefined) {
    return undefined;
  }
  try {
    const { parse } = await import("yaml");
    const parsed = parse(content);
    if (!isConfig(parsed)) {
      throw new Error("字段结构不合法");
    }
    return parsed;
  } catch (error) {
    throw new Error(`config.yml 无法解析：${String(error)}`);
  }
};

export const saveConfig = async (
  config: ZhaoConfig,
  paths = getStorePaths(),
): Promise<void> => {
  const value = await validateConfigForWrite(config);
  const { stringify } = await import("yaml");
  await atomicWrite(paths.config, stringify(value));
};

export const loadRuntimePreferences = async (
  paths = getStorePaths(),
): Promise<{ useFzf: boolean } | undefined> => {
  const content = await readOptional(paths.config);
  if (content === undefined) {
    return undefined;
  }
  return {
    useFzf: /^\s*useFzf\s*:\s*true\s*(?:#.*)?$/im.test(content),
  };
};

export interface IndexLoadResult {
  index?: ZhaoIndex;
  issue?: string;
}

export const loadIndex = async (
  paths = getStorePaths(),
): Promise<IndexLoadResult> => {
  const content = await readOptional(paths.index);
  if (content === undefined) {
    return { issue: "索引不存在" };
  }
  try {
    const parsed: unknown = JSON.parse(content);
    return isIndex(parsed)
      ? { index: parsed }
      : { issue: "索引已损坏" };
  } catch {
    return { issue: "索引已损坏" };
  }
};

export const saveIndex = async (
  index: ZhaoIndex,
  paths = getStorePaths(),
): Promise<void> => {
  const value = await validateIndexForWrite(index);
  await atomicWrite(paths.index, `${JSON.stringify(value, null, 2)}\n`);
};

export const loadProjectsFile = async (
  paths = getStorePaths(),
): Promise<ZhaoProjectsFile> => {
  const content = await readOptional(paths.projects);
  if (content === undefined || !content.trim()) {
    return {};
  }
  try {
    const { parse } = await import("yaml");
    const parsed = parse(content);
    if (!isProjectsFile(parsed)) {
      throw new Error("字段结构不合法");
    }
    return parsed;
  } catch (error) {
    throw new Error(`projects.yml 无法解析：${String(error)}`);
  }
};

export const loadState = async (
  paths = getStorePaths(),
): Promise<ZhaoState> => {
  const content = await readOptional(paths.state);
  if (content === undefined) {
    return { version: 1, entries: {} };
  }
  try {
    const parsed: unknown = JSON.parse(content);
    return isState(parsed) ? parsed : { version: 1, entries: {} };
  } catch {
    return { version: 1, entries: {} };
  }
};

export const saveState = async (
  state: ZhaoState,
  paths = getStorePaths(),
): Promise<void> => {
  if (!isState(state)) {
    throw new Error("state.json 数据结构不合法");
  }
  await atomicWrite(paths.state, `${JSON.stringify(state, null, 2)}\n`);
};

const unique = (values: string[]): string[] => [...new Set(values)];

export const mergeProjectData = (
  index: ZhaoIndex,
  projectsFile: ZhaoProjectsFile,
): MergedProject[] =>
  index.projects.map((project) => {
    const manual = projectsFile[project.id] ?? {};
    const blocked = new Set(
      (manual.blockedDomains ?? []).map((domain) => domain.toLowerCase()),
    );
    const manualDomains = (manual.domains ?? []).map((domain) => ({
      ...domain,
      source: "manual",
      confidence: 1,
    }));
    const manualDomainValues = new Set(
      manualDomains.map((domain) => domain.value.toLowerCase()),
    );
    const automaticDomains = project.domains.filter(
      (domain) =>
        !blocked.has(domain.value.toLowerCase()) &&
        !manualDomainValues.has(domain.value.toLowerCase()),
    );

    return {
      ...project,
      aliases: unique(manual.aliases ?? []),
      manualKeywords: unique(manual.keywords ?? []),
      keywords: unique(project.keywords),
      domains: [...manualDomains, ...automaticDomains],
      links: manual.links ?? {},
    };
  });

export const loadMergedProjects = async (
  paths = getStorePaths(),
): Promise<{
  projects: MergedProject[];
  state: ZhaoState;
  indexIssue?: string;
}> => {
  const [{ index, issue }, manual, state] = await Promise.all([
    loadIndex(paths),
    loadProjectsFile(paths),
    loadState(paths),
  ]);
  return {
    projects: index ? mergeProjectData(index, manual) : [],
    state,
    indexIssue: issue,
  };
};
