import { resolveStoredProject } from '../core/runtime.js'
import {
  getStorePaths,
  loadProjectsFile,
  saveProjectsFile,
} from '../core/store.js'
import type { ManualProjectData } from '../core/types.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import type { DefineCommand } from './types.js'

type RawTagValue = string | string[] | undefined

export interface ProjectTags {
  aliases: string[]
  domains: string[]
  keywords: string[]
  removedDomains: string[]
}

const unique = <T>(values: T[]): T[] => [...new Set(values)]

export const normalizeTagValues = (value: RawTagValue): string[] =>
  unique(
    (Array.isArray(value) ? value : value === undefined ? [] : [value])
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter(Boolean),
  )

export const applyProjectTags = (
  current: ManualProjectData,
  tags: ProjectTags,
): ManualProjectData => {
  const result: ManualProjectData = { ...current }
  if (tags.aliases.length > 0) {
    result.aliases = unique([...(current.aliases ?? []), ...tags.aliases])
  }
  if (tags.keywords.length > 0) {
    result.keywords = unique([...(current.keywords ?? []), ...tags.keywords])
  }
  if (tags.domains.length > 0) {
    const domains = [
      ...(current.domains ?? []),
      ...tags.domains.map((value) => ({ value, type: 'page' as const })),
    ]
    result.domains = domains.filter(
      (domain, index) =>
        domains.findIndex(
          (item) => item.value.toLowerCase() === domain.value.toLowerCase(),
        ) === index,
    )
  }
  if (tags.removedDomains.length > 0) {
    result.blockedDomains = unique([
      ...(current.blockedDomains ?? []),
      ...tags.removedDomains,
    ])
  }
  return result
}

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'tag',
      description: '为项目录入别名、域名和关键词',
    },
    args: {
      project: {
        type: 'positional',
        description: '项目查询',
        required: true,
      },
      domain: {
        type: 'string',
        description: '添加页面域名，可重复或用逗号分隔',
      },
      kw: {
        type: 'string',
        description: '添加关键词，可重复或用逗号分隔',
      },
      alias: {
        type: 'string',
        description: '添加别名，可重复或用逗号分隔',
      },
      rmDomain: {
        type: 'string',
        description: '拉黑自动扫描域名，可重复或用逗号分隔',
      },
    },
    async run({ args }) {
      const tags: ProjectTags = {
        aliases: normalizeTagValues(args.alias as RawTagValue),
        domains: normalizeTagValues(args.domain as RawTagValue),
        keywords: normalizeTagValues(args.kw as RawTagValue),
        removedDomains: normalizeTagValues(args.rmDomain as RawTagValue),
      }
      if (Object.values(tags).every((values) => values.length === 0)) {
        throw new Error(
          '请至少提供 --domain、--kw、--alias 或 --rm-domain 中的一项。',
        )
      }

      await ensureOnboarded()
      const project = await resolveStoredProject(args.project)
      const paths = getStorePaths()
      const projectsFile = await loadProjectsFile(paths)
      projectsFile[project.id] = applyProjectTags(
        projectsFile[project.id] ?? {},
        tags,
      )
      await saveProjectsFile(projectsFile, paths)
      process.stderr.write(`已更新 ${project.name} 的手动元数据。\n`)
    },
  })
