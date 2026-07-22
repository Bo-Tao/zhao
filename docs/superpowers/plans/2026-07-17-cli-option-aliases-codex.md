# CLI Option Aliases and Codex Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `--print`、`--claude`、`--tmux` 增加短参数，并新增 `--codex/-cdx` 在选中项目后启动 Codex。

**Architecture:** Node CLI 与 Shell wrapper 两层都显式识别长短参数。Node 层负责参数验证、项目解析和纯路径输出；wrapper 负责打印路径、切换目录以及启动 Claude、Codex 或 tmux，并在 Claude/Codex 冲突时提前失败。

**Tech Stack:** TypeScript、citty 0.1.6、zsh/bash、Vitest、tsdown。

## Global Constraints

- 产物保持单文件 ESM，tsdown target 为 `node18`。
- Node 代码只使用 `node:` 前缀标准模块，不引入 Bun 独有 API。
- Shell wrapper 只支持 zsh 与 bash，不增加 fish 支持。
- Node 检索成功时 stdout 只包含项目路径；交互提示继续走 stderr。
- `--claude/-cc` 与 `--codex/-cdx` 同时出现必须报错并返回非零状态。
- `--tmux/-t` 与编辑器参数同时出现时保持 tmux 优先，不启动编辑器。
- 同一布尔选项的长短形式重复出现不报错。

---

### Task 1: Node 参数别名、Codex 标记与冲突校验

**Files:**

- Modify: `src/core/search-args.ts:1-40`
- Modify: `src/cli.ts:8-42`
- Modify: `test/search-args.test.ts:6-31`
- Modify: `test/cli.test.ts:21-45`

**Interfaces:**

- Consumes: `parseSearchArgs(rawArgs: string[]): SearchArgs` 与 citty 根命令的 `searchArgs` 定义。
- Produces: `SearchArgs` 新增 `codex: boolean`；四组长短参数在直接 Node 调用和帮助页中保持一致。

- [ ] **Step 1: 写参数解析失败测试**

将 `test/search-args.test.ts` 的现有期望补上 `codex: false`，并增加：

```ts
it('长短参数具有相同行为', () => {
  expect(parseSearchArgs(['-p', '报告', '-cc', '-t'])).toEqual({
    query: '报告',
    print: true,
    claude: true,
    codex: false,
    tmux: true,
  })
  expect(parseSearchArgs(['项目', '-cdx'])).toEqual({
    query: '项目',
    print: false,
    claude: false,
    codex: true,
    tmux: false,
  })
})

it('拒绝同时启动 Claude 和 Codex', () => {
  expect(() => parseSearchArgs(['项目', '--claude', '-cdx'])).toThrow(
    '--claude/-cc 与 --codex/-cdx 不能同时使用',
  )
})
```

- [ ] **Step 2: 运行参数测试并确认红灯**

Run: `./node_modules/.bin/vitest run test/search-args.test.ts`

Expected: FAIL，原因是 `-p` 仍为未知参数且 `SearchArgs` 没有 `codex` 字段。

- [ ] **Step 3: 写帮助页失败测试**

在 `test/cli.test.ts` 的帮助测试中增加：

```ts
expect(output).toContain('`-p, --print`')
expect(output).toContain('`-cc, --claude`')
expect(output).toContain('`-cdx, --codex`')
expect(output).toContain('`-t, --tmux`')
```

- [ ] **Step 4: 运行帮助测试并确认红灯**

Run: `./node_modules/.bin/vitest run test/cli.test.ts`

Expected: FAIL，帮助输出中不存在短参数和 Codex 选项。

- [ ] **Step 5: 实现最小 Node 参数支持**

在 `src/core/search-args.ts` 中扩展接口、默认值和解析分支：

```ts
export interface SearchArgs {
  query?: string
  print: boolean
  claude: boolean
  codex: boolean
  tmux: boolean
}

const result: SearchArgs = {
  query: undefined,
  print: false,
  claude: false,
  codex: false,
  tmux: false,
}

if (argument === '--print' || argument === '-p') {
  result.print = true
} else if (argument === '--claude' || argument === '-cc') {
  result.claude = true
} else if (argument === '--codex' || argument === '-cdx') {
  result.codex = true
} else if (argument === '--tmux' || argument === '-t') {
  result.tmux = true
}
```

在位置参数校验前增加：

```ts
if (result.claude && result.codex) {
  throw new Error('--claude/-cc 与 --codex/-cdx 不能同时使用。')
}
```

在 `src/cli.ts` 的 citty 参数定义中加入别名和 Codex：

```ts
print: {
  type: "boolean" as const,
  alias: ["p"],
  description: "仅打印选中的项目路径",
  default: false,
},
claude: {
  type: "boolean" as const,
  alias: ["cc"],
  description: "由 shell wrapper 在 cd 后启动 Claude Code",
  default: false,
},
codex: {
  type: "boolean" as const,
  alias: ["cdx"],
  description: "由 shell wrapper 在 cd 后启动 Codex",
  default: false,
},
tmux: {
  type: "boolean" as const,
  alias: ["t"],
  description: "由 shell wrapper 在 tmux 新窗口中打开",
  default: false,
},
```

- [ ] **Step 6: 运行 Node 层测试与类型检查**

Run: `./node_modules/.bin/vitest run test/search-args.test.ts test/cli.test.ts`

Expected: PASS。

Run: `./node_modules/.bin/tsc --noEmit`

Expected: exit 0。

- [ ] **Step 7: 提交 Node 参数支持**

```bash
git add src/core/search-args.ts src/cli.ts test/search-args.test.ts test/cli.test.ts
git commit -m "feat(cli): add option aliases and Codex flag"
```

### Task 2: Shell wrapper 动作与真实 Shell 验证

**Files:**

- Modify: `src/shell/templates.ts:3-92`
- Modify: `test/shell.test.ts:15-105`

**Interfaces:**

- Consumes: Node CLI 的纯路径协议 `command zhao --print <query>`。
- Produces: zsh/bash 中一致的 `-p/-cc/-cdx/-t` 后处理行为，并输出明确的 Claude/Codex 冲突错误。

- [ ] **Step 1: 写 wrapper 行为失败测试**

在 `test/shell.test.ts` 中为 zsh 与 bash 创建临时 `zhao`、`claude`、`codex`、`tmux` 可执行文件。测试脚本使用如下内容：

```ts
const directory = join(
  tmpdir(),
  `zhao-actions-${shell}-${process.pid}-${Date.now()}`,
)
const binDirectory = join(directory, 'bin')
const projectDirectory = join(directory, 'project')
await mkdir(binDirectory, { recursive: true })
await mkdir(projectDirectory, { recursive: true })

const runWrapper = (
  shell: string,
  command: string,
  directory: string,
  binDirectory: string,
  projectDirectory: string,
) =>
  spawnSync(shell, ['-c', `${getShellWrapper(shell)}\n${command}`], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      ZHAO_TEST_PROJECT: projectDirectory,
    },
  })

await writeFile(
  join(binDirectory, 'zhao'),
  '#!/bin/sh\nprintf "%s\\n" "$ZHAO_TEST_PROJECT"\n',
  { mode: 0o755 },
)
for (const editor of ['claude', 'codex']) {
  await writeFile(
    join(binDirectory, editor),
    `#!/bin/sh\nprintf "${editor}:%s\\n" "$PWD"\n`,
    { mode: 0o755 },
  )
}
await writeFile(
  join(binDirectory, 'tmux'),
  '#!/bin/sh\nprintf "tmux:%s\\n" "$*"\n',
  { mode: 0o755 },
)
```

对每种 shell 断言：

```ts
for (const flag of ['-p', '--print']) {
  expect(
    runWrapper(
      shell,
      `zhao 项目 ${flag}`,
      directory,
      binDirectory,
      projectDirectory,
    ),
  ).toMatchObject({
    status: 0,
    stdout: `${projectDirectory}\n`,
    stderr: '',
  })
}
expect(
  runWrapper(shell, 'zhao 项目 -cc', directory, binDirectory, projectDirectory)
    .stdout,
).toBe(`claude:${projectDirectory}\n`)
expect(
  runWrapper(shell, 'zhao 项目 -cdx', directory, binDirectory, projectDirectory)
    .stdout,
).toBe(`codex:${projectDirectory}\n`)
expect(
  runWrapper(shell, 'zhao 项目 -t', directory, binDirectory, projectDirectory)
    .stdout,
).toBe(`tmux:new-window -c ${projectDirectory}\n`)
const conflict = runWrapper(
  shell,
  'zhao 项目 -cc --codex',
  directory,
  binDirectory,
  projectDirectory,
)
expect(conflict.status).not.toBe(0)
expect(conflict.stderr).toContain('--claude/-cc 与 --codex/-cdx 不能同时使用')
```

- [ ] **Step 2: 运行 wrapper 测试并确认红灯**

Run: `./node_modules/.bin/vitest run test/shell.test.ts`

Expected: FAIL，短参数被传给底层检索，Codex 不会启动，`-p` 不会打印路径。

- [ ] **Step 3: 实现 zsh wrapper**

在 `src/shell/templates.ts` 的 zsh 模板中增加状态变量和参数分支：

```zsh
local use_print=0
local use_claude=0
local use_codex=0
local use_tmux=0

case "$arg" in
  -h|--help|-v|--version)
    command zhao "$@"
    return
    ;;
  -p|--print) use_print=1 ;;
  -cc|--claude) use_claude=1 ;;
  -cdx|--codex) use_codex=1 ;;
  -t|--tmux) use_tmux=1 ;;
  *) args+=("$arg") ;;
esac
```

在项目解析前校验冲突：

```zsh
if [[ "$use_claude" -eq 1 && "$use_codex" -eq 1 ]]; then
  printf '%s\n' '错误：--claude/-cc 与 --codex/-cdx 不能同时使用。' >&2
  return 2
fi
```

在获得 `dir` 后按顺序处理：

```zsh
if [[ "$use_print" -eq 1 ]]; then
  printf '%s\n' "$dir"
  return
fi

if [[ "$use_tmux" -eq 1 ]]; then
  tmux new-window -c "$dir"
  return
fi

cd "$dir" || return
if [[ "$use_claude" -eq 1 ]]; then
  command claude
elif [[ "$use_codex" -eq 1 ]]; then
  command codex
fi
```

- [ ] **Step 4: 将相同行为实现到 bash wrapper**

bash 模板保留数组初始化，并写入完整参数分支：

```bash
local use_print=0
local use_claude=0
local use_codex=0
local use_tmux=0
local -a args=()
local arg
for arg in "$@"; do
  case "$arg" in
    -h|--help|-v|--version)
      command zhao "$@"
      return
      ;;
    -p|--print) use_print=1 ;;
    -cc|--claude) use_claude=1 ;;
    -cdx|--codex) use_codex=1 ;;
    -t|--tmux) use_tmux=1 ;;
    *) args+=("$arg") ;;
  esac
done

if [[ "$use_claude" -eq 1 && "$use_codex" -eq 1 ]]; then
  printf '%s\n' '错误：--claude/-cc 与 --codex/-cdx 不能同时使用。' >&2
  return 2
fi

local dir
dir="$(command zhao --print "\${args[@]}")" || return
[[ -z "$dir" ]] && return

if [[ "$use_print" -eq 1 ]]; then
  printf '%s\n' "$dir"
  return
fi
if [[ "$use_tmux" -eq 1 ]]; then
  tmux new-window -c "$dir"
  return
fi

cd "$dir" || return
if [[ "$use_claude" -eq 1 ]]; then
  command claude
elif [[ "$use_codex" -eq 1 ]]; then
  command codex
fi
```

- [ ] **Step 5: 运行 wrapper 测试并确认绿灯**

Run: `./node_modules/.bin/vitest run test/shell.test.ts`

Expected: zsh 与 bash 的短参数、Codex、纯打印、tmux 和冲突测试全部 PASS。

- [ ] **Step 6: 提交 wrapper 支持**

```bash
git add src/shell/templates.ts test/shell.test.ts
git commit -m "feat(shell): launch projects with Codex"
```

### Task 3: 规格同步与完整回归

**Files:**

- Modify: `zhao-spec.md:34-56`
- Modify: `zhao-spec.md:180-184`

**Interfaces:**

- Consumes: Task 1 和 Task 2 已验证的参数与 wrapper 行为。
- Produces: 与最终 CLI 行为一致的项目规格和可发布构建证据。

- [ ] **Step 1: 更新规格中的参数定义**

将核心检索 flags 明确为：

```md
flags：`--print/-p`（仅打印路径）、`--claude/-cc`（cd 后启动 Claude Code）、`--codex/-cdx`（cd 后启动 Codex）、`--tmux/-t`（tmux 新窗口打开）。Claude 与 Codex 参数不能同时使用；tmux 与编辑器参数同时出现时 tmux 优先。
```

在 wrapper 伪代码注释和注意事项中补充 Codex、短参数、纯打印返回及冲突规则。

- [ ] **Step 2: 运行完整自动化验证**

Run: `./node_modules/.bin/vitest run`

Expected: 所有测试文件和测试用例 PASS，0 failures。

Run: `./node_modules/.bin/tsc --noEmit`

Expected: exit 0。

Run: `./node_modules/.bin/tsdown`

Expected: 生成可执行的 `dist/index.mjs` 与 `dist/index.mjs.map`，exit 0。

- [ ] **Step 3: 验证构建后帮助输出**

Run: `./dist/index.mjs -h`

Expected: OPTIONS 中包含 `-p, --print`、`-cc, --claude`、`-cdx, --codex`、`-t, --tmux`。

- [ ] **Step 4: 验证工作区差异**

Run: `git diff --check`

Expected: 无输出，exit 0。

Run: `git status --short`

Expected: 只包含本任务计划内的规格改动；构建产物不进入 Git。

- [ ] **Step 5: 提交规格更新**

```bash
git add zhao-spec.md
git commit -m "docs: document CLI aliases and Codex launch"
```
