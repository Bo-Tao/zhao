import { describe, expect, it, vi } from "vitest";

import { bridgePromptOutput } from "../src/ui/prompts.js";

describe("Clack 输出桥接", () => {
  it("stdout 非 TTY 时借用 stderr 的终端尺寸并在结束后恢复", () => {
    const stdoutWrite = vi.fn();
    const stderrWrite = vi.fn();
    const stdout = {
      write: stdoutWrite,
    };
    const stderr = {
      write: stderrWrite,
      rows: 42,
      columns: 120,
      isTTY: true,
    };

    const restore = bridgePromptOutput(stdout, stderr);

    expect(stdout.write).not.toBe(stdoutWrite);
    stdout.write("prompt");
    expect(stderrWrite).toHaveBeenCalledWith("prompt");
    expect(stdout).toMatchObject({
      rows: 42,
      columns: 120,
      isTTY: true,
    });

    restore();

    expect(stdout.write).toBe(stdoutWrite);
    expect("rows" in stdout).toBe(false);
    expect("columns" in stdout).toBe(false);
    expect("isTTY" in stdout).toBe(false);
  });

  it("stderr 也没有尺寸时使用安全默认值", () => {
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };

    const restore = bridgePromptOutput(stdout, stderr);

    expect(stdout).toMatchObject({
      rows: 24,
      columns: 80,
    });

    restore();
  });
});
