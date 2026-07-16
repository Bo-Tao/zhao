import { describe, expect, it } from "vitest";

import {
  parseBrowsePositionals,
  shouldUseGraphicalOpen,
} from "../src/commands/browse.js";
import { formatProjectList } from "../src/commands/list.js";
import type { MergedProject } from "../src/core/types.js";

const project: MergedProject = {
  id: "git.100tal.com/group/repo",
  name: "repo",
  path: "/work/repo",
  remote: "git@git.100tal.com:group/repo.git",
  group: "group",
  description: "报告 H5",
  keywords: ["report"],
  manualKeywords: ["报告"],
  aliases: ["业务仓"],
  stack: ["vue3", "vite"],
  domains: [],
  links: {},
  scannedAt: "2026-07-16T00:00:00.000Z",
};

describe("browse 命令", () => {
  it("接受零个或一个 query，拒绝多余位置参数", () => {
    expect(parseBrowsePositionals([])).toBeUndefined();
    expect(parseBrowsePositionals(["repo"])).toBe("repo");
    expect(() => parseBrowsePositionals(["repo", "status"])).toThrow(
      "browse 只接受一个 query",
    );
  });

  it("SSH 或无图形环境时自动降级为打印", () => {
    expect(
      shouldUseGraphicalOpen({
        platform: "darwin",
        env: { SSH_CONNECTION: "example" },
      }),
    ).toBe(false);
    expect(
      shouldUseGraphicalOpen({
        platform: "linux",
        env: {},
      }),
    ).toBe(false);
    expect(
      shouldUseGraphicalOpen({
        platform: "darwin",
        env: {},
      }),
    ).toBe(true);
  });
});

describe("list 命令", () => {
  it("--json 输出合并后的完整项目数据", () => {
    const output = formatProjectList([project], true);
    expect(JSON.parse(output)).toEqual([project]);
  });

  it("文本列表包含名称、路径和描述", () => {
    expect(formatProjectList([project], false)).toContain(
      "repo\t/work/repo\t报告 H5",
    );
  });
});
