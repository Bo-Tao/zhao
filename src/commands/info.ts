import { resolveStoredProject } from '../core/runtime.js'
import { getStorePaths, loadConfig } from '../core/store.js'
import type { MergedProject, ZhaoConfig } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import {
  DEFAULT_TERMINAL_COLUMNS,
  normalizeTableCell,
  renderTable,
} from '../ui/table.js'
import type { DefineCommand } from './types.js'

const displayList = (values: string[]): string =>
  values.length > 0 ? values.join('、') : '无'

const fillCiTemplate = (template: string, project: MergedProject): string =>
  template
    .replaceAll('{group}', project.group)
    .replaceAll('{name}', project.name)

interface InfoRow {
  label: string
  value: string
  source: string
}

interface DomainInfoRow {
  confidence: string
  source: string
  type: string
  value: string
}

const renderInfoTable = (
  title: string,
  rows: InfoRow[],
  terminalColumns: number,
  headers = { label: '字段', value: '值', source: '来源' },
): string =>
  `${title}\n${renderTable(
    [
      {
        header: headers.label,
        values: rows.map(({ label }) => normalizeTableCell(label)),
      },
      {
        header: headers.value,
        values: rows.map(({ value }) => normalizeTableCell(value)),
      },
      {
        header: headers.source,
        values: rows.map(({ source }) => normalizeTableCell(source)),
      },
    ],
    terminalColumns,
    { overflow: 'wrap' },
  )}`

const renderDomainTable = (
  rows: DomainInfoRow[],
  terminalColumns: number,
): string =>
  `域名\n${renderTable(
    [
      {
        header: '域名',
        values: rows.map(({ value }) => normalizeTableCell(value)),
      },
      {
        header: '类型',
        values: rows.map(({ type }) => normalizeTableCell(type)),
      },
      {
        header: '置信度',
        values: rows.map(({ confidence }) => normalizeTableCell(confidence)),
      },
      {
        header: '来源',
        values: rows.map(({ source }) => normalizeTableCell(source)),
      },
    ],
    terminalColumns,
    { overflow: 'wrap' },
  )}`

export const formatProjectInfo = (
  project: MergedProject,
  config: ZhaoConfig,
  terminalColumns = DEFAULT_TERMINAL_COLUMNS,
): string => {
  const overviewRows: InfoRow[] = [
    {
      label: '名称',
      value: project.name,
      source: project.targetKey ? '手动' : '自动扫描',
    },
    { label: 'ID', value: project.id, source: '自动扫描' },
    ...(project.repositoryId && project.repositoryName
      ? [
          {
            label: '所属仓库',
            value: `${project.repositoryName} (${project.repositoryId})`,
            source: '自动扫描',
          },
        ]
      : []),
    ...(project.targetKey
      ? [{ label: 'Target', value: project.targetKey, source: '手动' }]
      : []),
    ...(project.relativePath
      ? [{ label: '相对路径', value: project.relativePath, source: '手动' }]
      : []),
    { label: '路径', value: project.path, source: '自动扫描' },
    { label: 'Remote', value: project.remote, source: '自动扫描' },
    { label: 'Group', value: project.group || '无', source: '自动扫描' },
    {
      label: '描述',
      value: project.description || '无',
      source: '自动扫描',
    },
    {
      label: '技术栈',
      value: displayList(project.stack),
      source: '自动扫描',
    },
    { label: '扫描时间', value: project.scannedAt, source: '自动扫描' },
  ]

  const tagRows: InfoRow[] = []
  for (const alias of project.aliases) {
    tagRows.push({ label: '别名', value: alias, source: '手动' })
  }
  for (const keyword of project.keywords) {
    tagRows.push({ label: '关键词', value: keyword, source: '自动扫描' })
  }
  for (const keyword of project.manualKeywords) {
    tagRows.push({ label: '关键词', value: keyword, source: '手动' })
  }

  const domainRows: DomainInfoRow[] = []
  for (const domain of project.domains) {
    const source =
      domain.source === 'manual'
        ? '手动'
        : domain.type === 'guess'
          ? `猜测: ${domain.source}`
          : `自动扫描: ${domain.source}`
    domainRows.push({
      confidence: String(domain.confidence),
      type: domain.type,
      value: domain.value,
      source,
    })
  }

  const linkRows: InfoRow[] = []
  for (const [name, url] of Object.entries(project.links)) {
    if (url) {
      linkRows.push({ label: name, value: url, source: '手动' })
    }
  }
  for (const environment of ['test', 'prod'] as const) {
    const name = `ci-${environment}`
    const template = config.ciTemplates?.[environment]
    if (!project.links[name] && template) {
      linkRows.push({
        label: name,
        value: fillCiTemplate(template, project),
        source: '模板',
      })
    }
  }

  const sections = [renderInfoTable('基本信息', overviewRows, terminalColumns)]
  if (tagRows.length > 0) {
    sections.push(
      renderInfoTable('标记', tagRows, terminalColumns, {
        label: '类型',
        value: '值',
        source: '来源',
      }),
    )
  }
  if (domainRows.length > 0) {
    sections.push(renderDomainTable(domainRows, terminalColumns))
  }
  if (linkRows.length > 0) {
    sections.push(
      renderInfoTable('链接', linkRows, terminalColumns, {
        label: '名称',
        value: 'URL',
        source: '来源',
      }),
    )
  }
  return `${sections.join('\n\n')}\n`
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
      process.stdout.write(
        formatProjectInfo(
          project,
          config,
          process.stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
        ),
      )
    },
  })
