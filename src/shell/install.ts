import type { SupportedShell } from './setup.js'
import {
  detectShell,
  getRcFile,
  getWrapperEvalLine,
  inspectRcFile,
  writeWrapperToRc,
} from './setup.js'
import { promptConfirm, showNote } from '../ui/prompts.js'

export const installWrapperInteractively = async (
  shellOverride?: string,
): Promise<void> => {
  const shell = shellOverride
    ? (shellOverride as SupportedShell)
    : detectShell()
  if (shell !== 'zsh' && shell !== 'bash') {
    throw new Error(`不支持 ${shellOverride}，仅支持 zsh、bash`)
  }

  const rcFile = getRcFile(shell)
  const info = await inspectRcFile(rcFile)
  const line = getWrapperEvalLine(shell)
  if (info.content.split(/\r?\n/).some((item) => item.trim() === line)) {
    process.stderr.write(`已存在，跳过写入：${rcFile}\n${line}\n`)
    return
  }

  await showNote(line, `将追加到 ${rcFile}`)
  if (info.isSymbolicLink) {
    process.stderr.write(`警告：${rcFile} 是符号链接，可能由 dotfiles 管理。\n`)
    const acceptSymlink = await promptConfirm(
      '仍要修改该符号链接目标吗？',
      false,
    )
    if (!acceptSymlink) {
      throw new Error('已取消修改符号链接 rc 文件。')
    }
  }
  const accepted = await promptConfirm('确认写入以上内容？', true)
  if (!accepted) {
    throw new Error('已取消 setup。')
  }

  const result = await writeWrapperToRc(rcFile, shell)
  process.stderr.write(
    `${result.changed ? '已修改' : '无需修改'}：${rcFile}\n${line}\n`,
  )
}
