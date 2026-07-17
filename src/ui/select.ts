import { spawn } from 'node:child_process'

import type { MergedProject, RankedProject } from '../core/types.js'
import { promptProject } from './prompts.js'

const selectWithFzf = async (
  projects: RankedProject[],
): Promise<MergedProject | undefined> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'fzf',
      [
        '--delimiter=\t',
        '--with-nth=2..',
        '--prompt=选择项目 > ',
        '--height=60%',
        '--reverse',
      ],
      {
        stdio: ['pipe', 'pipe', 'inherit'],
      },
    )
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        resolve(undefined)
        return
      }
      reject(error)
    })
    child.on('close', (code) => {
      if (code === 130) {
        reject(new Error('操作已取消'))
        return
      }
      if (code !== 0) {
        resolve(undefined)
        return
      }
      const id = output.trim().split('\t')[0]
      resolve(projects.find((item) => item.project.id === id)?.project)
    })
    child.stdin.end(
      projects
        .map(
          ({ project, reason }) =>
            `${project.id}\t${project.name} · ${project.description || '无描述'}\t${reason}`,
        )
        .join('\n'),
    )
  })

export const selectProject = async (
  projects: RankedProject[],
  useFzf = false,
): Promise<MergedProject> => {
  if (useFzf) {
    const selected = await selectWithFzf(projects)
    if (selected) {
      return selected
    }
  }
  return promptProject(projects)
}
