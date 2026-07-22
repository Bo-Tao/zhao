import { copyToClipboard, openExternalUrl } from '../core/actions.js'
import { resolveStoredProject } from '../core/runtime.js'
import { getStorePaths, loadConfig } from '../core/store.js'
import type { MergedProject, ZhaoConfig } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import { shouldUseGraphicalOpen } from './browse.js'
import type { DefineCommand } from './types.js'

export type CiEnvironment = 'test' | 'prod'

export interface CiPositionals {
  environment: CiEnvironment
  query?: string
}

export const parseCiPositionals = (positionals: string[]): CiPositionals => {
  const first = positionals[0]
  const hasEnvironment = first === 'test' || first === 'prod'
  const query = hasEnvironment ? positionals[1] : first
  const maximum = hasEnvironment ? 2 : 1
  if (positionals.length > maximum) {
    throw new Error('ci 最多接受环境和一个 query。')
  }
  return {
    environment: hasEnvironment ? first : 'test',
    ...(query ? { query } : {}),
  }
}

export const resolveCiUrl = (
  project: MergedProject,
  environment: CiEnvironment,
  templates: ZhaoConfig['ciTemplates'],
): string => {
  const link = project.links[`ci-${environment}`]
  if (link) {
    return link
  }
  const template = templates?.[environment]
  if (template) {
    return template
      .replaceAll('{group}', project.group)
      .replaceAll('{name}', project.name)
  }
  throw new Error(
    `项目 ${project.name} 没有 ${environment} 环境的 CI 链接。请在 projects.yaml 配置 links.ci-${environment}，或在 config.yaml 配置 ciTemplates.${environment}。`,
  )
}

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'ci',
      description: '打开项目构建平台页面',
    },
    args: {
      environmentOrQuery: {
        type: 'positional',
        description: 'test、prod 或项目查询',
        required: false,
      },
      query: {
        type: 'positional',
        description: '指定环境后的项目查询',
        required: false,
      },
      copy: {
        type: 'boolean',
        description: '复制 URL 到剪贴板',
        default: false,
      },
      print: {
        type: 'boolean',
        description: '只打印 URL',
        default: false,
      },
    },
    async run({ args }) {
      const { environment, query } = parseCiPositionals(args._ as string[])
      await ensureOnboarded()
      const [project, config] = await Promise.all([
        resolveStoredProject(query),
        loadConfig(getStorePaths()),
      ])
      if (!config) {
        throw new Error('config.yaml 不存在，请先运行 zhao 完成首次配置。')
      }
      const url = resolveCiUrl(project, environment, config.ciTemplates)

      if (args.copy) {
        await copyToClipboard(url)
        process.stderr.write(`已复制：${url}\n`)
      }
      if (
        args.print ||
        !shouldUseGraphicalOpen({
          platform: process.platform,
          env: process.env,
        })
      ) {
        process.stdout.write(`${url}\n`)
        return
      }
      await openExternalUrl(url)
    },
  })
