import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  getStorePaths,
  loadConfig,
  loadIndex,
  type StorePaths,
} from '../core/store.js'
import type { DefineCommand } from './types.js'

export type DoctorStatus = 'pass' | 'warning' | 'fail'

export interface DoctorCheck {
  name: string
  status: DoctorStatus
  detail: string
}

export interface DoctorOptions {
  paths?: StorePaths
  env?: NodeJS.ProcessEnv
  nodeVersion?: string
  now?: Date
  maxIndexAgeDays?: number
}

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export const runDoctorChecks = async (
  options: DoctorOptions = {},
): Promise<DoctorCheck[]> => {
  const paths = options.paths ?? getStorePaths()
  const env = options.env ?? process.env
  const nodeVersion = options.nodeVersion ?? process.versions.node
  const now = options.now ?? new Date()
  const maxIndexAgeDays = options.maxIndexAgeDays ?? 7
  const checks: DoctorCheck[] = []

  checks.push({
    name: 'shell wrapper',
    status: env.ZHAO_SHELL_WRAPPED === '1' ? 'pass' : 'fail',
    detail:
      env.ZHAO_SHELL_WRAPPED === '1'
        ? '已生效'
        : '未生效，请运行 zhao setup 后重新加载 shell 配置',
  })

  let config
  try {
    config = await loadConfig(paths)
    checks.push({
      name: 'config.yml',
      status: config ? 'pass' : 'fail',
      detail: config ? paths.config : `不存在：${paths.config}`,
    })
  } catch (error) {
    checks.push({
      name: 'config.yml',
      status: 'fail',
      detail: error instanceof Error ? error.message : String(error),
    })
  }

  const loadedIndex = await loadIndex(paths)
  checks.push({
    name: 'index.json',
    status: loadedIndex.index ? 'pass' : 'fail',
    detail: loadedIndex.index ? paths.index : (loadedIndex.issue ?? '不可用'),
  })
  if (loadedIndex.index) {
    const generatedAt = new Date(loadedIndex.index.generatedAt)
    if (Number.isNaN(generatedAt.getTime())) {
      checks.push({
        name: '索引新鲜度',
        status: 'fail',
        detail: `generatedAt 无效：${loadedIndex.index.generatedAt}`,
      })
    } else {
      const ageDays = Math.max(
        0,
        Math.floor((now.getTime() - generatedAt.getTime()) / 86_400_000),
      )
      checks.push({
        name: '索引新鲜度',
        status: ageDays > maxIndexAgeDays ? 'warning' : 'pass',
        detail:
          ageDays > maxIndexAgeDays
            ? `已 ${ageDays} 天未更新，建议运行 zhao scan`
            : `${ageDays} 天前更新`,
      })
    }
  }

  if (config) {
    for (const root of config.scanRoots) {
      const expanded =
        root === '~'
          ? (env.HOME ?? homedir())
          : root.startsWith('~/')
            ? join(env.HOME ?? homedir(), root.slice(2))
            : root
      const present = await exists(expanded)
      checks.push({
        name: root,
        status: present ? 'pass' : 'fail',
        detail: present ? '扫描目录存在' : '扫描目录不存在',
      })
    }
  }

  const major = Number.parseInt(nodeVersion.split('.')[0] ?? '', 10)
  checks.push({
    name: 'Node.js',
    status: major >= 18 ? 'pass' : 'fail',
    detail:
      major >= 18
        ? `v${nodeVersion}`
        : `v${nodeVersion}，需要 Node.js 18 或更高版本`,
  })
  return checks
}

export const formatDoctorChecks = (checks: DoctorCheck[]): string => {
  const symbols: Record<DoctorStatus, string> = {
    pass: '✓',
    warning: '!',
    fail: '✗',
  }
  return `${checks
    .map((check) => `${symbols[check.status]} ${check.name}: ${check.detail}`)
    .join('\n')}\n`
}

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'doctor',
      description: '检查 zhao 本地环境与数据状态',
    },
    async run() {
      const checks = await runDoctorChecks()
      process.stdout.write(formatDoctorChecks(checks))
      if (checks.some((check) => check.status === 'fail')) {
        process.exitCode = 1
      }
    },
  })
