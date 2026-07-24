import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

import { readGitRemote } from './gitconfig.js'
import { getRemoteGroup, remoteToProjectId } from './giturl.js'
import type {
  DomainCandidate,
  IndexedProject,
  ManualProjectData,
  ZhaoConfig,
  ZhaoIndex,
  ZhaoProjectsFile,
} from './types.js'

const NOISE_DOMAINS = new Set([
  'localhost',
  'registry.npmjs.org',
  'registry.npmmirror.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdn.100tal.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
])

const DOMAIN_PATTERN =
  /(?<![@\w-])(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(?:[/?#][^\s"'`]*)?/gi

const uniqueBy = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const value = key(item)
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

export const expandHome = (path: string): string =>
  path === '~'
    ? homedir()
    : path.startsWith('~/')
      ? join(homedir(), path.slice(2))
      : resolve(path)

export const extractDomainCandidates = (
  content: string,
  source: string,
  blockedDomains: string[],
): DomainCandidate[] => {
  const blocked = new Set(blockedDomains.map((value) => value.toLowerCase()))
  const domains: DomainCandidate[] = []

  for (const match of content.matchAll(DOMAIN_PATTERN)) {
    const value = match[1]?.toLowerCase()
    if (
      !value ||
      NOISE_DOMAINS.has(value) ||
      blocked.has(value) ||
      value.endsWith('.example.com') ||
      value.endsWith('.example.org')
    ) {
      continue
    }
    domains.push({
      value,
      type: 'api',
      source,
      confidence: 0.9,
    })
    if (value.startsWith('api.')) {
      const guess = value.slice(4)
      if (
        guess.includes('.') &&
        !NOISE_DOMAINS.has(guess) &&
        !blocked.has(guess)
      ) {
        domains.push({
          value: guess,
          type: 'guess',
          source,
          confidence: 0.3,
        })
      }
    }
  }

  return uniqueBy(domains, (domain) => `${domain.type}:${domain.value}`)
}

interface PackageLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export const inferStack = (packageJson: PackageLike): string[] => {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }
  const rules: Array<[string, string, (version: string) => boolean]> = [
    ['react', 'react', () => true],
    ['next', 'next', () => true],
    ['nuxt', 'nuxt', () => true],
    ['vite', 'vite', () => true],
    ['webpack', 'webpack', () => true],
    ['typescript', 'typescript', () => true],
    ['pinia', 'pinia', () => true],
  ]

  const stack: string[] = []
  const vueVersion = dependencies.vue
  if (vueVersion) {
    stack.push(/^[~^]?[3-9]/.test(vueVersion) ? 'vue3' : 'vue2')
  }
  for (const [dependency, label, matches] of rules) {
    const version = dependencies[dependency]
    if (version && matches(version) && !stack.includes(label)) {
      stack.push(label)
    }
  }
  return stack
}

const readJson = async (path: string): Promise<Record<string, unknown>> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

const normalizeDescription = (value: string): string =>
  value.trim().replace(/\s+/g, ' ')

const readDescription = async (
  repositoryRoot: string,
  packageJson: Record<string, unknown>,
): Promise<string> => {
  if (typeof packageJson.description === 'string' && packageJson.description) {
    return normalizeDescription(packageJson.description)
  }
  for (const filename of ['README.md', 'readme.md', 'README.MD']) {
    try {
      const content = await readFile(join(repositoryRoot, filename), 'utf8')
      return normalizeDescription(content.match(/^#\s+(.+)$/m)?.[1] ?? '')
    } catch {
      // 尝试下一个常见文件名。
    }
  }
  return ''
}

const scanDomains = async (
  repositoryRoot: string,
  blockedDomains: string[],
): Promise<DomainCandidate[]> => {
  const { default: fg } = await import('fast-glob')
  const files = await fg(
    [
      '.env*',
      '*.{config,conf}.{js,ts,mjs,cjs,json,yaml,yml}',
      'src/api/**/*.{js,ts,jsx,tsx,vue,json,yaml,yml}',
      'src/config/**/*.{js,ts,json,yaml,yml}',
      'nginx*',
      '**/nginx*.conf',
    ],
    {
      cwd: repositoryRoot,
      onlyFiles: true,
      dot: true,
      unique: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  )
  const candidates = (
    await Promise.all(
      files.slice(0, 200).map(async (file): Promise<DomainCandidate[]> => {
        try {
          const content = await readFile(join(repositoryRoot, file), 'utf8')
          return extractDomainCandidates(
            content.slice(0, 512_000),
            file,
            blockedDomains,
          )
        } catch {
          // 单个不可读文件不应中断整个仓库扫描。
          return []
        }
      }),
    )
  ).flat()
  return uniqueBy(candidates, (domain) => `${domain.type}:${domain.value}`)
}

export const scanProject = async (
  repositoryRoot: string,
  manual: ManualProjectData = {},
  now = new Date(),
  knownRemote?: string,
): Promise<IndexedProject> => {
  const [remote, packageJson] = await Promise.all([
    knownRemote ?? readGitRemote(repositoryRoot),
    readJson(join(repositoryRoot, 'package.json')),
  ])
  const name = basename(repositoryRoot)
  const rawKeywords = Array.isArray(packageJson.keywords)
    ? packageJson.keywords.filter(
        (keyword): keyword is string => typeof keyword === 'string',
      )
    : []
  const stack = inferStack(packageJson as PackageLike)

  return {
    id: remoteToProjectId(remote),
    name,
    path: repositoryRoot,
    remote,
    group: getRemoteGroup(remote),
    description: await readDescription(repositoryRoot, packageJson),
    keywords: uniqueBy([...rawKeywords, ...stack], (keyword) => keyword),
    stack,
    domains: await scanDomains(repositoryRoot, manual.blockedDomains ?? []),
    scannedAt: now.toISOString(),
  }
}

export interface ScanProgress {
  current: number
  total: number
  path: string
}

export const scanRepositories = async (
  config: ZhaoConfig,
  projectsFile: ZhaoProjectsFile,
  onProgress?: (progress: ScanProgress) => void,
  now = new Date(),
): Promise<ZhaoIndex> => {
  const { default: fg } = await import('fast-glob')
  const roots = config.scanRoots.map(expandHome)
  const repositories = new Set<string>()
  const discoveries = await Promise.all(
    roots.map(async (root) => {
      try {
        return await fg('**/.git', {
          cwd: root,
          absolute: true,
          onlyFiles: false,
          onlyDirectories: false,
          dot: true,
          deep: config.scanDepth ?? 5,
          ignore: ['**/node_modules/**', '**/dist/**', '**/.cache/**'],
        })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []
        }
        throw error
      }
    }),
  )
  for (const gitEntries of discoveries) {
    for (const dotGit of gitEntries) {
      repositories.add(dirname(dotGit))
    }
  }

  const paths = [...repositories].sort()
  const projects = new Map<string, IndexedProject>()
  for (const [index, repositoryRoot] of paths.entries()) {
    onProgress?.({
      current: index + 1,
      total: paths.length,
      path: repositoryRoot,
    })
    try {
      const preliminaryRemote = await readGitRemote(repositoryRoot)
      const projectId = remoteToProjectId(preliminaryRemote)
      const project = await scanProject(
        repositoryRoot,
        projectsFile[projectId],
        now,
        preliminaryRemote,
      )
      projects.set(project.id, project)
    } catch {
      // 损坏或无 remote 的仓库不进入索引，扫描继续。
    }
  }

  return {
    version: 1,
    generatedAt: now.toISOString(),
    projects: [...projects.values()],
  }
}
