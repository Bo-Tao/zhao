import {
  access,
  lstat,
  mkdir,
  readFile,
  readlink,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  getStorePaths,
  loadConfig,
  loadIndex,
  loadProjectsFile,
  mergeProjectData,
  migrateLegacyYamlFiles,
} from '../src/core/store.js'
import type { ZhaoIndex, ZhaoProjectsFile } from '../src/core/types.js'

describe('四层数据合并', () => {
  it('使用 .yaml 配置文件并迁移旧 .yml 文件', async ({ task }) => {
    const directory = join(tmpdir(), `zhao-yaml-${task.id}-${Date.now()}`)
    const paths = getStorePaths(directory)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'config.yml'), 'scanRoots: []\n')
    await writeFile(
      join(directory, 'projects.yml'),
      'git.example.com/group/repo:\n  aliases: [repo]\n',
    )

    expect(paths.config).toBe(join(directory, 'config.yaml'))
    expect(paths.projects).toBe(join(directory, 'projects.yaml'))

    await migrateLegacyYamlFiles(paths)

    await expect(readFile(paths.config, 'utf8')).resolves.toContain(
      'scanRoots: []',
    )
    await expect(readFile(paths.projects, 'utf8')).resolves.toContain(
      'git.example.com/group/repo',
    )
    await expect(access(join(directory, 'config.yml'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
    await expect(access(join(directory, 'projects.yml'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    )
    await expect(loadConfig(paths)).resolves.toEqual({ scanRoots: [] })
    await expect(loadProjectsFile(paths)).resolves.toEqual({
      'git.example.com/group/repo': { aliases: ['repo'] },
    })
  })

  it('迁移时拒绝覆盖内容不同的 .yaml 配置', async ({ task }) => {
    const directory = join(
      tmpdir(),
      `zhao-yaml-existing-${task.id}-${Date.now()}`,
    )
    const paths = getStorePaths(directory)
    await mkdir(directory, { recursive: true })
    await writeFile(paths.config, 'scanRoots: [new]\n')
    await writeFile(join(directory, 'config.yml'), 'scanRoots: [legacy]\n')

    await expect(migrateLegacyYamlFiles(paths)).rejects.toThrow(
      'config.yml 与 config.yaml 同时存在且内容不同',
    )

    await expect(loadConfig(paths)).resolves.toEqual({ scanRoots: ['new'] })
    await expect(readFile(join(directory, 'config.yml'), 'utf8')).resolves.toBe(
      'scanRoots: [legacy]\n',
    )
  })

  it('新旧配置内容相同时清理旧 .yml 文件', async ({ task }) => {
    const directory = join(tmpdir(), `zhao-yaml-same-${task.id}-${Date.now()}`)
    const paths = getStorePaths(directory)
    await mkdir(directory, { recursive: true })
    await writeFile(paths.config, 'scanRoots: []\n')
    await writeFile(join(directory, 'config.yml'), 'scanRoots: []\n')

    await migrateLegacyYamlFiles(paths)

    await expect(access(join(directory, 'config.yml'))).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })

  it('迁移时保留配置文件的符号链接', async ({ task }) => {
    const directory = join(
      tmpdir(),
      `zhao-yaml-symlink-${task.id}-${Date.now()}`,
    )
    const paths = getStorePaths(directory)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'shared-config.yaml'), 'scanRoots: []\n')
    await symlink('shared-config.yaml', join(directory, 'config.yml'))

    await migrateLegacyYamlFiles(paths)

    expect((await lstat(paths.config)).isSymbolicLink()).toBe(true)
    await expect(readlink(paths.config)).resolves.toBe('shared-config.yaml')
    await expect(loadConfig(paths)).resolves.toEqual({ scanRoots: [] })
  })

  it('手动元数据覆盖自动数据并阻止拉黑域名复活', () => {
    const index: ZhaoIndex = {
      version: 1,
      generatedAt: '2026-07-16T00:00:00.000Z',
      projects: [
        {
          id: 'git.100tal.com/group/repo',
          name: 'auto-name',
          path: '/work/repo',
          remote: 'git@git.100tal.com:group/repo.git',
          group: 'group',
          description: '自动描述',
          keywords: ['vite'],
          stack: ['vite'],
          domains: [
            {
              value: 'api.repo.100tal.com',
              type: 'api',
              source: 'src/api/request.ts',
              confidence: 0.9,
            },
            {
              value: 'cdn.100tal.com',
              type: 'api',
              source: '.env',
              confidence: 0.9,
            },
          ],
          scannedAt: '2026-07-16T00:00:00.000Z',
        },
      ],
    }
    const projects: ZhaoProjectsFile = {
      'git.100tal.com/group/repo': {
        aliases: ['业务仓'],
        keywords: ['报告'],
        domains: [
          {
            value: 'repo.100tal.com',
            type: 'page',
          },
        ],
        links: {
          docs: 'https://docs.example.com/repo',
        },
        blockedDomains: ['cdn.100tal.com'],
      },
    }

    const [merged] = mergeProjectData(index, projects)

    expect(merged?.aliases).toEqual(['业务仓'])
    expect(merged?.manualKeywords).toEqual(['报告'])
    expect(merged?.domains.map((domain) => domain.value)).toEqual([
      'repo.100tal.com',
      'api.repo.100tal.com',
    ])
    expect(merged?.domains[0]?.confidence).toBe(1)
    expect(merged?.links.docs).toBe('https://docs.example.com/repo')
  })

  it('把字段为空的 index.json 视为损坏索引', async ({ task }) => {
    const directory = join(tmpdir(), `zhao-index-${task.id}-${Date.now()}`)
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, 'index.json'),
      JSON.stringify({
        version: 1,
        generatedAt: '2026-07-16T00:00:00.000Z',
        projects: [
          {
            id: '',
            name: 'repo',
            path: '',
            remote: '',
            group: '',
            description: '',
            keywords: [],
            stack: [],
            domains: [],
            scannedAt: '2026-07-16T00:00:00.000Z',
          },
        ],
      }),
    )

    await expect(loadIndex(getStorePaths(directory))).resolves.toEqual({
      issue: '索引已损坏',
    })
  })
})
