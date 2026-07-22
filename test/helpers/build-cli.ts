import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { onTestFinished } from 'vitest'

export const buildCli = () => {
  const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
  const buildDirectory = mkdtempSync(
    join(projectRoot, 'node_modules/.zhao-test-build-'),
  )
  onTestFinished(() => {
    rmSync(buildDirectory, { recursive: true, force: true })
  })

  return {
    entry: join(buildDirectory, 'index.mjs'),
    projectRoot,
    result: spawnSync('pnpm', ['build', '--out-dir', buildDirectory], {
      cwd: projectRoot,
      encoding: 'utf8',
    }),
  }
}
