import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { buildCli } from './helpers/build-cli.js'

describe('monorepo targets 构建产物', () => {
  it('tag 把手动元数据写回父仓库的 target', async () => {
    const { entry, projectRoot, result: build } = buildCli()
    const configDirectory = await mkdtemp(join(tmpdir(), 'zhao-monorepo-cli-'))
    await writeFile(
      join(configDirectory, 'config.yaml'),
      'scanRoots: [/work]\n',
    )
    await writeFile(
      join(configDirectory, 'index.json'),
      `${JSON.stringify(
        {
          version: 1,
          generatedAt: '2026-08-12T00:00:00.000Z',
          projects: [
            {
              id: 'git.example.com/team/platform',
              name: 'platform',
              path: '/work/platform',
              remote: 'git@git.example.com:team/platform.git',
              group: 'team',
              description: '前端平台',
              keywords: ['pnpm'],
              stack: ['typescript'],
              domains: [],
              scannedAt: '2026-08-12T00:00:00.000Z',
            },
          ],
        },
        null,
        2,
      )}\n`,
    )
    await writeFile(
      join(configDirectory, 'projects.yaml'),
      [
        'git.example.com/team/platform:',
        '  targets:',
        '    admin-web:',
        '      name: 运营后台',
        '      path: apps/admin-web',
        '      aliases: [后台]',
        '      links:',
        '        ci-test: https://build.example.com/admin/test',
        '',
      ].join('\n'),
    )
    expect(build.status).toBe(0)

    const tagged = spawnSync(
      process.execPath,
      [entry, 'tag', '运营后台', '--alias', '新后台'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          ZHAO_CONFIG_DIR: configDirectory,
          ZHAO_SHELL_WRAPPED: '1',
        },
      },
    )

    expect(tagged.status).toBe(0)
    const projects = parse(
      await readFile(join(configDirectory, 'projects.yaml'), 'utf8'),
    )
    expect(projects).toEqual({
      'git.example.com/team/platform': {
        targets: {
          'admin-web': {
            name: '运营后台',
            path: 'apps/admin-web',
            aliases: ['后台', '新后台'],
            links: {
              'ci-test': 'https://build.example.com/admin/test',
            },
          },
        },
      },
    })
  })
})
