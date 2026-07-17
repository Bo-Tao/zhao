import { describe, expect, it } from 'vitest'

import { rankProjects } from '../src/core/rank.js'
import type { MergedProject, ZhaoState } from '../src/core/types.js'

const makeProject = (
  overrides: Partial<MergedProject> & Pick<MergedProject, 'id' | 'name'>,
): MergedProject => ({
  path: `/work/${overrides.name}`,
  remote: `git@git.100tal.com:group/${overrides.name}.git`,
  group: 'group',
  description: '',
  keywords: [],
  manualKeywords: [],
  aliases: [],
  stack: [],
  domains: [],
  links: {},
  scannedAt: '2026-07-16T00:00:00.000Z',
  ...overrides,
})

describe('rankProjects', () => {
  it('页面域名精确匹配优先于 API 域名和名称模糊匹配', () => {
    const results = rankProjects(
      [
        makeProject({
          id: 'page',
          name: 'report-web',
          domains: [
            {
              value: 'report.100tal.com',
              type: 'page',
              confidence: 1,
              source: 'manual',
            },
          ],
        }),
        makeProject({
          id: 'api',
          name: 'api-report',
          domains: [
            {
              value: 'report.100tal.com',
              type: 'api',
              confidence: 0.9,
              source: 'src/api/request.ts',
            },
          ],
        }),
        makeProject({
          id: 'name',
          name: 'report.100tal.com-tools',
        }),
      ],
      'report.100tal.com',
    )

    expect(results.map((item) => item.project.id)).toEqual([
      'page',
      'api',
      'name',
    ])
    expect(results[0]?.reason).toContain('页面域名')
  })

  it('alias 精确匹配优先于普通关键词', () => {
    const results = rankProjects(
      [
        makeProject({
          id: 'alias',
          name: 'registry',
          aliases: ['npm仓'],
        }),
        makeProject({
          id: 'keyword',
          name: 'docs',
          manualKeywords: ['npm仓'],
        }),
      ],
      'npm仓',
    )

    expect(results[0]?.project.id).toBe('alias')
    expect(results[0]?.reason).toContain('别名')
  })

  it('相同文本得分时使用 frecency 提升近期常用项目', () => {
    const state: ZhaoState = {
      version: 1,
      entries: {
        recent: {
          count: 8,
          lastUsedAt: '2026-07-16T00:00:00.000Z',
        },
      },
    }
    const now = new Date('2026-07-16T01:00:00.000Z')

    const results = rankProjects(
      [
        makeProject({ id: 'old', name: 'report-old' }),
        makeProject({ id: 'recent', name: 'report-new' }),
      ],
      'report',
      state,
      now,
    )

    expect(results[0]?.project.id).toBe('recent')
  })

  it('无匹配时不返回项目', () => {
    expect(
      rankProjects([makeProject({ id: 'one', name: 'tal-npm' })], '完全不存在'),
    ).toEqual([])
  })
})
