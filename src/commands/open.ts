import {
  detectInstalledProjectOpeners,
  launchProject,
  resolveProjectOpener,
  type InstalledProjectOpener,
} from '../core/project-opener.js'
import { ArgumentError } from '../core/argument-error.js'
import { resolveStoredProject } from '../core/runtime.js'
import type { MergedProject } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import { promptProjectOpener } from '../ui/prompts.js'
import type { DefineCommand } from './types.js'

export interface OpenCommandInput {
  positionals: string[]
  withTool?: string
}

interface OpenCommandDependencies {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  detectInstalledProjectOpeners: () => Promise<InstalledProjectOpener[]>
  ensureOnboarded: () => Promise<void>
  resolveStoredProject: (query?: string) => Promise<MergedProject>
  promptProjectOpener: (
    openers: readonly InstalledProjectOpener[],
  ) => Promise<InstalledProjectOpener>
  launchProject: (
    opener: InstalledProjectOpener,
    projectPath: string,
  ) => Promise<void>
  writeStatus: (message: string) => void
}

const defaultDependencies: OpenCommandDependencies = {
  platform: process.platform,
  env: process.env,
  detectInstalledProjectOpeners,
  ensureOnboarded,
  resolveStoredProject: (query) =>
    resolveStoredProject(query, { allowUnindexedCurrent: false }),
  promptProjectOpener,
  launchProject,
  writeStatus: (message) => process.stderr.write(message),
}

export const parseOpenPositionals = (
  positionals: string[],
): string | undefined => {
  if (positionals.length > 1) {
    throw new ArgumentError('open 只接受一个项目查询。')
  }
  return positionals[0]
}

export const assertProjectOpenEnvironment = ({
  platform,
  env,
}: {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
}): void => {
  if (platform !== 'darwin') {
    throw new Error('zhao open 目前仅支持 macOS。')
  }
  if (env.SSH_CONNECTION || env.SSH_TTY) {
    throw new Error('当前为 SSH 或无图形环境，无法启动 macOS 应用。')
  }
}

export const runOpenCommand = async (
  input: OpenCommandInput,
  dependencies: OpenCommandDependencies = defaultDependencies,
): Promise<void> => {
  const query = parseOpenPositionals(input.positionals)
  const requested = input.withTool
    ? resolveProjectOpener(input.withTool)
    : undefined

  assertProjectOpenEnvironment(dependencies)
  const installed = await dependencies.detectInstalledProjectOpeners()
  const requestedInstalled = requested
    ? installed.find((opener) => opener.id === requested.id)
    : undefined
  if (requested && !requestedInstalled) {
    throw new Error(`未安装或无法找到 ${requested.name}。`)
  }
  if (installed.length === 0) {
    throw new Error('未检测到可用于打开项目的应用。')
  }

  await dependencies.ensureOnboarded()
  const project = await dependencies.resolveStoredProject(query)
  const opener =
    requestedInstalled ?? (await dependencies.promptProjectOpener(installed))
  await dependencies.launchProject(opener, project.path)
  dependencies.writeStatus(`已使用 ${opener.name} 打开 ${project.name}\n`)
}

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'open',
      description: '使用 macOS 应用打开项目',
    },
    args: {
      query: {
        type: 'positional',
        description: '项目查询',
        required: false,
      },
      with: {
        type: 'string',
        alias: ['w'],
        description: '直接使用指定工具打开',
        required: false,
      },
    },
    async run({ args }) {
      await runOpenCommand({
        positionals: args._ as string[],
        ...(typeof args.with === 'string' ? { withTool: args.with } : {}),
      })
    },
  })
