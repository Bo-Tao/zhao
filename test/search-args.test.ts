import { describe, expect, it } from 'vitest'

import { classifyInvocation } from '../src/core/dispatch.js'
import { parseSearchArgs } from '../src/core/search-args.js'

describe('检索热路径参数', () => {
  it('支持 query 与 shell wrapper flags 的任意顺序', () => {
    expect(parseSearchArgs(['--print', '报告', '--claude'])).toEqual({
      query: '报告',
      print: true,
      claude: true,
      codex: false,
      tmux: false,
    })
  })

  it('无 query 时保留全量选择语义', () => {
    expect(parseSearchArgs(['--tmux'])).toEqual({
      query: undefined,
      print: false,
      claude: false,
      codex: false,
      tmux: true,
    })
  })

  it('长短参数具有相同行为', () => {
    expect(parseSearchArgs(['-p', '报告', '-cc', '-t'])).toEqual({
      query: '报告',
      print: true,
      claude: true,
      codex: false,
      tmux: true,
    })
    expect(parseSearchArgs(['项目', '-cdx'])).toEqual({
      query: '项目',
      print: false,
      claude: false,
      codex: true,
      tmux: false,
    })
  })

  it('拒绝同时启动 Claude 和 Codex', () => {
    expect(() => parseSearchArgs(['项目', '--claude', '-cdx'])).toThrow(
      '--claude/-cc 与 --codex/-cdx 不能同时使用',
    )
  })

  it('拒绝未知 flag 和多个 query', () => {
    expect(() => parseSearchArgs(['--unknown'])).toThrow('未知参数')
    expect(() => parseSearchArgs(['one', 'two'])).toThrow('只接受一个 query')
  })
})

describe('入口分发', () => {
  it('将短版本参数分发到管理命令', () => {
    expect(classifyInvocation(['-v'])).toBe('management')
  })

  it('不会把尚未实现的保留命令误当作项目 query', () => {
    expect(classifyInvocation(['tag', 'repo'])).toBe('future-command')
    expect(classifyInvocation(['ci', 'test'])).toBe('future-command')
    expect(classifyInvocation(['report'])).toBe('search')
  })
})
