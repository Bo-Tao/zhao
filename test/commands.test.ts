import { describe, expect, it, vi } from 'vitest'

import {
  parseBrowsePositionals,
  shouldUseGraphicalOpen,
} from '../src/commands/browse.js'
import { parseCiPositionals, resolveCiUrl } from '../src/commands/ci.js'
import {
  getConfigValue,
  parseConfigPositionals,
  setConfigValue,
} from '../src/commands/config.js'
import { formatProjectInfo } from '../src/commands/info.js'
import { formatProjectList } from '../src/commands/list.js'
import {
  assertProjectOpenEnvironment,
  parseOpenPositionals,
  runOpenCommand,
} from '../src/commands/open.js'
import { applyProjectTags, normalizeTagValues } from '../src/commands/tag.js'
import { PROJECT_OPENERS } from '../src/core/project-opener.js'
import type { MergedProject } from '../src/core/types.js'

const project: MergedProject = {
  id: 'git.100tal.com/group/repo',
  name: 'repo',
  path: '/work/repo',
  remote: 'git@git.100tal.com:group/repo.git',
  group: 'group',
  description: '报告 H5',
  keywords: ['report'],
  manualKeywords: ['报告'],
  aliases: ['业务仓'],
  stack: ['vue3', 'vite'],
  domains: [],
  links: {},
  scannedAt: '2026-07-16T00:00:00.000Z',
}

describe('browse 命令', () => {
  it('接受零个或一个 query，拒绝多余位置参数', () => {
    expect(parseBrowsePositionals([])).toBeUndefined()
    expect(parseBrowsePositionals(['repo'])).toBe('repo')
    expect(() => parseBrowsePositionals(['repo', 'status'])).toThrow(
      'browse 只接受一个 query',
    )
  })

  it('SSH 或无图形环境时自动降级为打印', () => {
    expect(
      shouldUseGraphicalOpen({
        platform: 'darwin',
        env: { SSH_CONNECTION: 'example' },
      }),
    ).toBe(false)
    expect(
      shouldUseGraphicalOpen({
        platform: 'linux',
        env: {},
      }),
    ).toBe(false)
    expect(
      shouldUseGraphicalOpen({
        platform: 'darwin',
        env: {},
      }),
    ).toBe(true)
  })
})

describe('open 命令', () => {
  it('接受零个或一个项目 query', () => {
    expect(parseOpenPositionals([])).toBeUndefined()
    expect(parseOpenPositionals(['repo'])).toBe('repo')
    expect(() => parseOpenPositionals(['repo', 'extra'])).toThrow(
      'open 只接受一个项目查询',
    )
  })

  it('仅允许本地图形化 macOS 会话', () => {
    expect(() =>
      assertProjectOpenEnvironment({ platform: 'linux', env: {} }),
    ).toThrow('目前仅支持 macOS')
    expect(() =>
      assertProjectOpenEnvironment({
        platform: 'darwin',
        env: { SSH_CONNECTION: 'example' },
      }),
    ).toThrow('SSH 或无图形环境')
    expect(() =>
      assertProjectOpenEnvironment({ platform: 'darwin', env: {} }),
    ).not.toThrow()
  })

  it('无工具参数时选择已安装工具，启动后输出成功信息', async () => {
    const installed = {
      ...PROJECT_OPENERS[1]!,
      applicationPath: '/Applications/Cursor.app',
    }
    const promptProjectOpener = vi.fn().mockResolvedValue(installed)
    const launchProject = vi.fn().mockResolvedValue(undefined)
    const writeStatus = vi.fn()

    await runOpenCommand(
      { positionals: ['repo'] },
      {
        platform: 'darwin',
        env: {},
        detectInstalledProjectOpeners: async () => [installed],
        ensureOnboarded: async () => undefined,
        resolveStoredProject: async () => project,
        promptProjectOpener,
        launchProject,
        writeStatus,
      },
    )

    expect(promptProjectOpener).toHaveBeenCalledWith([installed])
    expect(launchProject).toHaveBeenCalledWith(installed, project.path)
    expect(writeStatus).toHaveBeenCalledWith('已使用 Cursor 打开 repo\n')
  })

  it('显式工具参数跳过工具选择', async () => {
    const installed = {
      ...PROJECT_OPENERS[0]!,
      applicationPath: '/Applications/Visual Studio Code.app',
    }
    const promptProjectOpener = vi.fn()

    await runOpenCommand(
      { positionals: [], withTool: 'CODE' },
      {
        platform: 'darwin',
        env: {},
        detectInstalledProjectOpeners: async () => [installed],
        ensureOnboarded: async () => undefined,
        resolveStoredProject: async (query) => {
          expect(query).toBeUndefined()
          return project
        },
        promptProjectOpener,
        launchProject: async () => undefined,
        writeStatus: () => undefined,
      },
    )

    expect(promptProjectOpener).not.toHaveBeenCalled()
  })

  it('显式指定未安装工具时不进入项目解析', async () => {
    const ensureOnboarded = vi.fn()
    const resolveStoredProject = vi.fn()

    await expect(
      runOpenCommand(
        { positionals: [], withTool: 'cursor' },
        {
          platform: 'darwin',
          env: {},
          detectInstalledProjectOpeners: async () => [],
          ensureOnboarded,
          resolveStoredProject,
          promptProjectOpener: vi.fn(),
          launchProject: vi.fn(),
          writeStatus: vi.fn(),
        },
      ),
    ).rejects.toThrow('未安装或无法找到 Cursor')
    expect(ensureOnboarded).not.toHaveBeenCalled()
    expect(resolveStoredProject).not.toHaveBeenCalled()
  })
})

describe('list 命令', () => {
  it('--json 输出合并后的完整项目数据', () => {
    const output = formatProjectList([project], true)
    expect(JSON.parse(output)).toEqual([project])
  })

  it('文本列表以表格对齐名称、路径和描述', () => {
    expect(formatProjectList([project], false)).toBe(
      [
        '┌──────┬────────────┬─────────┐',
        '│ 名称 │ 路径       │ 描述    │',
        '├──────┼────────────┼─────────┤',
        '│ repo │ /work/repo │ 报告 H5 │',
        '└──────┴────────────┴─────────┘',
        '',
      ].join('\n'),
    )
  })

  it('终端较窄时截断过长单元格', () => {
    const output = formatProjectList(
      [
        {
          ...project,
          name: '超级长的项目名称',
          path: '/work/group/really-long-project-name',
          description: '这是一段很长的项目描述',
        },
      ],
      false,
      40,
    )

    expect(output).toBe(
      [
        '┌────────────┬────────────┬────────────┐',
        '│ 名称       │ 路径       │ 描述       │',
        '├────────────┼────────────┼────────────┤',
        '│ 超级长的…  │ /work/gro… │ 这是一段…  │',
        '└────────────┴────────────┴────────────┘',
        '',
      ].join('\n'),
    )
  })

  it('没有项目时仍显示表头', () => {
    const output = formatProjectList([], false)
    expect(output).toContain('│ 名称 │ 路径 │ 描述 │')
    expect(output.trimEnd().split('\n')).toHaveLength(4)
  })

  it('每条项目记录之间显示横向分隔线', () => {
    const output = formatProjectList(
      [
        project,
        {
          ...project,
          id: 'git.100tal.com/group/admin',
          name: 'admin',
          path: '/work/admin',
          description: '管理后台',
        },
      ],
      false,
    )
    const lines = output.trimEnd().split('\n')

    expect(lines[4]).toMatch(/^├─+┼─+┼─+┤$/)
    expect(lines).toHaveLength(7)
  })
})

describe('ci 命令', () => {
  it('仅当首个位置参数是 test 或 prod 时才把它解析为环境', () => {
    expect(parseCiPositionals([])).toEqual({ environment: 'test' })
    expect(parseCiPositionals(['prod'])).toEqual({ environment: 'prod' })
    expect(parseCiPositionals(['prod', 'repo'])).toEqual({
      environment: 'prod',
      query: 'repo',
    })
    expect(parseCiPositionals(['repo'])).toEqual({
      environment: 'test',
      query: 'repo',
    })
    expect(() => parseCiPositionals(['repo', 'extra'])).toThrow(
      'ci 最多接受环境和一个 query',
    )
  })

  it('项目 links 优先于 ciTemplates，并能用项目字段填充模板', () => {
    expect(
      resolveCiUrl(project, 'test', {
        test: 'https://build.example.com/{group}/{name}?env=test',
      }),
    ).toBe('https://build.example.com/group/repo?env=test')

    expect(
      resolveCiUrl(
        {
          ...project,
          links: { 'ci-prod': 'https://custom.example.com/repo' },
        },
        'prod',
        { prod: 'https://build.example.com/{group}/{name}?env=prod' },
      ),
    ).toBe('https://custom.example.com/repo')
  })
})

describe('tag 命令', () => {
  it('接受重复 flag 与逗号分隔值，并去除空值和重复项', () => {
    expect(normalizeTagValues(['报告, h5', '报告', ''])).toEqual(['报告', 'h5'])
  })

  it('累加手动元数据，并把移除域名写入 blockedDomains', () => {
    expect(
      applyProjectTags(
        {
          aliases: ['旧别名'],
          domains: [{ value: 'old.example.com', type: 'page' }],
          keywords: ['旧关键词'],
          links: { docs: 'https://docs.example.com' },
          blockedDomains: ['old-blocked.example.com'],
        },
        {
          aliases: ['新别名', '旧别名'],
          ciProd: 'https://cloud.example.com/prod?id=2',
          ciTest: 'https://cloud.example.com/test?id=1',
          domains: ['app.example.com'],
          keywords: ['新关键词'],
          removedDomains: ['api.example.com'],
        },
      ),
    ).toEqual({
      aliases: ['旧别名', '新别名'],
      domains: [
        { value: 'old.example.com', type: 'page' },
        { value: 'app.example.com', type: 'page' },
      ],
      keywords: ['旧关键词', '新关键词'],
      links: {
        docs: 'https://docs.example.com',
        'ci-test': 'https://cloud.example.com/test?id=1',
        'ci-prod': 'https://cloud.example.com/prod?id=2',
      },
      blockedDomains: ['old-blocked.example.com', 'api.example.com'],
    })
  })

  it('只设置 CI 链接时保留其他手动元数据和已有链接', () => {
    expect(
      applyProjectTags(
        {
          aliases: ['报告'],
          links: {
            docs: 'https://docs.example.com',
            'ci-test': 'https://cloud.example.com/old-test',
          },
        },
        {
          aliases: [],
          ciProd: 'https://cloud.example.com/prod',
          ciTest: 'https://cloud.example.com/new-test',
          domains: [],
          keywords: [],
          removedDomains: [],
        },
      ),
    ).toEqual({
      aliases: ['报告'],
      links: {
        docs: 'https://docs.example.com',
        'ci-test': 'https://cloud.example.com/new-test',
        'ci-prod': 'https://cloud.example.com/prod',
      },
    })
  })
})

describe('info 命令', () => {
  it('展示合并元数据并区分自动、手动、模板和猜测来源', () => {
    const output = formatProjectInfo(
      {
        ...project,
        links: {
          'ci-test': '',
          'ci-prod': '',
        },
        domains: [
          {
            value: 'app.example.com',
            type: 'page',
            source: 'manual',
            confidence: 1,
          },
          {
            value: 'api.example.com',
            type: 'api',
            source: 'src/api/client.ts',
            confidence: 0.9,
          },
          {
            value: 'example.com',
            type: 'guess',
            source: 'api.example.com',
            confidence: 0.3,
          },
        ],
      },
      {
        scanRoots: ['/work'],
        ciTemplates: {
          test: 'https://build.example.com/{group}/{name}',
        },
      },
    )

    expect(output).toContain('基本信息\n┌')
    expect(output).toContain('\n标记\n┌')
    expect(output).toContain('\n域名\n┌')
    expect(output).toContain('\n链接\n┌')
    expect(output).toMatch(/│ 别名\s+│ 业务仓\s+│ 手动\s+│/)
    expect(output).toMatch(/│ 关键词\s+│ report\s+│ 自动扫描\s+│/)
    expect(output).toMatch(/│ 关键词\s+│ 报告\s+│ 手动\s+│/)
    expect(output).toContain('app.example.com')
    expect(output).toContain('自动扫描: src/api/client.ts')
    expect(output).toContain('猜测: api.example.com')
    expect(output).toContain('https://build.example.com/group/repo')
    expect(output).toMatch(/│ ci-test\s+│ .* │ 模板\s+│/)
    expect(output).not.toContain('ci-prod')
  })

  it('展示 monorepo target 的所属仓库和相对路径', () => {
    const output = formatProjectInfo(
      {
        ...project,
        id: 'git.100tal.com/group/platform#admin-web',
        name: '运营后台',
        path: '/work/platform/apps/admin-web',
        repositoryId: 'git.100tal.com/group/platform',
        repositoryName: 'platform',
        targetKey: 'admin-web',
        relativePath: 'apps/admin-web',
      },
      { scanRoots: ['/work'] },
    )

    expect(output).toMatch(/│ 名称\s+│ 运营后台\s+│ 手动\s+│/)
    expect(output).toContain('platform (git.100tal.com/group/platform)')
    expect(output).toMatch(/│ Target\s+│ admin-web\s+│ 手动\s+│/)
    expect(output).toMatch(/│ 相对路径\s+│ apps\/admin-web\s+│ 手动\s+│/)
  })

  it('终端较窄时换行长 URL 而不丢失信息', () => {
    const output = formatProjectInfo(
      {
        ...project,
        links: {
          'ci-test':
            'https://build.example.com/very/long/path/to/report?id=123456',
        },
      },
      { scanRoots: ['/work'] },
      42,
    )

    expect(output).not.toContain('…')
    expect(output).toContain('https://build.example')
    expect(output).toContain('report?id=123456')
    expect(
      output
        .split('\n')
        .filter((line) => line.startsWith('│') || line.startsWith('┌'))
        .every((line) => line.length <= 42),
    ).toBe(true)
  })
})

describe('config 命令', () => {
  const config = {
    scanRoots: ['/work/fe'],
    ciTemplates: { test: 'https://build/{group}/{name}' },
    useFzf: false,
    scanDepth: 4,
  }

  it('区分编辑、读取和设置三种调用形式', () => {
    expect(parseConfigPositionals([])).toEqual({ action: 'edit' })
    expect(parseConfigPositionals(['get', 'ciTemplates.test'])).toEqual({
      action: 'get',
      key: 'ciTemplates.test',
    })
    expect(parseConfigPositionals(['set', 'useFzf', 'true'])).toEqual({
      action: 'set',
      key: 'useFzf',
      value: 'true',
    })
    expect(() => parseConfigPositionals(['remove', 'useFzf'])).toThrow(
      'config 仅支持 get、set',
    )
  })

  it('按点分键读取，并按 schema 类型设置配置值', () => {
    expect(getConfigValue(config, 'ciTemplates.test')).toBe(
      'https://build/{group}/{name}',
    )
    expect(setConfigValue(config, 'useFzf', 'true')).toMatchObject({
      useFzf: true,
    })
    expect(setConfigValue(config, 'scanDepth', '7')).toMatchObject({
      scanDepth: 7,
    })
    expect(setConfigValue(config, 'scanRoots', '/a, /b').scanRoots).toEqual([
      '/a',
      '/b',
    ])
    expect(
      setConfigValue(config, 'ciTemplates.prod', 'https://prod/{name}')
        .ciTemplates?.prod,
    ).toBe('https://prod/{name}')
    expect(() => setConfigValue(config, 'useFzf', 'yes')).toThrow(
      'true 或 false',
    )
  })
})
