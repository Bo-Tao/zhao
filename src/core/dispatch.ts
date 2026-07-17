const managementCommands = new Set(['init', 'setup', 'scan', 'browse', 'list'])

const futureCommands = new Set([
  'ci',
  'tag',
  'info',
  'edit',
  'config',
  'doctor',
  'open',
  'sync',
])

export type InvocationKind = 'management' | 'future-command' | 'search'

export const classifyInvocation = (rawArgs: string[]): InvocationKind => {
  if (
    rawArgs.includes('--help') ||
    rawArgs.includes('-h') ||
    rawArgs.includes('-v') ||
    rawArgs.includes('--version')
  ) {
    return 'management'
  }
  const firstPositional = rawArgs.find((argument) => !argument.startsWith('-'))
  if (firstPositional && managementCommands.has(firstPositional)) {
    return 'management'
  }
  if (firstPositional && futureCommands.has(firstPositional)) {
    return 'future-command'
  }
  return 'search'
}
