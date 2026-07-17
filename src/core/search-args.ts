import { ArgumentError } from './argument-error.js'

export interface SearchArgs {
  query?: string
  print: boolean
  claude: boolean
  codex: boolean
  tmux: boolean
}

export const parseSearchArgs = (rawArgs: string[]): SearchArgs => {
  const result: SearchArgs = {
    query: undefined,
    print: false,
    claude: false,
    codex: false,
    tmux: false,
  }
  const positionals: string[] = []

  for (const argument of rawArgs) {
    if (argument === '--print' || argument === '-p') {
      result.print = true
    } else if (argument === '--claude' || argument === '-cc') {
      result.claude = true
    } else if (argument === '--codex' || argument === '-cdx') {
      result.codex = true
    } else if (argument === '--tmux' || argument === '-t') {
      result.tmux = true
    } else if (argument.startsWith('-')) {
      throw new ArgumentError(`未知参数：${argument}`)
    } else {
      positionals.push(argument)
    }
  }

  if (result.claude && result.codex) {
    throw new ArgumentError('--claude/-cc 与 --codex/-cdx 不能同时使用。')
  }

  if (positionals.length > 1) {
    throw new ArgumentError('zhao 只接受一个 query；包含空格时请使用引号。')
  }
  result.query = positionals[0]
  return result
}
