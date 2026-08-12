import { loadMergedProjects } from '../core/store.js'
import type { MergedProject } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import type { DefineCommand } from './types.js'

const DEFAULT_TERMINAL_COLUMNS = 80
const CELL_HORIZONTAL_PADDING = 2
const TABLE_BOUNDARY_WIDTH = 4
const TABLE_FIXED_WIDTH = CELL_HORIZONTAL_PADDING * 3 + TABLE_BOUNDARY_WIDTH
const ELLIPSIS = '…'
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})
const WIDE_CHARACTER_PATTERN =
  /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1b000}-\u{1b001}\u{1f200}-\u{1faff}\u{20000}-\u{3fffd}]/u
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const MARK_PATTERN = /^\p{Mark}+$/u

interface TableColumn {
  header: string
  values: string[]
}

const getGraphemeWidth = (value: string): number => {
  if (MARK_PATTERN.test(value)) {
    return 0
  }
  return WIDE_CHARACTER_PATTERN.test(value) || EMOJI_PATTERN.test(value) ? 2 : 1
}

const getTextWidth = (value: string): number => {
  let width = 0
  for (const { segment } of graphemeSegmenter.segment(value)) {
    width += getGraphemeWidth(segment)
  }
  return width
}

const normalizeCell = (value: string): string =>
  value.replace(/\p{Cc}+/gu, ' ').trim()

const fitText = (value: string, limit: number): string => {
  if (getTextWidth(value) <= limit) {
    return value
  }

  let text = ''
  let width = 0
  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentWidth = getGraphemeWidth(segment)
    if (width + segmentWidth > limit - 1) {
      break
    }
    text += segment
    width += segmentWidth
  }
  return `${text}${ELLIPSIS}`
}

const padCell = (value: string, width: number): string => {
  const fitted = fitText(value, width)
  return `${fitted}${' '.repeat(width - getTextWidth(fitted))}`
}

const resolveColumnWidths = (
  columns: TableColumn[],
  terminalColumns: number,
): number[] => {
  const minimumWidths = columns.map(({ header }) => getTextWidth(header))
  const widths = columns.map(({ header, values }, index) =>
    Math.max(
      minimumWidths[index]!,
      getTextWidth(header),
      ...values.map(getTextWidth),
    ),
  )
  const safeTerminalColumns =
    Number.isFinite(terminalColumns) && terminalColumns > 0
      ? Math.floor(terminalColumns)
      : DEFAULT_TERMINAL_COLUMNS
  const availableWidth = Math.max(
    minimumWidths.reduce((sum, width) => sum + width, 0),
    safeTerminalColumns - TABLE_FIXED_WIDTH,
  )

  while (widths.reduce((sum, width) => sum + width, 0) > availableWidth) {
    let widestIndex = -1
    for (let index = 0; index < widths.length; index += 1) {
      if (
        widths[index]! > minimumWidths[index]! &&
        (widestIndex === -1 || widths[index]! > widths[widestIndex]!)
      ) {
        widestIndex = index
      }
    }
    if (widestIndex === -1) {
      break
    }
    widths[widestIndex]!--
  }

  return widths
}

const renderTable = (
  columns: TableColumn[],
  terminalColumns: number,
): string => {
  const widths = resolveColumnWidths(columns, terminalColumns)
  const border = (left: string, middle: string, right: string): string =>
    `${left}${widths.map((width) => '─'.repeat(width + 2)).join(middle)}${right}`
  const row = (values: string[]): string =>
    `│${values
      .map((value, index) => ` ${padCell(value, widths[index]!)} `)
      .join('│')}│`

  const rows = columns[0]!.values.map((_, rowIndex) =>
    row(columns.map(({ values }) => values[rowIndex]!)),
  )
  const body = rows.flatMap((value, index) =>
    index < rows.length - 1 ? [value, border('├', '┼', '┤')] : [value],
  )
  return [
    border('┌', '┬', '┐'),
    row(columns.map(({ header }) => header)),
    border('├', '┼', '┤'),
    ...body,
    border('└', '┴', '┘'),
  ].join('\n')
}

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
        values: projects.map(({ name }) => normalizeCell(name)),
      },
      {
        header: '路径',
        values: projects.map(({ path }) => normalizeCell(path)),
      },
      {
        header: '描述',
        values: projects.map(({ description }) => normalizeCell(description)),
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
