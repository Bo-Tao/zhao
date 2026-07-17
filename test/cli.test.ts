import { afterEach, describe, expect, it, vi } from "vitest";

import { runCittyCli } from "../src/cli.js";

const captureStdout = async (rawArgs: string[]): Promise<string> => {
  let output = "";
  vi.spyOn(process.stdout, "write").mockImplementation(
    ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write,
  );
  await runCittyCli(rawArgs);
  return output;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI 元信息输出", () => {
  it("-v 输出版本号", async () => {
    await expect(captureStdout(["-v"])).resolves.toBe("0.1.0\n");
  });

  it("帮助表格的条目与说明分别左对齐", async () => {
    const output = await captureStdout(["-h"]);
    const detailLines = output
      .split("\n")
      .filter((line) => line.trimStart().startsWith("`"));

    expect(output).toContain("\nARGUMENTS\n");
    expect(output).toContain("\nOPTIONS\n");
    expect(output).toContain("\nCOMMANDS\n");
    expect(detailLines).toHaveLength(9);
    expect(detailLines.every((line) => line.startsWith("`"))).toBe(true);
    expect(
      new Set(detailLines.map((line) => line.search(/[\u3400-\u9fff]/))).size,
    ).toBe(1);
  });
});
