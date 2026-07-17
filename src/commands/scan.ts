import { ensureOnboarded, scanAndSave } from '../middleware/onboard.js'
import type { DefineCommand } from './types.js'

export default (defineCommand: DefineCommand) =>
  defineCommand({
    meta: {
      name: 'scan',
      description: '扫描本地 Git 仓库并重建索引',
    },
    async run() {
      await ensureOnboarded({
        ensureIndex: false,
        scanAfterConfig: false,
      })
      await scanAndSave()
    },
  })
