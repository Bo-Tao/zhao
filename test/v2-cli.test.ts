import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('v2 构建产物', () => {
  it('贯通 ci、tag、info、edit、config 与 doctor', async () => {
    const projectRoot = fileURLToPath(new URL('../', import.meta.url))
    const configDirectory = await mkdtemp(join(tmpdir(), 'zhao-v2-cli-'))
    await cp(join(projectRoot, 'test/fixtures/smoke-config'), configDirectory, {
      recursive: true,
    })
    await rename(
      join(configDirectory, 'config.yaml'),
      join(configDirectory, 'config.yml'),
    )
    await rename(
      join(configDirectory, 'projects.yaml'),
      join(configDirectory, 'projects.yml'),
    )
    const build = spawnSync('pnpm', ['build'], {
      cwd: projectRoot,
      encoding: 'utf8',
    })
    expect(build.status).toBe(0)

    const run = (args: string[], extraEnv: NodeJS.ProcessEnv = {}) =>
      spawnSync(
        process.execPath,
        [join(projectRoot, 'dist/index.mjs'), ...args],
        {
          cwd: projectRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            ZHAO_CONFIG_DIR: configDirectory,
            ZHAO_SHELL_WRAPPED: '1',
            ...extraEnv,
          },
        },
      )

    expect(
      run([
        'config',
        'set',
        'ciTemplates.test',
        'https://build.example.com/{group}/{name}',
      ]).status,
    ).toBe(0)
    expect(run(['ci', 'test', '报告', '--print'])).toMatchObject({
      status: 0,
      stdout: 'https://build.example.com/group/report-web\n',
    })

    const info = run(['info', '报告'])
    expect(info.status).toBe(0)
    expect(info.stdout).toContain('别名: 报告 [手动]')
    expect(info.stdout).toContain('[模板]')

    expect(
      run([
        'tag',
        '报告',
        '--alias',
        '报告站',
        '--kw',
        '报表',
        '--kw',
        'dashboard',
        '--rm-domain',
        'api.report.100tal.com',
      ]).status,
    ).toBe(0)
    const projectsFile = await readFile(
      join(configDirectory, 'projects.yaml'),
      'utf8',
    )
    expect(projectsFile).toContain('报告站')
    expect(projectsFile).toContain('dashboard')
    expect(projectsFile).toContain('api.report.100tal.com')

    expect(run(['edit'], { EDITOR: 'true' }).status).toBe(0)
    const doctor = run(['doctor'])
    expect(doctor.status).toBe(0)
    expect(doctor.stdout).toContain('✓ shell wrapper: 已生效')
    expect(doctor.stdout).toContain('✓ Node.js:')
  })
})
