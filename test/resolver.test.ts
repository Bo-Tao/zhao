import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveProject } from '../src/core/resolver.js'
import type { MergedProject } from '../src/core/types.js'

const project: MergedProject = {
  id: 'git.100tal.com/group/target',
  name: 'target',
  path: '/work/target',
  remote: 'git@git.100tal.com:group/target.git',
  group: 'group',
  description: '',
  keywords: [],
  manualKeywords: [],
  aliases: ['目标'],
  stack: [],
  domains: [],
  links: {},
  scannedAt: '2026-07-16T00:00:00.000Z',
}

describe('resolveProject', () => {
  it('显式 query 永远优先于当前目录项目', async ({ task }) => {
    const root = join(tmpdir(), `resolver-${task.id}-${Date.now()}`)
    const nested = join(root, 'repo', 'src', 'pages')
    await mkdir(join(root, 'repo', '.git'), { recursive: true })
    await mkdir(nested, { recursive: true })
    await writeFile(
      join(root, 'repo', '.git', 'config'),
      '[remote "origin"]\n  url = git@git.100tal.com:group/current.git\n',
    )

    const resolved = await resolveProject('目标', {
      projects: [project],
      cwd: nested,
      state: { version: 1, entries: {} },
      selectProject: async () => {
        throw new Error('单个命中不应出现选择器')
      },
      recordUse: async () => undefined,
    })

    expect(resolved.id).toBe(project.id)
  })

  it('无 query 时可从任意子目录识别未入索引的 git 项目', async ({ task }) => {
    const root = join(tmpdir(), `resolver-${task.id}-${Date.now()}-cwd`)
    const repo = join(root, 'repo')
    const nested = join(repo, 'src', 'pages')
    await mkdir(join(repo, '.git'), { recursive: true })
    await mkdir(nested, { recursive: true })
    await writeFile(
      join(repo, '.git', 'config'),
      '[remote "origin"]\n  url = https://git.100tal.com/group/current.git\n',
    )

    const resolved = await resolveProject(undefined, {
      projects: [],
      cwd: nested,
      state: { version: 1, entries: {} },
      selectProject: async () => {
        throw new Error('当前位置项目不应出现选择器')
      },
      recordUse: async () => undefined,
    })

    expect(resolved).toMatchObject({
      id: 'git.100tal.com/group/current',
      name: 'repo',
      path: repo,
    })
  })
})
