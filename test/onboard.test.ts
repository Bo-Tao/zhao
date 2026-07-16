import { describe, expect, it } from "vitest";

import { normalizeScanRoots } from "../src/middleware/onboard.js";

describe("onboarding 扫描目录", () => {
  it("写配置前把 ~ 与相对路径规范化为绝对路径", () => {
    expect(
      normalizeScanRoots(
        ["~/work/fe", "projects/mobile", "/opt/shared"],
        "/Users/test/current",
        "/Users/test",
      ),
    ).toEqual([
      "/Users/test/work/fe",
      "/Users/test/current/projects/mobile",
      "/opt/shared",
    ]);
  });
});
