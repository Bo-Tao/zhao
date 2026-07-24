import { describe, expect, it, vi } from 'vitest'

import { bridgePromptOutput, formatProjectOption } from '../src/ui/prompts.js'

describe('Clack 输出桥接', () => {
  it('stdout 非 TTY 时借用 stderr 的终端尺寸并在结束后恢复', () => {
    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()
    const stdout = {
      write: stdoutWrite,
    }
    const stderr = {
      write: stderrWrite,
      rows: 42,
      columns: 120,
      isTTY: true,
    }

    const restore = bridgePromptOutput(stdout, stderr)

    expect(stdout.write).not.toBe(stdoutWrite)
    stdout.write('prompt')
    expect(stderrWrite).toHaveBeenCalledWith('prompt')
    expect(stdout).toMatchObject({
      rows: 42,
      columns: 120,
      isTTY: true,
    })

    restore()

    expect(stdout.write).toBe(stdoutWrite)
    expect('rows' in stdout).toBe(false)
    expect('columns' in stdout).toBe(false)
    expect('isTTY' in stdout).toBe(false)
  })

  it('stderr 也没有尺寸时使用安全默认值', () => {
    const stdout = { write: vi.fn() }
    const stderr = { write: vi.fn() }

    const restore = bridgePromptOutput(stdout, stderr)

    expect(stdout).toMatchObject({
      rows: 24,
      columns: 80,
    })

    restore()
  })
})

describe('项目选择项', () => {
  it('根据终端宽度截断描述并保持匹配原因在同一行', () => {
    expect(
      formatProjectOption(
        {
          name: 'project',
          description: '这是一个非常长的项目描述',
          path: '/work/project',
        },
        '名称匹配',
        50,
      ),
    ).toEqual({
      label: 'project · 这是一个非…',
      hint: '名称匹配',
    })
  })

  it('不在选择项中显示完整项目路径', () => {
    const option = formatProjectOption(
      {
        name: 'super-classroom-client',
        description:
          'Electron application boilerplate based on React, React Router, Webpack',
        path: '/Users/botao/Work/magic-school/super-classroom-client',
      },
      '自动关键词匹配 react',
      80,
    )

    expect(`${option.label} (${option.hint})`).not.toContain('/Users/')
    expect(option.hint).toBe('自动关键词匹配 react')
  })
})
