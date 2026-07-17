import type { MergedProject, RankedProject } from '../core/types.js'

interface PromptOutput {
  write: (...args: any[]) => any
  rows?: number
  columns?: number
  isTTY?: boolean
}

const replaceProperty = (
  target: PromptOutput,
  key: keyof PromptOutput,
  value: unknown,
): (() => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  })
  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor)
    } else {
      delete target[key]
    }
  }
}

export const bridgePromptOutput = (
  stdout: PromptOutput,
  stderr: PromptOutput,
): (() => void) => {
  const restorers = [
    replaceProperty(stdout, 'write', stderr.write.bind(stderr)),
  ]

  if (!Number.isFinite(stdout.rows) || (stdout.rows ?? 0) <= 0) {
    restorers.push(
      replaceProperty(
        stdout,
        'rows',
        Number.isFinite(stderr.rows) && (stderr.rows ?? 0) > 0
          ? stderr.rows
          : 24,
      ),
    )
  }
  if (!Number.isFinite(stdout.columns) || (stdout.columns ?? 0) <= 0) {
    restorers.push(
      replaceProperty(
        stdout,
        'columns',
        Number.isFinite(stderr.columns) && (stderr.columns ?? 0) > 0
          ? stderr.columns
          : 80,
      ),
    )
  }
  if (stdout.isTTY === undefined && stderr.isTTY !== undefined) {
    restorers.push(replaceProperty(stdout, 'isTTY', stderr.isTTY))
  }

  return () => {
    for (const restore of restorers.reverse()) {
      restore()
    }
  }
}

const withOutputOnStderr = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  const restore = bridgePromptOutput(process.stdout, process.stderr)
  try {
    return await operation()
  } finally {
    restore()
  }
}

interface CancelApi {
  isCancel: (value: unknown) => value is symbol
  cancel: (message?: string) => void
}

const unwrap = <T>(
  value: T | symbol,
  prompts: CancelApi,
  message = '操作已取消',
): T => {
  if (prompts.isCancel(value)) {
    prompts.cancel(message)
    throw new Error(message)
  }
  return value
}

export const promptConfirm = async (
  message: string,
  initialValue = true,
): Promise<boolean> =>
  withOutputOnStderr(async () => {
    const prompts = await import('@clack/prompts')
    return unwrap(
      await prompts.confirm({
        message,
        initialValue,
      }),
      prompts,
    )
  })

export const promptText = async (
  message: string,
  placeholder?: string,
): Promise<string> =>
  withOutputOnStderr(async () => {
    const prompts = await import('@clack/prompts')
    return unwrap(
      await prompts.text({
        message,
        placeholder,
        validate(value) {
          return value.trim() ? undefined : '请输入至少一个目录'
        },
      }),
      prompts,
    )
  })

export const promptProject = async (
  projects: RankedProject[],
): Promise<MergedProject> =>
  withOutputOnStderr(async () => {
    const prompts = await import('@clack/prompts')
    const id = unwrap(
      await prompts.select({
        message: '选择项目',
        maxItems: 12,
        options: projects.map(({ project, reason }) => ({
          value: project.id,
          label: `${project.name}${project.description ? ` · ${project.description}` : ''}`,
          hint: `${reason} · ${project.path}`,
        })),
      }),
      prompts,
    )
    return projects.find((item) => item.project.id === id)!.project
  })

export const showNote = async (
  message: string,
  title?: string,
): Promise<void> =>
  withOutputOnStderr(async () => {
    const { note } = await import('@clack/prompts')
    note(message, title)
  })

export const createSpinner = async (): Promise<{
  start: (message?: string) => void
  message: (message?: string) => void
  stop: (message?: string, code?: number) => void
}> => {
  const { spinner } = await import('@clack/prompts')
  const instance = spinner()
  const invoke = <T extends unknown[]>(
    callback: (...args: T) => void,
    ...args: T
  ): void => {
    const restore = bridgePromptOutput(process.stdout, process.stderr)
    try {
      callback(...args)
    } finally {
      restore()
    }
  }
  return {
    start: (message) => invoke(instance.start, message),
    message: (message) => invoke(instance.message, message),
    stop: (message, code) => invoke(instance.stop, message, code),
  }
}
