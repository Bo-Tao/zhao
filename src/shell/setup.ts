import { lstat, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'

export type SupportedShell = 'zsh' | 'bash'

export const detectShell = (
  shellPath = process.env.SHELL ?? '',
): SupportedShell => {
  const shell = basename(shellPath)
  if (shell === 'zsh' || shell === 'bash') {
    return shell
  }
  throw new Error('无法识别当前 shell；请使用 zhao setup --shell zsh 或 bash')
}

export const getRcFile = (shell: SupportedShell, home = homedir()): string =>
  join(home, shell === 'zsh' ? '.zshrc' : '.bashrc')

export const getWrapperEvalLine = (shell: SupportedShell): string =>
  `eval "$(zhao init ${shell})"`

export const appendWrapperLine = (content: string, line: string): string => {
  if (content.split(/\r?\n/).some((current) => current.trim() === line)) {
    return content
  }
  const normalized =
    content && !content.endsWith('\n') ? `${content}\n` : content
  return `${normalized}${line}\n`
}

export interface RcFileInfo {
  path: string
  content: string
  isSymbolicLink: boolean
}

export const inspectRcFile = async (path: string): Promise<RcFileInfo> => {
  try {
    const [metadata, content] = await Promise.all([
      lstat(path),
      readFile(path, 'utf8'),
    ])
    return {
      path,
      content,
      isSymbolicLink: metadata.isSymbolicLink(),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { path, content: '', isSymbolicLink: false }
    }
    throw error
  }
}

export const writeWrapperToRc = async (
  path: string,
  shell: SupportedShell,
): Promise<{ changed: boolean; content: string }> => {
  const info = await inspectRcFile(path)
  const line = getWrapperEvalLine(shell)
  const content = appendWrapperLine(info.content, line)
  if (content === info.content) {
    return { changed: false, content }
  }
  await writeFile(path, content, 'utf8')
  return { changed: true, content }
}
