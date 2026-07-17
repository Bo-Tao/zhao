import { spawnSync } from 'node:child_process'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { getShellWrapper } from '../src/shell/templates.js'
import {
  appendWrapperLine,
  inspectRcFile,
  writeWrapperToRc,
} from '../src/shell/setup.js'

describe('shell wrapper', () => {
  it('只支持 zsh 与 bash', () => {
    expect(getShellWrapper('zsh')).toContain('ZHAO_SHELL_WRAPPED=1')
    expect(getShellWrapper('bash')).toContain('ZHAO_SHELL_WRAPPED=1')
    expect(() => getShellWrapper('fish')).toThrow('仅支持 zsh、bash')
  })

  it('wrapper 将管理命令透传，并在普通检索后 cd', () => {
    const wrapper = getShellWrapper('zsh')

    expect(wrapper).toContain(
      'init|setup|scan|tag|list|info|edit|config|doctor|browse|ci|open|sync',
    )
    expect(wrapper).toContain('command zhao --print')
    expect(wrapper).toContain('cd "$dir"')
    expect(wrapper).toContain('command claude')
    expect(wrapper).toContain('tmux new-window -c "$dir"')
  })

  it.each(['zsh', 'bash'])(
    '%s wrapper 将帮助与版本参数直接透传给 CLI',
    async (shell) => {
      const directory = join(
        tmpdir(),
        `zhao-help-${shell}-${process.pid}-${Date.now()}`,
      )
      const binDirectory = join(directory, 'bin')
      const executable = join(binDirectory, 'zhao')
      await mkdir(binDirectory, { recursive: true })
      await writeFile(executable, '#!/bin/sh\nprintf "%s\\n" "$*"\n', {
        mode: 0o755,
      })

      for (const flag of ['-h', '--help', '-v', '--version']) {
        const result = spawnSync(
          shell,
          ['-c', `${getShellWrapper(shell)}\nzhao ${flag}`],
          {
            cwd: directory,
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
            },
          },
        )

        expect(result.status).toBe(0)
        expect(result.stdout).toBe(`${flag}\n`)
        expect(result.stderr).toBe('')
      }
    },
  )

  it.each(['zsh', 'bash'])('%s wrapper 正确处理项目动作参数', async (shell) => {
    const directory = join(
      tmpdir(),
      `zhao-actions-${shell}-${process.pid}-${Date.now()}`,
    )
    const binDirectory = join(directory, 'bin')
    const projectDirectory = join(directory, 'project with spaces')
    const callLog = join(directory, 'calls.log')
    const query = '项目 查询'
    await mkdir(binDirectory, { recursive: true })
    await mkdir(projectDirectory, { recursive: true })
    await writeFile(callLog, '')

    const runWrapper = (command: string, tmux = '') =>
      spawnSync(shell, ['-c', `${getShellWrapper(shell)}\n${command}`], {
        cwd: directory,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
          TMUX: tmux,
          ZHAO_TEST_PROJECT: projectDirectory,
          ZHAO_TEST_LOG: callLog,
        },
      })
    const getCalls = () => readFile(callLog, 'utf8')
    const resetCalls = () => writeFile(callLog, '')
    const zhaoCall = `zhao:[--print]:[${query}]\n`

    await writeFile(
      join(binDirectory, 'zhao'),
      [
        '#!/bin/sh',
        'printf \'zhao\' >> "$ZHAO_TEST_LOG"',
        'for arg in "$@"; do',
        '  printf \':[%s]\' "$arg" >> "$ZHAO_TEST_LOG"',
        'done',
        'printf \'\\n\' >> "$ZHAO_TEST_LOG"',
        'printf \'%s\\n\' "$ZHAO_TEST_PROJECT"',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )
    for (const editor of ['claude', 'codex']) {
      await writeFile(
        join(binDirectory, editor),
        [
          '#!/bin/sh',
          `printf '${editor}:%s\\n' "$PWD" >> "$ZHAO_TEST_LOG"`,
          `printf '${editor}:%s\\n' "$PWD"`,
          '',
        ].join('\n'),
        { mode: 0o755 },
      )
    }
    await writeFile(
      join(binDirectory, 'tmux'),
      [
        '#!/bin/sh',
        'for arg in "$@"; do',
        '  printf \'tmux:[%s]\\n\' "$arg" >> "$ZHAO_TEST_LOG"',
        '  printf \'tmux:[%s]\\n\' "$arg"',
        'done',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )

    for (const flag of ['-p', '--print']) {
      await resetCalls()
      const result = runWrapper(
        `before=$PWD; zhao "${query}" ${flag}; exit_code=$?; [ "$PWD" = "$before" ] && printf 'cwd-unchanged\\n'; exit "$exit_code"`,
      )

      expect(result).toMatchObject({
        status: 0,
        stdout: `${projectDirectory}\ncwd-unchanged\n`,
        stderr: '',
      })
      expect(await getCalls()).toBe(zhaoCall)
    }

    for (const [flag, editor] of [
      ['-cc', 'claude'],
      ['--codex', 'codex'],
    ]) {
      await resetCalls()
      const result = runWrapper(`zhao "${query}" ${flag}`)

      expect(result).toMatchObject({
        status: 0,
        stdout: `${editor}:${projectDirectory}\n`,
        stderr: '',
      })
      expect(await getCalls()).toBe(
        `${zhaoCall}${editor}:${projectDirectory}\n`,
      )
    }

    for (const [flags, editor] of [
      ['-cc --tmux', 'claude'],
      ['--tmux -cdx', 'codex'],
    ]) {
      await resetCalls()
      const result = runWrapper(`zhao "${query}" ${flags}`)

      expect(result).toMatchObject({
        status: 0,
        stdout: `tmux:[new-session]\ntmux:[-c]\ntmux:[${projectDirectory}]\ntmux:[${editor}]\n`,
        stderr: '',
      })
      expect(await getCalls()).toBe(
        `${zhaoCall}tmux:[new-session]\ntmux:[-c]\ntmux:[${projectDirectory}]\ntmux:[${editor}]\n`,
      )
    }

    for (const [flags, expectedOutput, expectedCalls] of [
      [
        '-cc --claude',
        `claude:${projectDirectory}\n`,
        `${zhaoCall}claude:${projectDirectory}\n`,
      ],
      [
        '--claude -cc',
        `claude:${projectDirectory}\n`,
        `${zhaoCall}claude:${projectDirectory}\n`,
      ],
      [
        '-cdx --codex',
        `codex:${projectDirectory}\n`,
        `${zhaoCall}codex:${projectDirectory}\n`,
      ],
      [
        '--codex -cdx',
        `codex:${projectDirectory}\n`,
        `${zhaoCall}codex:${projectDirectory}\n`,
      ],
      [
        '-t --tmux',
        `tmux:[new-session]\ntmux:[-c]\ntmux:[${projectDirectory}]\n`,
        `${zhaoCall}tmux:[new-session]\ntmux:[-c]\ntmux:[${projectDirectory}]\n`,
      ],
      [
        '--tmux -t',
        `tmux:[new-session]\ntmux:[-c]\ntmux:[${projectDirectory}]\n`,
        `${zhaoCall}tmux:[new-session]\ntmux:[-c]\ntmux:[${projectDirectory}]\n`,
      ],
      ['-p --print', `${projectDirectory}\n`, zhaoCall],
      ['--print -p', `${projectDirectory}\n`, zhaoCall],
    ]) {
      await resetCalls()
      const result = runWrapper(`zhao "${query}" ${flags}`)

      expect(result).toMatchObject({
        status: 0,
        stdout: expectedOutput,
        stderr: '',
      })
      expect(await getCalls()).toBe(expectedCalls)
    }

    await resetCalls()
    const insideTmux = runWrapper(
      `zhao "${query}" -t -cc`,
      '/private/tmp/tmux-test/default,1,0',
    )
    expect(insideTmux).toMatchObject({
      status: 0,
      stdout: `tmux:[new-window]\ntmux:[-c]\ntmux:[${projectDirectory}]\ntmux:[claude]\n`,
      stderr: '',
    })
    expect(await getCalls()).toBe(
      `${zhaoCall}tmux:[new-window]\ntmux:[-c]\ntmux:[${projectDirectory}]\ntmux:[claude]\n`,
    )

    await resetCalls()
    const conflict = runWrapper(`zhao "${query}" -cc --codex`)
    expect(conflict.status).toBe(2)
    expect(conflict.stdout).toBe('')
    expect(conflict.stderr).toContain(
      '--claude/-cc 与 --codex/-cdx 不能同时使用',
    )
    expect(await getCalls()).toBe('')
  })

  it('追加 wrapper 配置是幂等的', () => {
    const line = 'eval "$(zhao init zsh)"'

    expect(appendWrapperLine('', line)).toBe(`${line}\n`)
    expect(appendWrapperLine(`${line}\n`, line)).toBe(`${line}\n`)
    expect(appendWrapperLine('export FOO=1', line)).toBe(
      `export FOO=1\n${line}\n`,
    )
  })

  it('真实 rc 文件重复安装时只写入一次', async ({ task }) => {
    const directory = join(tmpdir(), `zhao-shell-${task.id}-${Date.now()}`)
    const rcFile = join(directory, '.zshrc')
    await mkdir(directory, { recursive: true })
    await writeFile(rcFile, 'export FOO=1\n')

    await expect(writeWrapperToRc(rcFile, 'zsh')).resolves.toMatchObject({
      changed: true,
    })
    await expect(writeWrapperToRc(rcFile, 'zsh')).resolves.toMatchObject({
      changed: false,
    })
    expect(
      (await readFile(rcFile, 'utf8')).match(/zhao init zsh/g),
    ).toHaveLength(1)
  })

  it('能识别由 dotfiles 管理的符号链接 rc 文件', async ({ task }) => {
    const directory = join(tmpdir(), `zhao-symlink-${task.id}-${Date.now()}`)
    const target = join(directory, 'zshrc')
    const rcFile = join(directory, '.zshrc')
    await mkdir(directory, { recursive: true })
    await writeFile(target, 'export FOO=1\n')
    await symlink(target, rcFile)

    await expect(inspectRcFile(rcFile)).resolves.toMatchObject({
      path: rcFile,
      isSymbolicLink: true,
      content: 'export FOO=1\n',
    })
  })
})
