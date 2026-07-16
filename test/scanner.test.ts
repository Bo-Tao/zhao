import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  extractDomainCandidates,
  inferStack,
  scanRepositories,
} from "../src/core/scanner.js";

describe("扫描元数据", () => {
  it("从配置文本提取 API 域名并生成低置信度页面猜测", () => {
    const domains = extractDomainCandidates(
      'const baseURL = "https://api.report.100tal.com/v1";',
      "src/api/request.ts",
      [],
    );

    expect(domains).toContainEqual({
      value: "api.report.100tal.com",
      type: "api",
      source: "src/api/request.ts",
      confidence: 0.9,
    });
    expect(domains).toContainEqual({
      value: "report.100tal.com",
      type: "guess",
      source: "src/api/request.ts",
      confidence: 0.3,
    });
  });

  it("过滤噪音域名和项目 blockedDomains", () => {
    const domains = extractDomainCandidates(
      [
        "https://registry.npmjs.org/pkg",
        "https://cdn.100tal.com/a.js",
        "https://api.valid.100tal.com/v1",
      ].join("\n"),
      ".env.production",
      ["api.valid.100tal.com"],
    );

    expect(domains).toEqual([]);
  });

  it("根据依赖推断技术栈", () => {
    expect(
      inferStack({
        dependencies: {
          vue: "^3.5.0",
          pinia: "^3.0.0",
        },
        devDependencies: {
          vite: "^7.0.0",
          typescript: "^5.8.0",
        },
      }),
    ).toEqual(["vue3", "vite", "typescript", "pinia"]);
  });

  it("从扫描根目录发现真实 .git 目录并写入项目元数据", async ({
    task,
  }) => {
    const root = join(tmpdir(), `zhao-scan-${task.id}-${Date.now()}`);
    const repository = join(root, "report-web");
    await mkdir(join(repository, ".git"), { recursive: true });
    await mkdir(join(repository, "src", "api"), { recursive: true });
    await writeFile(
      join(repository, ".git", "config"),
      '[remote "origin"]\n  url = git@git.100tal.com:group/report-web.git\n',
    );
    await writeFile(
      join(repository, "package.json"),
      JSON.stringify({
        name: "report-web",
        description: "报告\n页面",
        dependencies: { vue: "^3.5.0" },
        devDependencies: { vite: "^7.0.0" },
      }),
    );
    await writeFile(
      join(repository, "src", "api", "request.ts"),
      'export const baseURL = "https://api.report.100tal.com/v1";',
    );

    const index = await scanRepositories(
      { scanRoots: [root] },
      {},
      undefined,
      new Date("2026-07-16T00:00:00.000Z"),
    );

    expect(index.projects).toHaveLength(1);
    expect(index.projects[0]).toMatchObject({
      id: "git.100tal.com/group/report-web",
      name: "report-web",
      path: repository,
      group: "group",
      description: "报告 页面",
      stack: ["vue3", "vite"],
    });
    expect(index.projects[0]?.domains).toContainEqual({
      value: "api.report.100tal.com",
      type: "api",
      source: "src/api/request.ts",
      confidence: 0.9,
    });
  });
});
