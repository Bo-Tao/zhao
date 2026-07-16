import { describe, expect, it } from "vitest";

import {
  parseGitRemote,
  remoteToProjectId,
  remoteToWebUrl,
} from "../src/core/giturl.js";

describe("git remote 解析", () => {
  it("解析 GitLab SSH remote", () => {
    expect(
      parseGitRemote("git@git.100tal.com:bigclass_xuefu_fe/tal-npm.git"),
    ).toEqual({
      host: "git.100tal.com",
      path: "bigclass_xuefu_fe/tal-npm",
    });
  });

  it("解析 HTTPS remote 并移除 .git", () => {
    expect(
      remoteToProjectId(
        "https://git.100tal.com/bigclass_xuefu_fe/tal-npm.git",
      ),
    ).toBe("git.100tal.com/bigclass_xuefu_fe/tal-npm");
  });

  it("把 SSH 与 HTTPS remote 统一转换为网页 URL", () => {
    expect(
      remoteToWebUrl("git@git.100tal.com:group/repo.git"),
    ).toBe("https://git.100tal.com/group/repo");
    expect(
      remoteToWebUrl("https://git.100tal.com/group/repo.git"),
    ).toBe("https://git.100tal.com/group/repo");
  });

  it("拒绝无法识别的 remote", () => {
    expect(() => remoteToWebUrl("/tmp/local-repo")).toThrow(
      "无法识别 Git remote",
    );
  });
});
