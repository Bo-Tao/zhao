import { spawn } from 'node:child_process'

export const parseEditorCommand = (value: string): string[] => {
  const parts: string[] = []
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|([^\s]+)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    parts.push((match[1] ?? match[2] ?? match[3] ?? '').replace(/\\"/g, '"'))
  }
  return parts
}

export const openInEditor = async (
  path: string,
  editor = process.env.EDITOR || 'vi',
): Promise<void> => {
  const [command, ...args] = parseEditorCommand(editor)
  if (!command) {
    throw new Error('$EDITOR 为空，请设置后重试。')
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args, path], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} 退出码 ${code ?? 'unknown'}`))
      }
    })
  })
}
