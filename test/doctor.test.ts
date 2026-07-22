import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { runDoctorChecks } from '../src/commands/doctor.js'
import { getStorePaths, saveConfig, saveIndex } from '../src/core/store.js'

describe('doctor 命令', () => {
  it('一次报告 wrapper、配置、索引新鲜度、扫描目录与 Node 版本', async ({
    task,
  }) => {
    const directory = join(tmpdir(), `zhao-doctor-${task.id}-${Date.now()}`)
    const existingRoot = join(directory, 'projects')
    const paths = getStorePaths(directory)
    await mkdir(existingRoot, { recursive: true })
    await saveConfig(
      {
        scanRoots: [existingRoot, join(directory, 'missing')],
      },
      paths,
    )
    await saveIndex(
      {
        version: 1,
        generatedAt: '2026-07-01T00:00:00.000Z',
        projects: [],
      },
      paths,
    )

    const checks = await runDoctorChecks({
      paths,
      env: { ZHAO_SHELL_WRAPPED: '1' },
      nodeVersion: '20.10.0',
      now: new Date('2026-07-18T00:00:00.000Z'),
      maxIndexAgeDays: 7,
    })

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'shell wrapper', status: 'pass' }),
        expect.objectContaining({ name: 'config.yaml', status: 'pass' }),
        expect.objectContaining({ name: 'index.json', status: 'pass' }),
        expect.objectContaining({ name: '索引新鲜度', status: 'warning' }),
        expect.objectContaining({ name: existingRoot, status: 'pass' }),
        expect.objectContaining({
          name: join(directory, 'missing'),
          status: 'fail',
        }),
        expect.objectContaining({ name: 'Node.js', status: 'pass' }),
      ]),
    )
  })

  it('配置迁移冲突时继续运行其他诊断', async ({ task }) => {
    const directory = join(
      tmpdir(),
      `zhao-doctor-conflict-${task.id}-${Date.now()}`,
    )
    const paths = getStorePaths(directory)
    await mkdir(directory, { recursive: true })
    await writeFile(paths.config, 'scanRoots: []\n')
    await writeFile(join(directory, 'config.yml'), 'scanRoots: [legacy]\n')

    const checks = await runDoctorChecks({
      paths,
      env: { ZHAO_SHELL_WRAPPED: '1' },
      nodeVersion: '20.10.0',
    })

    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'YAML 配置迁移',
          status: 'fail',
        }),
        expect.objectContaining({ name: 'config.yaml', status: 'pass' }),
        expect.objectContaining({ name: 'Node.js', status: 'pass' }),
      ]),
    )
  })
})
