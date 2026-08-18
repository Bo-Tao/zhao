import { execFile } from 'node:child_process'

import { ArgumentError } from './argument-error.js'

export type ProjectOpenerId =
  | 'vscode'
  | 'cursor'
  | 'zed'
  | 'antigravity'
  | 'finder'
  | 'terminal'
  | 'iterm2'
  | 'warp'
  | 'xcode'
  | 'android-studio'

type ProjectOpenerKind = 'application' | 'terminal' | 'xcode' | 'android-studio'

export interface ProjectOpener {
  id: ProjectOpenerId
  name: string
  bundleId: string
  aliases: readonly string[]
  kind: ProjectOpenerKind
}

export interface InstalledProjectOpener extends ProjectOpener {
  applicationPath: string
}

export type ProjectOpenerRunner = (
  command: string,
  args: readonly string[],
) => Promise<string>

export interface ProjectOpenCommand {
  command: string
  args: string[]
}

export const PROJECT_OPENERS = [
  {
    id: 'vscode',
    name: 'VS Code',
    bundleId: 'com.microsoft.VSCode',
    aliases: ['vscode', 'code'],
    kind: 'application',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    bundleId: 'com.todesktop.230313mzl4w4u92',
    aliases: ['cursor'],
    kind: 'application',
  },
  {
    id: 'zed',
    name: 'Zed',
    bundleId: 'dev.zed.Zed',
    aliases: ['zed'],
    kind: 'application',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    bundleId: 'com.google.antigravity',
    aliases: ['antigravity'],
    kind: 'application',
  },
  {
    id: 'finder',
    name: 'Finder',
    bundleId: 'com.apple.finder',
    aliases: ['finder'],
    kind: 'application',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    bundleId: 'com.apple.Terminal',
    aliases: ['terminal'],
    kind: 'terminal',
  },
  {
    id: 'iterm2',
    name: 'iTerm2',
    bundleId: 'com.googlecode.iterm2',
    aliases: ['iterm', 'iterm2'],
    kind: 'terminal',
  },
  {
    id: 'warp',
    name: 'Warp',
    bundleId: 'dev.warp.Warp-Stable',
    aliases: ['warp'],
    kind: 'terminal',
  },
  {
    id: 'xcode',
    name: 'Xcode',
    bundleId: 'com.apple.dt.Xcode',
    aliases: ['xcode'],
    kind: 'xcode',
  },
  {
    id: 'android-studio',
    name: 'Android Studio',
    bundleId: 'com.google.android.studio',
    aliases: ['android-studio', 'androidstudio'],
    kind: 'android-studio',
  },
] as const satisfies readonly ProjectOpener[]

const DETECT_APPLICATIONS_SCRIPT = `function run(argv) {
  ObjC.import('AppKit')
  return JSON.stringify(argv.map(function (bundleId) {
    var url = $.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier(bundleId)
    return [bundleId, url ? ObjC.unwrap(url.path) : null]
  }))
}`

const runFile: ProjectOpenerRunner = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, [...args], { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    })
  })

export const resolveProjectOpener = (rawValue: string): ProjectOpener => {
  const value = rawValue.trim().toLowerCase()
  const opener = PROJECT_OPENERS.find((item) =>
    item.aliases.some((alias) => alias === value),
  )
  if (opener) {
    return opener
  }

  throw new ArgumentError(
    `未知工具“${rawValue}”。支持：${PROJECT_OPENERS.map((item) => item.id).join('、')}。`,
  )
}

const parseDetectedApplications = (output: string): Map<string, string> => {
  try {
    const entries: unknown = JSON.parse(output)
    if (!Array.isArray(entries)) {
      throw new Error('结果不是数组')
    }

    const applications = new Map<string, string>()
    for (const entry of entries) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string' ||
        (entry[1] !== null && typeof entry[1] !== 'string')
      ) {
        throw new Error('结果条目格式错误')
      }
      if (entry[1]) {
        applications.set(entry[0], entry[1])
      }
    }
    return applications
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法解析 macOS 应用检测结果：${message}`)
  }
}

export const detectInstalledProjectOpeners = async (
  runner: ProjectOpenerRunner = runFile,
): Promise<InstalledProjectOpener[]> => {
  let output: string
  try {
    output = await runner('/usr/bin/osascript', [
      '-l',
      'JavaScript',
      '-e',
      DETECT_APPLICATIONS_SCRIPT,
      ...PROJECT_OPENERS.map((opener) => opener.bundleId),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法检测 macOS 应用：${message}`)
  }

  const applications = parseDetectedApplications(output)
  return PROJECT_OPENERS.flatMap((opener) => {
    const applicationPath = applications.get(opener.bundleId)
    return applicationPath ? [{ ...opener, applicationPath }] : []
  })
}

export const getProjectOpenCommand = (
  opener: InstalledProjectOpener,
  projectPath: string,
): ProjectOpenCommand => {
  if (opener.kind === 'terminal') {
    return {
      command: '/usr/bin/open',
      args: ['-n', '-b', opener.bundleId, projectPath],
    }
  }
  if (opener.kind === 'xcode') {
    return {
      command: '/usr/bin/xed',
      args: ['--project', projectPath],
    }
  }
  if (opener.kind === 'android-studio') {
    return {
      command: '/usr/bin/open',
      args: ['-n', opener.applicationPath, '--args', projectPath],
    }
  }
  return {
    command: '/usr/bin/open',
    args: ['-b', opener.bundleId, projectPath],
  }
}

export const launchProject = async (
  opener: InstalledProjectOpener,
  projectPath: string,
  runner: ProjectOpenerRunner = runFile,
): Promise<void> => {
  const { command, args } = getProjectOpenCommand(opener, projectPath)
  try {
    await runner(command, args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法使用 ${opener.name} 打开项目：${message}`)
  }
}
