import { describe, expect, it, vi } from 'vitest'

import { ArgumentError } from '../src/core/argument-error.js'
import {
  detectInstalledProjectOpeners,
  getProjectOpenCommand,
  launchProject,
  PROJECT_OPENERS,
  resolveProjectOpener,
} from '../src/core/project-opener.js'

describe('项目打开工具', () => {
  it('按固定顺序提供截图中的十个工具', () => {
    expect(PROJECT_OPENERS.map((opener) => opener.name)).toEqual([
      'VS Code',
      'Cursor',
      'Zed',
      'Antigravity',
      'Finder',
      'Terminal',
      'iTerm2',
      'Warp',
      'Xcode',
      'Android Studio',
    ])
  })

  it('工具名称和别名忽略大小写', () => {
    expect(resolveProjectOpener('CODE').id).toBe('vscode')
    expect(resolveProjectOpener('iTerm').id).toBe('iterm2')
    expect(resolveProjectOpener('AndroidStudio').id).toBe('android-studio')
  })

  it('未知工具是参数错误并列出可用名称', () => {
    expect(() => resolveProjectOpener('unknown')).toThrow(ArgumentError)
    expect(() => resolveProjectOpener('unknown')).toThrow('未知工具“unknown”')
  })

  it('通过 LaunchServices 检测应用，并保持内置顺序', async () => {
    const runner = vi.fn().mockResolvedValue(
      JSON.stringify([
        ['com.todesktop.230313mzl4w4u92', '/Applications/Cursor.app'],
        ['com.microsoft.VSCode', '/Applications/Visual Studio Code.app'],
        ['dev.zed.Zed', null],
      ]),
    )

    const installed = await detectInstalledProjectOpeners(runner)

    expect(runner).toHaveBeenCalledOnce()
    expect(runner.mock.calls[0]?.[0]).toBe('/usr/bin/osascript')
    expect(runner.mock.calls[0]?.[1]).toContain('com.microsoft.VSCode')
    expect(installed.map((opener) => opener.id)).toEqual(['vscode', 'cursor'])
    expect(installed[0]?.applicationPath).toBe(
      '/Applications/Visual Studio Code.app',
    )
  })

  it('拒绝无法解析的 LaunchServices 输出', async () => {
    await expect(
      detectInstalledProjectOpeners(async () => 'not-json'),
    ).rejects.toThrow('无法解析 macOS 应用检测结果')
  })

  it('为普通应用、终端、Xcode 和 Android Studio 生成安全参数数组', () => {
    const path = '/work/project with spaces'
    const installed = (id: (typeof PROJECT_OPENERS)[number]['id']) => ({
      ...PROJECT_OPENERS.find((opener) => opener.id === id)!,
      applicationPath: `/Applications/${id}.app`,
    })

    expect(getProjectOpenCommand(installed('cursor'), path)).toEqual({
      command: '/usr/bin/open',
      args: ['-b', 'com.todesktop.230313mzl4w4u92', path],
    })
    expect(getProjectOpenCommand(installed('terminal'), path)).toEqual({
      command: '/usr/bin/open',
      args: ['-n', '-b', 'com.apple.Terminal', path],
    })
    expect(getProjectOpenCommand(installed('xcode'), path)).toEqual({
      command: '/usr/bin/xed',
      args: ['--project', path],
    })
    expect(getProjectOpenCommand(installed('android-studio'), path)).toEqual({
      command: '/usr/bin/open',
      args: ['-n', '/Applications/android-studio.app', '--args', path],
    })
  })

  it('启动失败时包含工具名称', async () => {
    const opener = {
      ...PROJECT_OPENERS[1]!,
      applicationPath: '/Applications/Cursor.app',
    }

    await expect(
      launchProject(opener, '/work/repo', async () => {
        throw new Error('exit 1')
      }),
    ).rejects.toThrow('无法使用 Cursor 打开项目：exit 1')
  })
})
