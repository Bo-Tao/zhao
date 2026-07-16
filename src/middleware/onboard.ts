import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import {
  getStorePaths,
  loadConfig,
  loadProjectsFile,
  saveConfig,
  saveIndex,
} from "../core/store.js";
import type { ZhaoConfig } from "../core/types.js";
import { installWrapperInteractively } from "../shell/install.js";
import {
  createSpinner,
  promptConfirm,
  promptText,
} from "../ui/prompts.js";

export interface OnboardingOptions {
  ensureIndex?: boolean;
  checkWrapper?: boolean;
  scanAfterConfig?: boolean;
}

const isInteractive = (): boolean =>
  process.stdin.isTTY === true && process.stderr.isTTY === true;

const parseRoots = (value: string): string[] =>
  [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];

export const normalizeScanRoots = (
  roots: string[],
  cwd = process.cwd(),
  home = homedir(),
): string[] =>
  roots.map((root) => {
    if (root === "~") {
      return home;
    }
    if (root.startsWith("~/")) {
      return join(home, root.slice(2));
    }
    return isAbsolute(root) ? root : resolve(cwd, root);
  });

const validateRoots = async (roots: string[]): Promise<void> => {
  const invalid: string[] = [];
  for (const root of roots) {
    try {
      await stat(root.replace(/^~(?=\/|$)/, process.env.HOME ?? "~"));
    } catch {
      invalid.push(root);
    }
  }
  if (invalid.length > 0) {
    throw new Error(`扫描目录不存在：${invalid.join("、")}`);
  }
};

export const scanAndSave = async (): Promise<number> => {
  const { scanRepositories } = await import("../core/scanner.js");
  const paths = getStorePaths();
  const [config, projectsFile] = await Promise.all([
    loadConfig(paths),
    loadProjectsFile(paths),
  ]);
  if (!config) {
    throw new Error("config.yml 不存在，请先完成首次配置。");
  }
  const progress = await createSpinner();
  progress.start("正在发现 Git 仓库");
  try {
    const index = await scanRepositories(config, projectsFile, (item) => {
      progress.message(
        `扫描 ${item.current}/${item.total || "?"}：${item.path}`,
      );
    });
    await saveIndex(index, paths);
    progress.stop(`已索引 ${index.projects.length} 个项目`);
    return index.projects.length;
  } catch (error) {
    progress.stop("扫描失败", 1);
    throw error;
  }
};

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const ensureConfig = async (scanAfterConfig: boolean): Promise<void> => {
  const paths = getStorePaths();
  if (await pathExists(paths.config)) {
    return;
  }
  if (!isInteractive()) {
    throw new Error(
      `未找到 ${paths.config}。请在交互式终端运行 zhao 完成首次配置。`,
    );
  }
  const roots = normalizeScanRoots(
    parseRoots(
      await promptText(
        "输入项目扫描根目录，多个目录用逗号分隔",
        "~/work/fe, ~/work/mobile",
      ),
    ),
  );
  await validateRoots(roots);
  const config: ZhaoConfig = {
    scanRoots: roots,
    useFzf: false,
  };
  await saveConfig(config, paths);
  process.stderr.write(`已写入 ${paths.config}\n`);
  if (scanAfterConfig) {
    await scanAndSave();
  }
};

export const ensureOnboarded = async (
  options: OnboardingOptions = {},
): Promise<void> => {
  const {
    ensureIndex = true,
    checkWrapper = true,
    scanAfterConfig = true,
  } = options;

  if (
    checkWrapper &&
    process.env.ZHAO_SHELL_WRAPPED !== "1" &&
    isInteractive()
  ) {
    const shouldSetup = await promptConfirm(
      "zhao shell wrapper 尚未生效，现在运行 setup 吗？",
      true,
    );
    if (shouldSetup) {
      await installWrapperInteractively();
      process.stderr.write("请重新打开终端或 source 对应 rc 文件使 wrapper 生效。\n");
    }
  }

  await ensureConfig(scanAfterConfig);
  if (!ensureIndex) {
    return;
  }

  const paths = getStorePaths();
  if (await pathExists(paths.index)) {
    return;
  }
  if (!isInteractive()) {
    throw new Error("索引不存在，请运行 zhao scan 重建。");
  }
  const shouldScan = await promptConfirm(
    "索引不存在，现在重建吗？",
    true,
  );
  if (!shouldScan) {
    throw new Error("需要可用索引才能继续。");
  }
  await scanAndSave();
};
