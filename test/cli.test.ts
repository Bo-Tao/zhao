import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCittyCli } from '../src/cli.js'
import { buildCli } from './helpers/build-cli.js'

const captureStdout = async (rawArgs: string[]): Promise<string> => {
  let output = ''
  vi.spyOn(process.stdout, 'write').mockImplementation(((
    chunk: string | Uint8Array,
  ) => {
    output += String(chunk)
    return true
  }) as typeof process.stdout.write)
  await runCittyCli(rawArgs)
  return output
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CLI 元信息输出', () => {
  it('-v 输出版本号', async () => {
    await expect(captureStdout(['-v'])).resolves.toBe('0.2.0\n')
  })

  it('帮助表格的条目与说明分别左对齐', async () => {
    const output = await captureStdout(['-h'])
    const labels = [
      'QUERY',
      '-p, --print',
      '-cc, --claude',
      '-cdx, --codex',
      '-t, --tmux',
      'init',
      'setup',
      'scan',
      'browse',
      'list',
      'ci',
      'tag',
      'info',
      'edit',
      'config',
      'doctor',
    ]
    const lines = output.split('\n')
    const detailLines = labels.map((label) =>
      lines.find((line) => line.startsWith(`  ${label}`)),
    )

    expect(output).toContain('\nARGUMENTS\n')
    expect(output).toContain('\nOPTIONS\n')
    expect(output).toContain('\nCOMMANDS\n')
    expect(detailLines).toHaveLength(16)
    expect(detailLines.every((line) => line !== undefined)).toBe(true)
    expect(
      new Set(detailLines.map((line) => line?.search(/[\u3400-\u9fff]/))).size,
    ).toBe(1)
  })

  it('browse 和 ci 帮助展示 copy 与 print 的短参数', async () => {
    for (const command of ['browse', 'ci']) {
      const output = await captureStdout([command, '--help'])

      expect(output).toContain('-c, --copy')
      expect(output).toContain('-p, --print')
    }
  })
})

describe('构建产物入口', () => {
  it('Claude 与 Codex 冲突在 onboarding 前以参数错误退出', () => {
    const { entry, result: build } = buildCli()
    const missingHome = join(
      tmpdir(),
      `zhao-missing-home-${process.pid}-${Date.now()}`,
    )

    expect(build.status).toBe(0)

    const result = spawnSync(process.execPath, [entry, '--claude', '--codex'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: missingHome,
        XDG_CONFIG_HOME: join(missingHome, '.config'),
      },
    })

    expect(result.status).toBe(2)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('--claude/-cc 与 --codex/-cdx 不能同时使用')
    expect(result.stderr).not.toContain('未找到')
  })
})
