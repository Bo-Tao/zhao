import { recordProjectUse } from './frecency.js'
import { resolveProject } from './resolver.js'
import {
  getStorePaths,
  loadMergedProjects,
  loadRuntimePreferences,
  loadState,
  saveState,
} from './store.js'
import type { MergedProject } from './types.js'
import { selectProject } from '../ui/select.js'

export const resolveStoredProject = async (
  query?: string,
): Promise<MergedProject> => {
  const paths = getStorePaths()
  const [preferences, loaded] = await Promise.all([
    loadRuntimePreferences(paths),
    loadMergedProjects(paths),
  ])
  if (!preferences) {
    throw new Error('config.yml 不存在，请先运行 zhao 完成首次配置。')
  }
  if (loaded.indexIssue) {
    throw new Error(`${loaded.indexIssue}，请运行 zhao scan 重建。`)
  }

  return resolveProject(query, {
    projects: loaded.projects,
    state: loaded.state,
    selectProject: (projects) => selectProject(projects, preferences.useFzf),
    recordUse: async (projectId) => {
      const current = await loadState(paths)
      await saveState(recordProjectUse(current, projectId), paths)
    },
  })
}
