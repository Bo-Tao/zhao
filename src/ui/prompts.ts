import type { MergedProject, RankedProject } from '../core/types.js'

const DEFAULT_TERMINAL_COLUMNS = 80
// Clack 会把带 ANSI 颜色的引导前缀原始长度计入换行宽度。
const PROJECT_OPTION_PADDING = 18
const PROJECT_OPTION_SEPARATOR = ' · '
const PROJECT_OPTION_HINT_PADDING = 3
const MIN_PROJECT_OPTION_SECTION_WIDTH = 4
const ELLIPSIS = '…'
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})
const WIDE_CHARACTER_PATTERN =
  /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1b000}-\u{1b001}\u{1f200}-\u{1faff}\u{20000}-\u{3fffd}]/u
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const MARK_PATTERN = /^\p{Mark}+$/u

interface PromptOutput {
  write: (...args: any[]) => any
  rows?: number
  columns?: number
  isTTY?: boolean
}

interface ProjectOptionSource {
  name: string
  description: string
  path: string
}

interface FittedText {
  text: string
  width: number
}

const getGraphemeWidth = (value: string): number => {
  if (MARK_PATTERN.test(value)) {
    return 0
  }
  return WIDE_CHARACTER_PATTERN.test(value) || EMOJI_PATTERN.test(value) ? 2 : 1
}

const sliceToWidth = (
  value: string,
  limit: number,
): { text: string; width: number; truncated: boolean } => {
  let end = 0
  let width = 0
  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentWidth = getGraphemeWidth(segment)
    if (width + segmentWidth > limit) {
      return { text: value.slice(0, end), width, truncated: true }
    }
    end += segment.length
    width += segmentWidth
  }
  return { text: value, width, truncated: false }
}

const fitText = (value: string, limit: number): FittedText => {
  const safeLimit = Math.max(0, limit)
  const fitted = sliceToWidth(value, safeLimit)
  if (!fitted.truncated) {
    return fitted
  }

  const truncated = sliceToWidth(value, Math.max(0, safeLimit - 1))
  return {
    text: `${truncated.text}${safeLimit > 0 ? ELLIPSIS : ''}`,
    width: truncated.width + (safeLimit > 0 ? 1 : 0),
  }
}

export const formatProjectOption = (
  project: ProjectOptionSource,
  reason: string,
  columns = DEFAULT_TERMINAL_COLUMNS,
): { label: string; hint?: string } => {
  const availableWidth = Math.max(
    1,
    (Number.isFinite(columns)
      ? Math.floor(columns)
      : DEFAULT_TERMINAL_COLUMNS) - PROJECT_OPTION_PADDING,
  )
  const description = project.description.trim()
  const fullLabel = `${project.name}${
    description ? `${PROJECT_OPTION_SEPARATOR}${description}` : ''
  }`
  const hintLimit = Math.floor(availableWidth / 3)
  if (reason && hintLimit >= MIN_PROJECT_OPTION_SECTION_WIDTH) {
    const hint = fitText(reason, hintLimit)
    const labelLimit = availableWidth - hint.width - PROJECT_OPTION_HINT_PADDING
    if (labelLimit >= MIN_PROJECT_OPTION_SECTION_WIDTH) {
      return {
        label: fitText(fullLabel, labelLimit).text,
        hint: hint.text,
      }
    }
  }

  return { label: fitText(fullLabel, availableWidth).text }
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
    const columns = process.stdout.columns ?? DEFAULT_TERMINAL_COLUMNS
    const id = unwrap(
      await prompts.select({
        message: '选择项目',
        maxItems: 12,
        options: projects.map(({ project, reason }) => ({
          value: project.id,
          ...formatProjectOption(project, reason, columns),
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
