import { openInEditor } from '../core/editor.js'
import {
  getStorePaths,
  loadProjectsFile,
  saveProjectsFile,
} from '../core/store.js'
import { ensureOnboarded } from '../middleware/onboard.js'
import type { DefineCommand } from './types.js'

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'edit',
      description: '用 $EDITOR 打开 projects.yaml',
    },
    async run() {
      await ensureOnboarded({ ensureIndex: false, scanAfterConfig: false })
      const paths = getStorePaths()
      const projects = await loadProjectsFile(paths)
      await saveProjectsFile(projects, paths)
      await openInEditor(paths.projects)
    },
  })
