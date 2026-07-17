# zhao — 项目快速检索 CLI 开发规格说明

## 1. 项目概述

`zhao`（拼音"找"）是一个 TypeScript 命令行工具，解决"项目多且不熟，无法把项目名和域名/关键词/模块对应起来"的检索痛点。核心工作流：

> 按域名/关键词/模块检索 → 交互式选择项目 → cd 进入项目目录 → 打开 Claude Code 开始工作

辅助工作流：在项目目录内（或通过检索）一键用浏览器打开 GitLab 仓库页面、构建平台的测试/生产环境页面。

使用者：先个人使用（macOS + zsh + Warp + tmux），后续推广给前端团队。本地项目规模 50-100 个 git 仓库，分散在多个根目录下。公司 GitLab 为 `git.100tal.com`（自建 GitLab，remote 形如 `https://git.100tal.com/bigclass_xuefu_fe/tal-npm.git` 或 `git@git.100tal.com:bigclass_xuefu_fe/tal-npm.git`）。

## 2. 技术栈与工程约束

| 项       | 决策                                                                                    |
| -------- | --------------------------------------------------------------------------------------- |
| 运行时   | 开发用 Bun + TypeScript；**产物必须 Node 兼容**，发布为 npm 包                          |
| 兼容纪律 | 只用 `node:` 前缀标准模块，禁用 Bun 独有 API（保留将来 `bun build --compile` 的可能性） |
| CLI 框架 | citty（`defineCommand`，子命令用动态 `import()` 懒加载，保证热路径启动速度）            |
| 交互 UI  | `@clack/prompts`（选择器、onboarding 引导、spinner 全部用它）                           |
| 其他依赖 | `yaml`（配置解析）、`zod`（配置/索引 schema 校验）、`fast-glob`（扫描 .git 目录）       |
| 不引入   | simple-git（直接解析 `.git/config`）、ink、老版 inquirer 大包                           |
| 包名     | `@botaoxyz/zhao`，bin 注册为 `zhao`（npm 上 `zhao` 裸名已被占用）                       |
| 分发     | 私有 Verdaccio registry，`npm i -g` 安装                                                |
| 性能要求 | `zhao <query>` 为每日高频热路径，启动到出结果目标 < 100ms（懒加载 + 索引常驻单文件）    |

## 3. 架构总览

### 3.1 两层结构：shell wrapper + Node 二进制

子进程无法改变父 shell 的 cwd，因此：

- **Node 二进制**：负责扫描、检索、交互选择，最终将选中的项目路径打印到 stdout。
- **shell wrapper 函数**：由 `zhao init <shell>` 生成、`eval` 装载进当前 shell，负责实际 `cd`。

wrapper 伪代码（zsh/bash 各一份模板，**不支持 fish**）：

```zsh
zhao() {
  case "$1" in
    init|setup|scan|tag|list|info|edit|config|doctor|browse|ci|open|sync)
      command zhao "$@" ;;              # 管理类/打开类命令直接透传
    *)
      # 先解析 wrapper 专属 flags，并从 query 参数中移除
      # -p/--print、-cc/--claude、-cdx/--codex、-t/--tmux
      # -h/--help、-v/--version 直接透传给二进制
      local use_print=0 use_claude=0 use_codex=0 use_tmux=0
      local -a args
      for arg in "$@"; do
        case "$arg" in
          -h|--help|-v|--version) command zhao "$@"; return ;;
          -p|--print) use_print=1 ;;
          -cc|--claude) use_claude=1 ;;
          -cdx|--codex) use_codex=1 ;;
          -t|--tmux) use_tmux=1 ;;
          *) args+=("$arg") ;;
        esac
      done
      # --claude/-cc 与 --codex/-cdx 不能同时使用，冲突返回状态 2
      # 其他参数保留为 query，交给二进制解析
      # （zsh/bash 模板分别使用对应的数组语法）
      if [[ "$use_claude" -eq 1 && "$use_codex" -eq 1 ]]; then
        printf '%s\n' '错误：--claude/-cc 与 --codex/-cdx 不能同时使用。' >&2
        return 2
      fi
      local dir
      dir="$(command zhao --print "${args[@]}")" || return
      [[ -z "$dir" ]] && return
      if [[ "$use_print" -eq 1 ]]; then
        printf '%s\n' "$dir"       # 纯打印路径，不改变 cwd 或启动编辑器
        return
      fi
      if [[ "$use_tmux" -eq 1 ]]; then
        if [[ -n "$TMUX" ]]; then
          tmux new-window -c "$dir" # 已在 tmux 中时打开新窗口
        else
          tmux new-session -c "$dir" # 否则创建并进入新会话
        fi
        return
      fi
      cd "$dir" || return
      if [[ "$use_claude" -eq 1 ]]; then
        command claude
      elif [[ "$use_codex" -eq 1 ]]; then
        command codex
      fi
      ;;
  esac
}
```

注意：`--print/-p`、`--claude/-cc`、`--codex/-cdx`、`--tmux/-t` 的分支逻辑在 wrapper 层处理；二进制侧通过 `--print` 统一解析并输出路径。纯打印只输出路径并保持当前目录不变；Claude 与 Codex 冲突时 wrapper 返回状态 2；tmux 与编辑器参数同时出现时 tmux 优先。使用 tmux 参数时，wrapper 在现有 tmux 客户端内打开新窗口，否则创建并进入新会话。wrapper 需导出标记变量（如 `export ZHAO_SHELL_WRAPPED=1`），供 `doctor` 和 onboarding 检测 wrapper 是否生效。

### 3.2 四个数据文件（`~/.config/zhao/`）

| 文件           | 内容                                                   | 性质                                 |
| -------------- | ------------------------------------------------------ | ------------------------------------ |
| `config.yml`   | 扫描根目录列表、ci URL 模板、fzf 开关等用户配置        | 用户维护                             |
| `index.json`   | `zhao scan` 生成的项目索引                             | **随时可删可重建，不含任何手工数据** |
| `projects.yml` | 手动元数据层：alias、域名、关键词、links、域名拉黑名单 | 用户/团队维护，未来通过 git 仓库共享 |
| `state.json`   | frecency 使用记录（每次选中项目时更新）                | 程序维护，变更频繁                   |

检索时四者在内存合并。合并优先级：projects.yml 手动数据 > index.json 自动数据。

### 3.3 index.json 数据结构

```jsonc
{
  "version": 1,
  "generatedAt": "2026-07-16T10:00:00Z",
  "projects": [
    {
      "id": "git.100tal.com/bigclass_xuefu_fe/tal-npm", // remote 路径做稳定 ID（去协议、去 .git）
      "name": "tal-npm", // package.json name 或目录名
      "path": "/Users/dylan/work/fe/tal-npm",
      "remote": "git@git.100tal.com:bigclass_xuefu_fe/tal-npm.git",
      "group": "bigclass_xuefu_fe", // GitLab group，业务线信息
      "description": "学情报告 H5", // pkg description 或 README 一级标题
      "keywords": ["report", "h5", "echarts"], // pkg keywords + 显著依赖
      "stack": ["vue3", "vite"], // 依赖特征推断
      "domains": [
        {
          "value": "api.report.100tal.com",
          "type": "api", // "api" | "page" | "guess"
          "source": "src/api/request.ts",
          "confidence": 0.9,
        },
      ],
      "scannedAt": "2026-07-16T10:00:00Z",
    },
  ],
}
```

**ID 用 remote 路径而非本地路径**：项目挪目录、团队成员 clone 到不同位置时，projects.yml 中的手动元数据仍能对应。

### 3.4 projects.yml 数据结构

```yaml
git.100tal.com/bigclass_xuefu_fe/tal-npm:
  aliases: [npm仓, tal-registry]
  domains:
    - value: npm.100tal.com
      type: page # 手动录入默认 confidence 1.0
  keywords: [私有npm, verdaccio]
  links: # 通用关联链接机制
    ci-test: https://build.100tal.com/xxx?env=test
    ci-prod: https://build.100tal.com/xxx?env=prod
  blockedDomains: # 拉黑的自动扫描候选，重新 scan 不复活
    - cdn.100tal.com
```

### 3.5 config.yml 数据结构

```yaml
scanRoots:
  - ~/work/fe
  - ~/work/mobile
ciTemplates: # 模板优先，projects.yml links 逐项目覆盖
  test: 'https://build.100tal.com/{group}/{name}?env=test'
  prod: 'https://build.100tal.com/{group}/{name}?env=prod'
useFzf: false # true 且检测到 fzf 时委托 fzf 做选择器
```

## 4. 核心逻辑

### 4.1 扫描（`zhao scan`）

1. 遍历 `scanRoots`，用 fast-glob 找 `**/.git`（限制深度，忽略 node_modules）。
2. 每个仓库提取：`.git/config` 的 remote → id/group；`package.json` 的 name/description/keywords/依赖特征；`README.md` 标题与一级标题。
3. **域名候选提取**：在配置类文件（`.env*`、`*.config.*`、`src/api/**`、`nginx*` 等，控制扫描范围避免慢）中正则匹配域名字符串，标 `type: "api"`、记录来源文件、confidence 0.9；剔除噪音白名单（npm registry、常见 CDN 等）及该项目 blockedDomains。
4. **启发式页面域名猜测**：由 API 域名生成候选（如 `api.report.x.com` → `report.x.com`），标 `type: "guess"`、confidence 0.3。
5. 全量重写 index.json；本地路径已不存在的项目自动剔除（无需 rm 命令）。

### 4.2 检索排序（`rankProjects(query)`）

内存中对合并后的项目打分，优先级从高到低：

1. 域名精确/前缀匹配（page > api > guess，按 confidence 加权）
2. alias 精确匹配
3. 手动 keywords 匹配
4. name/description/自动 keywords 模糊匹配（子串 + 简单 fuzzy 即可，50-100 项目量级无需搜索引擎）
5. 叠加 frecency 加权（state.json 的使用频率 × 时间衰减，参考 zoxide 算法）

### 4.3 共享项目解析器（`resolveProject(query?)`）

`zhao` / `browse` / `ci` / `open` 四命令共用。规则：**显式 query 永远压过隐式当前位置**。

```
有 query:
  rankProjects(query)
    1 个命中 → 返回
    多个命中 → clack 选择列表（每行: 名称 · 描述 · 命中原因），选中即返回
    0 命中   → 报错 + 提示 "zhao scan 更新索引或换关键词"
无 query:
  从 cwd 向上逐级找 .git → 读 remote → 索引反查
    找到 → 返回（browse 只需 remote，即使未被 scan 收录也可工作）
    不在项目内 → 弹全量项目选择列表（与主命令行为一致）
```

选中后直接执行动作，不做二次确认。每次通过检索选中项目时更新 state.json 的 frecency 记录。

### 4.4 首次运行引导（onboarding 中间件）

所有命令入口的前置检查，两项独立：

1. wrapper 未生效（检测 `ZHAO_SHell_WRAPPED` 环境标记）→ 询问"现在运行 setup 吗？"
2. config.yml 不存在 → clack 引导输入扫描根目录（可多个）→ 写 config → 立即扫描 → 报告"已索引 N 个项目"

`doctor` 复用这两个检测函数。目标：新人只需记住 `zhao` 一个词，零文档上手。

## 5. 命令规格

### MVP（第一阶段，全部实现）

| 命令                  | 规格                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zhao <query>`        | 核心检索。resolveProject → 输出路径（wrapper 完成 cd）。flags：`--print/-p`（仅打印路径）、`--claude/-cc`（cd 后启动 Claude Code）、`--codex/-cdx`（cd 后启动 Codex）、`--tmux/-t`（在 tmux 内打开新窗口，外部调用时创建并进入新会话）。Claude 与 Codex 不能同时使用；tmux 与编辑器参数同时出现时 tmux 优先。无 query 时弹全量选择列表 |
| `zhao init <shell>`   | 输出对应 shell 的 wrapper 函数文本。仅支持 zsh、bash，其他值报错并列出支持项                                                                                                                                                                                                                                                           |
| `zhao setup`          | 安装 wrapper：检测当前 shell 与 rc 文件 → **查重**（已存在则跳过，幂等）→ 展示将写入内容 → 确认后追加 `eval "$(zhao init zsh)"` → **打印改动的文件与内容**。rc 文件为符号链接时警告（dotfiles 场景）并需再次确认                                                                                                                       |
| `zhao scan`           | 见 4.1。clack spinner 展示进度                                                                                                                                                                                                                                                                                                         |
| `zhao browse [query]` | resolveProject → remote 转 web URL（处理 SSH/HTTPS 两种格式，去 `.git` 后缀）→ `open` 打开浏览器。flags：`--copy`（复制 URL 到剪贴板）、`--print`。检测到无图形环境（如 SSH session）自动降级为打印 URL。拒绝多余参数（防止误当 git 透传）                                                                                             |
| `zhao list`           | 列出全部项目（名称、路径、描述）。`--json` 输出合并后的完整数据供管道/调试                                                                                                                                                                                                                                                             |

### v2（第二阶段）

| 命令                           | 规格                                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zhao ci [test\|prod] [query]` | 打开构建平台。参数消歧：首个位置参数 ∈ {test, prod} 则为环境，否则视为 query；环境默认 test。URL 解析：projects.yml links（`ci-test`/`ci-prod`）优先 → ciTemplates 模板填充 `{group}`/`{name}` 兜底 → 都没有则报错并提示配置方法。flags 与降级行为同 browse |
| `zhao tag <project>`           | 手动元数据录入："检索失败即录入"的入口。flags：`--domain`、`--kw`、`--alias`（均可多值）、`--rm-domain`（写入 blockedDomains）。project 参数支持模糊匹配 + 多命中选择                                                                                       |
| `zhao info <project>`          | 展示单项目合并后的全部元数据，逐项标注来源（自动扫描/手动/模板/猜测）                                                                                                                                                                                       |
| `zhao edit`                    | 用 `$EDITOR` 打开 projects.yml                                                                                                                                                                                                                              |
| `zhao config`                  | `get <key>` / `set <key> <value>` / 无参时用 `$EDITOR` 打开 config.yml                                                                                                                                                                                      |
| `zhao doctor`                  | 自检：wrapper 是否生效、config 与索引是否存在、索引新鲜度（超过 N 天提示重扫）、scanRoots 是否存在、Node 版本                                                                                                                                               |

### 后期（本次不实现，但架构需为其留位）

| 命令                | 说明                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `zhao open <alias>` | 打开 projects.yml links 中任意别名链接（log/monitor/page…）。**顶级命令准入线：仅 browse/ci，其余一律走 open** |
| `zhao sync`         | 从共享 git 仓库拉取合并 projects.yml（团队协作）                                                               |
| `zhao scan --ai`    | 对无描述仓库 headless 调 `claude -p` 生成摘要与关键词写回                                                      |

## 6. 项目结构建议

```
zhao/
├── src/
│   ├── index.ts              # citty 入口，子命令懒加载
│   ├── commands/             # 每个子命令一个文件
│   ├── core/
│   │   ├── resolver.ts       # resolveProject()
│   │   ├── rank.ts           # rankProjects() 打分排序
│   │   ├── scanner.ts        # 扫描与元数据提取
│   │   ├── store.ts          # 四个数据文件的读写与合并（zod 校验）
│   │   ├── frecency.ts
│   │   └── giturl.ts         # remote 解析与 web URL 转换
│   ├── shell/
│   │   ├── zsh.ts / bash.ts  # wrapper 模板
│   │   └── setup.ts          # rc 文件写入逻辑
│   ├── ui/                   # clack 封装：选择器、onboarding
│   └── middleware/onboard.ts
├── test/                     # giturl 解析、rank 排序、参数消歧必须有单测
├── package.json              # bin: {"zhao": "./dist/index.mjs"}, files: ["dist"]
└── build: tsdown 打包为单文件 ESM，target node18
```

## 7. 验收清单（MVP）

- [ ] `npm i -g @botaoxyz/zhao` 后首次运行任意命令触发完整 onboarding，全程无需看文档
- [ ] `zhao setup` 幂等：重复运行不重复写入；改动透明打印；符号链接 rc 有警告
- [ ] `zhao 报告` 在多命中时弹出带"命中原因"的选择列表，选中后 shell 切换到项目目录
- [ ] `zhao api.report.100tal.com` 能通过自动扫描出的 API 域名直接命中项目
- [ ] 在项目任意子目录执行 `zhao browse` 打开正确的 GitLab 页面；SSH 与 HTTPS remote 均正确转换
- [ ] `zhao xxx --print` 输出纯路径，可用于 `cd $(zhao xxx --print)`
- [ ] 热路径启动 < 100ms（`hyperfine 'zhao --print somequery'` 验证）
- [ ] 索引损坏或缺失时所有命令能引导重建而非崩溃
