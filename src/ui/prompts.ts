import type { MergedProject, RankedProject } from "../core/types.js";

const withOutputOnStderr = async <T>(operation: () => Promise<T>): Promise<T> => {
  const stdoutWrite = process.stdout.write;
  process.stdout.write = process.stderr.write.bind(
    process.stderr,
  ) as typeof process.stdout.write;
  try {
    return await operation();
  } finally {
    process.stdout.write = stdoutWrite;
  }
};

interface CancelApi {
  isCancel: (value: unknown) => value is symbol;
  cancel: (message?: string) => void;
}

const unwrap = <T>(
  value: T | symbol,
  prompts: CancelApi,
  message = "操作已取消",
): T => {
  if (prompts.isCancel(value)) {
    prompts.cancel(message);
    throw new Error(message);
  }
  return value;
};

export const promptConfirm = async (
  message: string,
  initialValue = true,
): Promise<boolean> =>
  withOutputOnStderr(async () => {
    const prompts = await import("@clack/prompts");
    return unwrap(
      await prompts.confirm({
        message,
        initialValue,
      }),
      prompts,
    );
  });

export const promptText = async (
  message: string,
  placeholder?: string,
): Promise<string> =>
  withOutputOnStderr(async () => {
    const prompts = await import("@clack/prompts");
    return unwrap(
      await prompts.text({
        message,
        placeholder,
        validate(value) {
          return value.trim() ? undefined : "请输入至少一个目录";
        },
      }),
      prompts,
    );
  });

export const promptProject = async (
  projects: RankedProject[],
): Promise<MergedProject> =>
  withOutputOnStderr(async () => {
    const prompts = await import("@clack/prompts");
    const id = unwrap(
      await prompts.select({
        message: "选择项目",
        maxItems: 12,
        options: projects.map(({ project, reason }) => ({
          value: project.id,
          label: `${project.name}${project.description ? ` · ${project.description}` : ""}`,
          hint: `${reason} · ${project.path}`,
        })),
      }),
      prompts,
    );
    return projects.find((item) => item.project.id === id)!.project;
  });

export const showNote = async (
  message: string,
  title?: string,
): Promise<void> =>
  withOutputOnStderr(async () => {
    const { note } = await import("@clack/prompts");
    note(message, title);
  });

export const createSpinner = async (): Promise<{
  start: (message?: string) => void;
  message: (message?: string) => void;
  stop: (message?: string, code?: number) => void;
}> => {
  const { spinner } = await import("@clack/prompts");
  const instance = spinner();
  const invoke = <T extends unknown[]>(
    callback: (...args: T) => void,
    ...args: T
  ): void => {
    const stdoutWrite = process.stdout.write;
    process.stdout.write = process.stderr.write.bind(
      process.stderr,
    ) as typeof process.stdout.write;
    try {
      callback(...args);
    } finally {
      process.stdout.write = stdoutWrite;
    }
  };
  return {
    start: (message) => invoke(instance.start, message),
    message: (message) => invoke(instance.message, message),
    stop: (message, code) => invoke(instance.stop, message, code),
  };
};
