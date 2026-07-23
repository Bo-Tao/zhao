import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  getStorePaths,
  loadIndex,
  loadProjectsFile,
  mergeProjectKeys,
  mergeProjectData,
  syncProjectsFile,
} from '../src/core/store.js'
import type { ZhaoIndex, ZhaoProjectsFile } from '../src/core/types.js'

describe('四层数据合并', () => {
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

describe('projects.yaml 项目 key 同步', () => {
  const emptyProjectData = {
    aliases: [],
    domains: [],
    keywords: [],
    links: {
      'ci-test': '',
      'ci-prod': '',
    },
  }

  it('按稳定 ID 排序追加缺失 key，并保留已有项目数据', () => {
    const existing: ZhaoProjectsFile = {
      'git.example.com/legacy/old': {
        aliases: ['旧项目'],
        keywords: ['legacy'],
      },
      'git.example.com/team/existing': {
        blockedDomains: ['blocked.example.com'],
      },
    }

    const result = mergeProjectKeys(existing, [
      'git.example.com/team/zeta',
      'git.example.com/team/existing',
      'git.example.com/team/alpha',
      'git.example.com/team/zeta',
    ])

    expect(result.changed).toBe(true)
    expect(Object.keys(result.projects)).toEqual([
      'git.example.com/legacy/old',
      'git.example.com/team/existing',
      'git.example.com/team/alpha',
      'git.example.com/team/zeta',
    ])
    expect(result.projects).toMatchObject(existing)
    expect(result.projects['git.example.com/team/alpha']).toEqual(
      emptyProjectData,
    )
    expect(result.projects['git.example.com/team/zeta']).toEqual(
      emptyProjectData,
    )
  })

  it('文件缺失时为扫描项目创建 key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhao-project-sync-'))
    const paths = getStorePaths(directory)

    await expect(
      syncProjectsFile(
        ['git.example.com/team/b', 'git.example.com/team/a'],
        paths,
      ),
    ).resolves.toBe(true)

    await expect(loadProjectsFile(paths)).resolves.toEqual({
      'git.example.com/team/a': emptyProjectData,
      'git.example.com/team/b': emptyProjectData,
    })
    await expect(readFile(paths.projects, 'utf8')).resolves.toBe(
      [
        'git.example.com/team/a:',
        '  aliases: []',
        '  domains: []',
        '  keywords: []',
        '  links:',
        '    ci-test: ""',
        '    ci-prod: ""',
        '',
        'git.example.com/team/b:',
        '  aliases: []',
        '  domains: []',
        '  keywords: []',
        '  links:',
        '    ci-test: ""',
        '    ci-prod: ""',
        '',
      ].join('\n'),
    )
  })

  it('文件缺失且没有扫描结果时仍创建空配置', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhao-project-sync-'))
    const paths = getStorePaths(directory)

    await expect(syncProjectsFile([], paths)).resolves.toBe(true)
    await expect(readFile(paths.projects, 'utf8')).resolves.toBe('{}\n')
  })

  it('只追加缺失 key，重复同步幂等且无新增项时不重写原文件', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhao-project-sync-'))
    const paths = getStorePaths(directory)
    const original = [
      '# 手工维护的注释',
      'git.example.com/team/existing:',
      '  aliases:',
      '    - 现有项目',
      'git.example.com/legacy/old:',
      '  keywords:',
      '    - legacy',
      '',
    ].join('\n')
    await writeFile(paths.projects, original)

    await expect(
      syncProjectsFile(
        [
          'git.example.com/team/existing',
          'git.example.com/team/new',
          'git.example.com/team/new',
        ],
        paths,
      ),
    ).resolves.toBe(true)
    await expect(loadProjectsFile(paths)).resolves.toEqual({
      'git.example.com/team/existing': {
        aliases: ['现有项目'],
      },
      'git.example.com/legacy/old': {
        keywords: ['legacy'],
      },
      'git.example.com/team/new': emptyProjectData,
    })

    const synchronized = await readFile(paths.projects, 'utf8')
    await expect(
      syncProjectsFile(
        ['git.example.com/team/existing', 'git.example.com/team/new'],
        paths,
      ),
    ).resolves.toBe(false)
    await expect(readFile(paths.projects, 'utf8')).resolves.toBe(synchronized)
  })

  it('无新增项时逐字保留原文件', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhao-project-sync-'))
    const paths = getStorePaths(directory)
    const original =
      '# 保留注释和排版\n"git.example.com/team/existing": { aliases: [现有项目] }\n'
    await writeFile(paths.projects, original)

    await expect(
      syncProjectsFile(['git.example.com/team/existing'], paths),
    ).resolves.toBe(false)
    await expect(readFile(paths.projects, 'utf8')).resolves.toBe(original)
  })

  it('无效 YAML 不会被空配置覆盖', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhao-project-sync-'))
    const paths = getStorePaths(directory)
    const invalid = 'git.example.com/team/repo: [\n'
    await writeFile(paths.projects, invalid)

    await expect(
      syncProjectsFile(['git.example.com/team/new'], paths),
    ).rejects.toThrow('projects.yaml 无法解析')
    await expect(readFile(paths.projects, 'utf8')).resolves.toBe(invalid)
  })

  it('原子写入失败时不覆盖已有配置', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhao-project-sync-'))
    const paths = getStorePaths(directory)
    const original = 'git.example.com/team/existing: {}\n'
    await writeFile(paths.projects, original)
    await mkdir(`${paths.projects}.${process.pid}.tmp`)

    await expect(
      syncProjectsFile(['git.example.com/team/new'], paths),
    ).rejects.toThrow()
    await expect(readFile(paths.projects, 'utf8')).resolves.toBe(original)
  })
})
