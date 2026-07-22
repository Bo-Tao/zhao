import { describe, expect, it } from 'vitest'

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
import { applyProjectTags, normalizeTagValues } from '../src/commands/tag.js'
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

describe('list 命令', () => {
  it('--json 输出合并后的完整项目数据', () => {
    const output = formatProjectList([project], true)
    expect(JSON.parse(output)).toEqual([project])
  })

  it('文本列表包含名称、路径和描述', () => {
    expect(formatProjectList([project], false)).toContain(
      'repo\t/work/repo\t报告 H5',
    )
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

    expect(output).toContain('别名: 业务仓 [手动]')
    expect(output).toContain('关键词: report [自动扫描]')
    expect(output).toContain('关键词: 报告 [手动]')
    expect(output).toContain('app.example.com [手动]')
    expect(output).toContain('api.example.com [自动扫描: src/api/client.ts]')
    expect(output).toContain('example.com [猜测: api.example.com]')
    expect(output).toContain(
      'ci-test: https://build.example.com/group/repo [模板]',
    )
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
