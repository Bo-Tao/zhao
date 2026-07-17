export type DomainType = 'api' | 'page' | 'guess'

export interface DomainCandidate {
  value: string
  type: DomainType
  source: string
  confidence: number
}

export interface IndexedProject {
  id: string
  name: string
  path: string
  remote: string
  group: string
  description: string
  keywords: string[]
  stack: string[]
  domains: DomainCandidate[]
  scannedAt: string
}

export interface ZhaoIndex {
  version: 1
  generatedAt: string
  projects: IndexedProject[]
}

export interface ManualDomain {
  value: string
  type: DomainType
}

export interface ManualProjectData {
  aliases?: string[]
  domains?: ManualDomain[]
  keywords?: string[]
  links?: Record<string, string>
  blockedDomains?: string[]
}

export type ZhaoProjectsFile = Record<string, ManualProjectData>

export interface ZhaoConfig {
  scanRoots: string[]
  ciTemplates?: {
    test?: string
    prod?: string
  }
  useFzf?: boolean
  scanDepth?: number
}

export interface FrecencyEntry {
  count: number
  lastUsedAt: string
}

export interface ZhaoState {
  version: 1
  entries: Record<string, FrecencyEntry>
}

export interface MergedProject extends IndexedProject {
  aliases: string[]
  manualKeywords: string[]
  links: Record<string, string>
}

export interface RankedProject {
  project: MergedProject
  score: number
  reason: string
}
