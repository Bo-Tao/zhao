export const DEFAULT_TERMINAL_COLUMNS = 80

const CELL_HORIZONTAL_PADDING = 2
const ELLIPSIS = '…'
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})
const WIDE_CHARACTER_PATTERN =
  /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1b000}-\u{1b001}\u{1f200}-\u{1faff}\u{20000}-\u{3fffd}]/u
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u
const MARK_PATTERN = /^\p{Mark}+$/u

export interface TableColumn {
  header: string
  values: string[]
}

interface RenderTableOptions {
  overflow?: 'truncate' | 'wrap'
  rowSeparators?: boolean
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

export const normalizeTableCell = (value: string): string =>
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

const wrapText = (value: string, limit: number): string[] => {
  if (getTextWidth(value) <= limit) {
    return [value]
  }

  const lines: string[] = []
  let line = ''
  let width = 0
  for (const { segment } of graphemeSegmenter.segment(value)) {
    const segmentWidth = getGraphemeWidth(segment)
    if (line && width + segmentWidth > limit) {
      lines.push(line)
      line = ''
      width = 0
    }
    line += segment
    width += segmentWidth
  }
  if (line || lines.length === 0) {
    lines.push(line)
  }
  return lines
}

const padCell = (value: string, width: number): string =>
  `${value}${' '.repeat(width - getTextWidth(value))}`

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
  const tableFixedWidth =
    CELL_HORIZONTAL_PADDING * columns.length + columns.length + 1
  const availableWidth = Math.max(
    minimumWidths.reduce((sum, width) => sum + width, 0),
    safeTerminalColumns - tableFixedWidth,
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

export const renderTable = (
  columns: TableColumn[],
  terminalColumns = DEFAULT_TERMINAL_COLUMNS,
  options: RenderTableOptions = {},
): string => {
  const { overflow = 'truncate', rowSeparators = true } = options
  const widths = resolveColumnWidths(columns, terminalColumns)
  const border = (left: string, middle: string, right: string): string =>
    `${left}${widths.map((width) => '─'.repeat(width + 2)).join(middle)}${right}`
  const row = (values: string[]): string =>
    `│${values
      .map((value, index) => ` ${padCell(value, widths[index]!)} `)
      .join('│')}│`
  const renderDataRow = (values: string[]): string[] => {
    const cellLines = values.map((value, index) =>
      overflow === 'wrap'
        ? wrapText(value, widths[index]!)
        : [fitText(value, widths[index]!)],
    )
    const height = Math.max(...cellLines.map(({ length }) => length))
    return Array.from({ length: height }, (_, lineIndex) =>
      row(cellLines.map((lines) => lines[lineIndex] ?? '')),
    )
  }

  const rows = columns[0]!.values.map((_, rowIndex) =>
    renderDataRow(columns.map(({ values }) => values[rowIndex]!)),
  )
  const body = rows.flatMap((lines, index) =>
    rowSeparators && index < rows.length - 1
      ? [...lines, border('├', '┼', '┤')]
      : lines,
  )
  return [
    border('┌', '┬', '┐'),
    row(columns.map(({ header }) => header)),
    border('├', '┼', '┤'),
    ...body,
    border('└', '┴', '┘'),
  ].join('\n')
}
