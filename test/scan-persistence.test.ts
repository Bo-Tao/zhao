import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import type { ZhaoIndex, ZhaoProjectsFile } from '../src/core/types.js'
import { buildCli } from './helpers/build-cli.js'

const createRepository = async (
  root: string,
  name: string,
  remote: string,
): Promise<string> => {
  const repository = join(root, name)
  await mkdir(join(repository, '.git'), { recursive: true })
  await writeFile(
    join(repository, '.git', 'config'),
    `[remote "origin"]\n  url = ${remote}\n`,
  )
  await writeFile(
    join(repository, 'package.json'),
    JSON.stringify({
      name: `@workspace/${name}-package`,
      description: `${name} description`,
    }),
  )
  return repository
}

describe('zhao scan 持久化', () => {
  const emptyProjectData = {
    aliases: [],
    domains: [],
    keywords: [],
    links: {
      'ci-test': '',
      'ci-prod': '',
    },
  }

  it('同步规范化项目 key，并在后续扫描保留元数据、补充新项目', async () => {
    const { entry, projectRoot, result: build } = buildCli()
    const workspace = await mkdtemp(join(tmpdir(), 'zhao-scan-cli-'))
    const configDirectory = join(workspace, 'config')
    const repositories = join(workspace, 'repositories')
    await mkdir(configDirectory, { recursive: true })
    await createRepository(
      repositories,
      'report-web',
      'git@git.example.com:team/report-web.git',
    )
    await writeFile(
      join(configDirectory, 'config.yaml'),
      JSON.stringify({ scanRoots: [repositories] }),
    )
    expect(build.status).toBe(0)

    const runScan = () =>
      spawnSync(process.execPath, [entry, 'scan'], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          ZHAO_CONFIG_DIR: configDirectory,
          ZHAO_SHELL_WRAPPED: '1',
        },
      })

    const firstScan = runScan()
    expect(firstScan.status).toBe(0)

    const firstIndex = JSON.parse(
      await readFile(join(configDirectory, 'index.json'), 'utf8'),
    ) as ZhaoIndex
    const firstProjects = parse(
      await readFile(join(configDirectory, 'projects.yaml'), 'utf8'),
    ) as ZhaoProjectsFile
    expect(firstIndex.projects).toMatchObject([
      {
        id: 'git.example.com/team/report-web',
        name: 'report-web',
      },
    ])
    expect(firstProjects).toEqual({
      'git.example.com/team/report-web': emptyProjectData,
    })

    await writeFile(
      join(configDirectory, 'projects.yaml'),
      [
        'git.example.com/team/report-web:',
        '  aliases:',
        '    - 报告站',
        '  blockedDomains:',
        '    - blocked.example.com',
        '',
      ].join('\n'),
    )
    await createRepository(
      repositories,
      'service-api',
      'https://github.com/acme/service-api.git',
    )

    const secondScan = runScan()
    expect(secondScan.status).toBe(0)

    const secondIndex = JSON.parse(
      await readFile(join(configDirectory, 'index.json'), 'utf8'),
    ) as ZhaoIndex
    const secondProjects = parse(
      await readFile(join(configDirectory, 'projects.yaml'), 'utf8'),
    ) as ZhaoProjectsFile
    expect(secondIndex.projects.map((project) => project.id).sort()).toEqual([
      'git.example.com/team/report-web',
      'github.com/acme/service-api',
    ])
    expect(secondProjects).toEqual({
      'git.example.com/team/report-web': {
        aliases: ['报告站'],
        blockedDomains: ['blocked.example.com'],
      },
      'github.com/acme/service-api': emptyProjectData,
    })
  })
})
