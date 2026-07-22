import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCittyCli } from '../src/cli.js'

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
    await expect(captureStdout(['-v'])).resolves.toBe('0.1.0\n')
  })

  it('帮助表格的条目与说明分别左对齐', async () => {
    const output = await captureStdout(['-h'])
    const detailLines = output
      .split('\n')
      .filter((line) => line.trimStart().startsWith('`'))

    expect(output).toContain('\nARGUMENTS\n')
    expect(output).toContain('\nOPTIONS\n')
    expect(output).toContain('\nCOMMANDS\n')
    expect(output).toContain('`-p, --print`')
    expect(output).toContain('`-cc, --claude`')
    expect(output).toContain('`-cdx, --codex`')
    expect(output).toContain('`-t, --tmux`')
    for (const command of ['ci', 'tag', 'info', 'edit', 'config', 'doctor']) {
      expect(output).toContain(`\`${command}\``)
    }
    expect(detailLines).toHaveLength(16)
    expect(detailLines.every((line) => line.startsWith('`'))).toBe(true)
    expect(
      new Set(detailLines.map((line) => line.search(/[\u3400-\u9fff]/))).size,
    ).toBe(1)
  })
})

describe('构建产物入口', () => {
  it('Claude 与 Codex 冲突在 onboarding 前以参数错误退出', () => {
    const projectRoot = fileURLToPath(new URL('../', import.meta.url))
    const build = spawnSync('pnpm', ['build'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    const entry = join(projectRoot, 'dist', 'index.mjs')
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
