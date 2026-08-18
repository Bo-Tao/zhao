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

  it('可为只接受登记项目的命令禁用当前位置临时项目', async ({ task }) => {
    const root = join(tmpdir(), `resolver-${task.id}-${Date.now()}-strict`)
    const repo = join(root, 'repo')
    const nested = join(repo, 'src')
    await mkdir(join(repo, '.git'), { recursive: true })
    await mkdir(nested, { recursive: true })
    await writeFile(
      join(repo, '.git', 'config'),
      '[remote "origin"]\n  url = https://git.100tal.com/group/current.git\n',
    )

    const resolved = await resolveProject(undefined, {
      projects: [project],
      cwd: nested,
      state: { version: 1, entries: {} },
      allowUnindexedCurrent: false,
      selectProject: async (projects) => projects[0]!.project,
      recordUse: async () => undefined,
    })

    expect(resolved.id).toBe(project.id)
  })

  it('无 query 时优先识别当前目录所在的 monorepo target', async ({ task }) => {
    const root = join(tmpdir(), `resolver-${task.id}-${Date.now()}-monorepo`)
    const repo = join(root, 'platform')
    const targetRoot = join(repo, 'apps', 'admin-web')
    const nested = join(targetRoot, 'src', 'pages')
    await mkdir(join(repo, '.git'), { recursive: true })
    await mkdir(nested, { recursive: true })
    await writeFile(
      join(repo, '.git', 'config'),
      '[remote "origin"]\n  url = git@git.100tal.com:group/platform.git\n',
    )
    const repository: MergedProject = {
      ...project,
      id: 'git.100tal.com/group/platform',
      name: 'platform',
      path: repo,
      remote: 'git@git.100tal.com:group/platform.git',
    }
    const target: MergedProject = {
      ...repository,
      id: 'git.100tal.com/group/platform#admin-web',
      name: '运营后台',
      path: targetRoot,
      repositoryId: repository.id,
      repositoryName: repository.name,
      targetKey: 'admin-web',
      relativePath: 'apps/admin-web',
    }

    const resolved = await resolveProject(undefined, {
      projects: [repository, target],
      cwd: nested,
      state: { version: 1, entries: {} },
      selectProject: async () => {
        throw new Error('当前位置 target 不应出现选择器')
      },
      recordUse: async () => undefined,
    })

    expect(resolved.id).toBe(target.id)
  })
})
