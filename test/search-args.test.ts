import { describe, expect, it } from "vitest";

import { classifyInvocation } from "../src/core/dispatch.js";
import { parseSearchArgs } from "../src/core/search-args.js";

describe("检索热路径参数", () => {
  it("支持 query 与 shell wrapper flags 的任意顺序", () => {
    expect(parseSearchArgs(["--print", "报告", "--claude"])).toEqual({
      query: "报告",
      print: true,
      claude: true,
      tmux: false,
    });
  });

  it("无 query 时保留全量选择语义", () => {
    expect(parseSearchArgs(["--tmux"])).toEqual({
      query: undefined,
      print: false,
      claude: false,
      tmux: true,
    });
  });

  it("拒绝未知 flag 和多个 query", () => {
    expect(() => parseSearchArgs(["--unknown"])).toThrow("未知参数");
    expect(() => parseSearchArgs(["one", "two"])).toThrow(
      "只接受一个 query",
    );
  });
});

describe("入口分发", () => {
  it("不会把尚未实现的保留命令误当作项目 query", () => {
    expect(classifyInvocation(["tag", "repo"])).toBe("future-command");
    expect(classifyInvocation(["ci", "test"])).toBe("future-command");
    expect(classifyInvocation(["report"])).toBe("search");
  });
});
