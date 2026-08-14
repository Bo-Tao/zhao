import { loadMergedProjects } from '../core/store.js'
import type { MergedProject } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import {
  DEFAULT_TERMINAL_COLUMNS,
  normalizeTableCell,
  renderTable,
} from '../ui/table.js'
import type { DefineCommand } from './types.js'

export const formatProjectList = (
  projects: MergedProject[],
  json: boolean,
  terminalColumns = DEFAULT_TERMINAL_COLUMNS,
): string => {
  if (json) {
    return `${JSON.stringify(projects, null, 2)}\n`
  }
  return `${renderTable(
    [
      {
        header: '名称',
        values: projects.map(({ name }) => normalizeTableCell(name)),
      },
      {
        header: '路径',
        values: projects.map(({ path }) => normalizeTableCell(path)),
      },
      {
        header: '描述',
        values: projects.map(({ description }) =>
          normalizeTableCell(description),
        ),
      },
    ],
    terminalColumns,
  )}\n`
}

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'list',
      description: '列出全部已索引项目',
    },
    args: {
      json: {
        type: 'boolean',
        description: '输出合并后的完整 JSON 数据',
        default: false,
      },
    },
    async run({ args }) {
      await ensureOnboarded()
      const { projects, indexIssue } = await loadMergedProjects()
      if (indexIssue) {
        throw new Error(`${indexIssue}，请运行 zhao scan 重建。`)
      }
      process.stdout.write(
        formatProjectList(
          projects,
          args.json,
          process.stdout.columns ?? DEFAULT_TERMINAL_COLUMNS,
        ),
      )
    },
  })
