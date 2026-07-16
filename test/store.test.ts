import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getStorePaths,
  loadIndex,
  mergeProjectData,
} from "../src/core/store.js";
import type { ZhaoIndex, ZhaoProjectsFile } from "../src/core/types.js";

describe("四层数据合并", () => {
  it("手动元数据覆盖自动数据并阻止拉黑域名复活", () => {
    const index: ZhaoIndex = {
      version: 1,
      generatedAt: "2026-07-16T00:00:00.000Z",
      projects: [
        {
          id: "git.100tal.com/group/repo",
          name: "auto-name",
          path: "/work/repo",
          remote: "git@git.100tal.com:group/repo.git",
          group: "group",
          description: "自动描述",
          keywords: ["vite"],
          stack: ["vite"],
          domains: [
            {
              value: "api.repo.100tal.com",
              type: "api",
              source: "src/api/request.ts",
              confidence: 0.9,
            },
            {
              value: "cdn.100tal.com",
              type: "api",
              source: ".env",
              confidence: 0.9,
            },
          ],
          scannedAt: "2026-07-16T00:00:00.000Z",
        },
      ],
    };
    const projects: ZhaoProjectsFile = {
      "git.100tal.com/group/repo": {
        aliases: ["业务仓"],
        keywords: ["报告"],
        domains: [
          {
            value: "repo.100tal.com",
            type: "page",
          },
        ],
        links: {
          docs: "https://docs.example.com/repo",
        },
        blockedDomains: ["cdn.100tal.com"],
      },
    };

    const [merged] = mergeProjectData(index, projects);

    expect(merged?.aliases).toEqual(["业务仓"]);
    expect(merged?.manualKeywords).toEqual(["报告"]);
    expect(merged?.domains.map((domain) => domain.value)).toEqual([
      "repo.100tal.com",
      "api.repo.100tal.com",
    ]);
    expect(merged?.domains[0]?.confidence).toBe(1);
    expect(merged?.links.docs).toBe("https://docs.example.com/repo");
  });

  it("把字段为空的 index.json 视为损坏索引", async ({ task }) => {
    const directory = join(tmpdir(), `zhao-index-${task.id}-${Date.now()}`);
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "index.json"),
      JSON.stringify({
        version: 1,
        generatedAt: "2026-07-16T00:00:00.000Z",
        projects: [
          {
            id: "",
            name: "repo",
            path: "",
            remote: "",
            group: "",
            description: "",
            keywords: [],
            stack: [],
            domains: [],
            scannedAt: "2026-07-16T00:00:00.000Z",
          },
        ],
      }),
    );

    await expect(loadIndex(getStorePaths(directory))).resolves.toEqual({
      issue: "索引已损坏",
    });
  });
});
