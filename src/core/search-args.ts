export interface SearchArgs {
  query?: string
  print: boolean
  claude: boolean
  tmux: boolean
}

export const parseSearchArgs = (rawArgs: string[]): SearchArgs => {
  const result: SearchArgs = {
    query: undefined,
    print: false,
    claude: false,
    tmux: false,
  }
  const positionals: string[] = []

  for (const argument of rawArgs) {
    if (argument === '--print') {
      result.print = true
    } else if (argument === '--claude') {
      result.claude = true
    } else if (argument === '--tmux') {
      result.tmux = true
    } else if (argument.startsWith('-')) {
      throw new Error(`未知参数：${argument}`)
    } else {
      positionals.push(argument)
    }
  }

  if (positionals.length > 1) {
    throw new Error('zhao 只接受一个 query；包含空格时请使用引号。')
  }
  result.query = positionals[0]
  return result
}
