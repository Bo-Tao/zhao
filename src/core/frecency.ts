import type { ZhaoState } from './types.js'

const HALF_LIFE_DAYS = 14

export const getFrecencyScore = (
  projectId: string,
  state: ZhaoState,
  now = new Date(),
): number => {
  const entry = state.entries[projectId]
  if (!entry) {
    return 0
  }

  const ageMs = Math.max(0, now.getTime() - Date.parse(entry.lastUsedAt))
  const ageDays = ageMs / 86_400_000
  const decay = 2 ** (-ageDays / HALF_LIFE_DAYS)
  return Math.log2(entry.count + 1) * 8 * decay
}

export const recordProjectUse = (
  state: ZhaoState,
  projectId: string,
  now = new Date(),
): ZhaoState => {
  const previous = state.entries[projectId]
  return {
    version: 1,
    entries: {
      ...state.entries,
      [projectId]: {
        count: (previous?.count ?? 0) + 1,
        lastUsedAt: now.toISOString(),
      },
    },
  }
}
