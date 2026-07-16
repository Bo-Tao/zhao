import { classifyInvocation } from "./core/dispatch.js";
import { resolveStoredProject } from "./core/runtime.js";
import { parseSearchArgs } from "./core/search-args.js";
import { ensureOnboarded } from "./middleware/onboard.js";

const rawArgs = process.argv.slice(2);
const invocation = classifyInvocation(rawArgs);

try {
  if (invocation === "management") {
    const { runCittyCli } = await import("./cli.js");
    await runCittyCli(rawArgs);
  } else if (invocation === "future-command") {
    throw new Error(
      `${rawArgs.find((argument) => !argument.startsWith("-"))} 尚未在 MVP 中实现。`,
    );
  } else {
    const args = parseSearchArgs(rawArgs);
    await ensureOnboarded();
    const project = await resolveStoredProject(args.query);
    process.stdout.write(`${project.path}\n`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`错误：${message}\n`);
  process.exitCode = 1;
}
