import { resolveStoredProject } from '../core/runtime.js'
import { getStorePaths, loadConfig } from '../core/store.js'
import type { MergedProject, ZhaoConfig } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import type { DefineCommand } from './types.js'

const displayList = (values: string[]): string =>
  values.length > 0 ? values.join('、') : '无'

const fillCiTemplate = (template: string, project: MergedProject): string =>
  template
    .replaceAll('{group}', project.group)
    .replaceAll('{name}', project.name)

export const formatProjectInfo = (
  project: MergedProject,
  config: ZhaoConfig,
): string => {
  const lines = [
    `名称: ${project.name} [自动扫描]`,
    `ID: ${project.id} [自动扫描]`,
    `路径: ${project.path} [自动扫描]`,
    `Remote: ${project.remote} [自动扫描]`,
    `Group: ${project.group || '无'} [自动扫描]`,
    `描述: ${project.description || '无'} [自动扫描]`,
    `技术栈: ${displayList(project.stack)} [自动扫描]`,
    `扫描时间: ${project.scannedAt} [自动扫描]`,
  ]

  for (const alias of project.aliases) {
    lines.push(`别名: ${alias} [手动]`)
  }
  for (const keyword of project.keywords) {
    lines.push(`关键词: ${keyword} [自动扫描]`)
  }
  for (const keyword of project.manualKeywords) {
    lines.push(`关键词: ${keyword} [手动]`)
  }
  for (const domain of project.domains) {
    const source =
      domain.source === 'manual'
        ? '手动'
        : domain.type === 'guess'
          ? `猜测: ${domain.source}`
          : `自动扫描: ${domain.source}`
    lines.push(
      `域名: ${domain.value} [${source}] (${domain.type}, ${domain.confidence})`,
    )
  }
  for (const [name, url] of Object.entries(project.links)) {
    if (url) {
      lines.push(`${name}: ${url} [手动]`)
    }
  }
  for (const environment of ['test', 'prod'] as const) {
    const name = `ci-${environment}`
    const template = config.ciTemplates?.[environment]
    if (!project.links[name] && template) {
      lines.push(`${name}: ${fillCiTemplate(template, project)} [模板]`)
    }
  }
  return `${lines.join('\n')}\n`
}

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'info',
      description: '展示项目的全部合并元数据及来源',
    },
    args: {
      project: {
        type: 'positional',
        description: '项目查询',
        required: true,
      },
    },
    async run({ args }) {
      await ensureOnboarded()
      const [project, config] = await Promise.all([
        resolveStoredProject(args.project),
        loadConfig(getStorePaths()),
      ])
      if (!config) {
        throw new Error('config.yaml 不存在，请先运行 zhao 完成首次配置。')
      }
      process.stdout.write(formatProjectInfo(project, config))
    },
  })
