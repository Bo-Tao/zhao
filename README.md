# zhao

`zhao`（“找”）是一个面向本地多仓库场景的项目检索 CLI。它会扫描 Git 仓库，建立包含项目名、描述、技术栈、域名和远程仓库信息的本地索引，让你可以通过域名、别名、关键词或项目名快速找到项目，并直接进入目录、打开代码助手、GitHub/GitLab 仓库地址或 CI 页面。

```
           █████
          ░░███
 █████████ ░███████    ██████    ██████
░█░░░░███  ░███░░███  ░░░░░███  ███░░███
░   ███░   ░███ ░███   ███████ ░███ ░███
  ███░   █ ░███ ░███  ███░░███ ░███ ░███
 █████████ ████ █████░░████████░░██████
░░░░░░░░░ ░░░░ ░░░░░  ░░░░░░░░  ░░░░░░
```

```text
域名 / 别名 / 关键词 / 项目名
              ↓
       本地索引与手动元数据
              ↓
   进入目录 / 打开编辑器 / GitLab / CI
```

## 特性

- 给项目打标签，可以按项目域名、API 域名、别名、关键词、项目名或描述检索项目
- 多个结果时显示交互式选择器，可选用 `fzf`
- 通过 shell wrapper 真正切换当前终端目录
- 可在进入项目后启动 Claude Code 或 Codex
- 支持在 tmux 新窗口或新会话中打开项目
- 扫描 `package.json`、README、Git remote 和常见配置文件生成索引
- 支持为项目补充别名、页面域名、关键词和 CI 链接
- 可从项目任意子目录打开 GitHub/GitLab 或 CI 页面
- 使用 frecency（访问频率与时间衰减）优化检索排序
- 配置和索引均保存在本地，不修改被扫描的项目

## 环境要求

- Node.js 18 或更高版本
- zsh 或 bash（用于安装目录跳转 wrapper）
- macOS、Linux 或 Windows 可运行构建产物；shell wrapper 当前仅支持 zsh 和 bash

以下工具按需安装：

- `fzf`：启用 `useFzf` 后用于项目选择，缺失时自动回退到内置选择器
- `tmux`：使用 `--tmux` 时需要
- `claude`：使用 `--claude` 时需要
- `codex`：使用 `--codex` 时需要
- Linux 剪贴板：使用 `--copy` 时需要 `wl-copy` 或 `xclip`

## 安装

```bash
npm install @botaoxyz/zhao -g
```

安装 shell wrapper：

```bash
zhao setup
```

`setup` 会自动识别 zsh 或 bash，并在 `~/.zshrc` 或 `~/.bashrc` 中追加：

```bash
eval "$(zhao init zsh)"
```

它会在写入前展示内容并请求确认；重复运行不会重复写入。如果 rc 文件是符号链接，还会额外提示。完成后重新打开终端，或手动加载配置：

```bash
source ~/.zshrc
# bash 用户使用：source ~/.bashrc
```

也可以跳过 `setup`，自行把对应命令加入 shell 配置：

```bash
eval "$(zhao init zsh)"
# 或：eval "$(zhao init bash)"
```

## 快速开始

第一次在交互式终端运行 `zhao` 时，会引导你完成以下操作：

1. 检查 shell wrapper 是否生效。
2. 输入一个或多个项目扫描根目录。
3. 创建 `~/.config/zhao/config.yaml`。
4. 扫描 Git 仓库并生成本地索引。

完成后即可检索：

```bash
# 按项目名、关键词或别名检索并进入目录
zhao 'report'
zhao '学习报告'

# 按域名检索
zhao 'example.com'

# 只打印路径，不切换目录
zhao '学习报告' --print

# 进入目录后启动 Claude Code
zhao '学习报告' --claude

# 进入目录后启动 Codex
zhao '学习报告' --codex

# 在 tmux 中打开项目
zhao '学习报告' --tmux

# 在 tmux 中打开项目并启动 Codex 或 Claude Code
zhao '学习报告' --tmux --codex
zhao '学习报告' --tmux --claude
```

`--claude` 与 `--codex` 不能同时使用。查询包含空格时需要加引号，并且一次只接受一个查询参数：

```bash
zhao "学习 报告"
```

## 工作原理

子进程无法改变父 shell 的当前目录，因此 `zhao` 分为两层：

- Node.js CLI 负责扫描、检索、交互选择以及输出目标路径。
- shell wrapper 调用 CLI 获取路径，再在当前 shell 中执行 `cd`、启动代码助手或创建 tmux 窗口。

如果未安装 wrapper，直接运行 `zhao <query>` 只会输出项目路径，不会改变当前目录。可通过下面的命令检查状态：

```bash
zhao doctor
```

## 命令参考

### 项目检索

```text
zhao [query] [--print] [--claude] [--codex] [--tmux]
```

| 参数       | 简写   | 说明                                                                          |
| ---------- | ------ | ----------------------------------------------------------------------------- |
| `query`    | —      | 域名、别名、关键词或项目名；省略时从当前 Git 项目解析，否则显示全部项目供选择 |
| `--print`  | `-p`   | 只打印选中的项目路径                                                          |
| `--claude` | `-cc`  | 进入目录后启动 Claude Code                                                    |
| `--codex`  | `-cdx` | 进入目录后启动 Codex                                                          |
| `--tmux`   | `-t`   | 在 tmux 新窗口中打开；不在 tmux 中时创建新会话                                |

显式 `query` 的优先级高于当前目录。若检索到多个项目，`zhao` 会展示项目名、描述和命中原因供选择。

### `zhao setup`

安装 shell wrapper，并在需要时继续首次配置和索引创建。

```bash
zhao setup
zhao setup --shell zsh
zhao setup --shell bash
```

### `zhao init`

输出 shell wrapper 内容，适合手动安装或 dotfiles 管理。

```bash
zhao init zsh
zhao init bash
```

### `zhao scan`

扫描配置的根目录并全量重建 `index.json`：

```bash
zhao scan
```

扫描会跳过损坏或没有 Git remote 的仓库，不会因为单个仓库失败而中断。已不在扫描目录中的项目会在重建后从索引中移除。

### `zhao browse`

打开项目的 GitHub/GitLab 页面。没有查询时优先使用当前 Git 项目：

```bash
zhao browse
zhao browse '学习报告'
zhao browse '学习报告' --print
zhao browse '学习报告' --copy
```

| 参数      | 简写 | 说明                |
| --------- | ---- | ------------------- |
| `query`   | —    | 可选项目查询        |
| `--print` | `-p` | 只打印仓库 URL      |
| `--copy`  | `-c` | 将 URL 复制到剪贴板 |

SSH 会话或无图形界面的 Linux 环境会自动降级为打印 URL。SSH 和 HTTPS 格式的 Git remote 都会转换为 Web URL。

`--copy` 只负责复制 URL，不会阻止图形界面继续打开页面；如需仅复制而不打开，请同时添加 `--print`。

### `zhao ci`

打开项目的测试或生产 CI 页面：

```bash
# 默认 test 环境
zhao ci '学习报告'
zhao ci test '学习报告'
zhao ci prod '学习报告'

# 用于脚本或复制
zhao ci prod '学习报告' --print
zhao ci test '学习报告' --copy
```

| 参数      | 简写 | 说明                |
| --------- | ---- | ------------------- |
| `query`   | —    | 可选项目查询        |
| `--print` | `-p` | 只打印 CI URL      |
| `--copy`  | `-c` | 将 URL 复制到剪贴板 |

首个位置参数只有在值为 `test` 或 `prod` 时才会被解释为环境，否则它就是项目查询。URL 读取解析：

`projects.yaml` 中该项目的 `links.ci-test` 或 `links.ci-prod`。

与 `browse` 一样，`--copy/-c` 可和 `--print/-p` 组合，做到复制并输出 URL、但不打开页面。

### `zhao tag`

为已索引项目追加手动元数据：

```bash
zhao tag '学习报告' --alias report
zhao tag '学习报告' --kw 报告
zhao tag '学习报告' --domain report.example.com
zhao tag '学习报告' --rm-domain api.invalid.example.com
zhao tag report \
  --ci-test https://build.example.com/report/test \
  --ci-prod https://build.example.com/report/prod
```

| 参数          | 说明                                       |
| ------------- | ------------------------------------------ |
| `--alias`     | 添加别名                                   |
| `--kw`        | 添加手动关键词                             |
| `--domain`    | 添加页面域名                               |
| `--rm-domain` | 拉黑自动扫描出的域名，使后续扫描不再加入它 |
| `--ci-test`   | 设置测试环境 CI 链接                       |
| `--ci-prod`   | 设置生产环境 CI 链接                       |

`--alias`、`--kw`、`--domain` 和 `--rm-domain` 可重复使用，也可用逗号分隔多个值。命令会追加并去重，不会覆盖其他已有手动元数据。

### `zhao list`

列出所有已索引项目：

```bash
zhao list
zhao list --json
```

默认输出以 Tab 分隔的项目名、路径和描述；`--json` 输出自动索引与手动元数据合并后的完整数据。

### `zhao info`

查看单个项目的完整合并数据，并标明自动扫描、手动配置、模板或猜测来源：

```bash
zhao info '学习报告'
```

### `zhao edit`

使用 `$EDITOR` 打开 `projects.yaml`：

```bash
EDITOR=vim zhao edit
```

未设置 `$EDITOR` 时默认使用 `vim`。

### `zhao config`

不带参数时使用 `$EDITOR` 打开 `config.yaml`：

```bash
zhao config
```

也可以读取或设置受支持的配置键：

```bash
zhao config get scanRoots
zhao config set scanRoots ~/work/fe,~/work/mobile
zhao config set useFzf true
zhao config set scanDepth 6
```

支持的键包括：

- `scanRoots`
- `useFzf`
- `scanDepth`（1 到 10）

修改 `scanRoots` 或 `scanDepth` 后，请运行 `zhao scan` 更新索引。手动域名黑名单会立即过滤现有索引，并在后续扫描中继续生效。

### `zhao doctor`

检查 shell wrapper、配置文件、索引、索引新鲜度、扫描目录和 Node.js 版本：

```bash
zhao doctor
```

存在失败项时命令返回非零退出码；索引超过 7 天未更新会显示警告。

### 帮助与版本

```bash
zhao --help
zhao tag --help
zhao --version
```

## 配置

默认数据目录是 `~/.config/zhao/`。可以通过 `ZHAO_CONFIG_DIR` 环境变量覆盖，适合隔离环境或自动化测试。

### `config.yaml`

```yaml
scanRoots:
  - ~/work/fe
  - ~/work/mobile

# true 时优先使用 fzf，调用失败或未安装时回退到内置选择器
useFzf: false

# 扫描根目录下查找 .git 的最大深度，范围 1～10，默认 5
scanDepth: 5
```

### `projects.yaml`

手动元数据以规范化后的 Git remote 路径作为项目 ID。这样即使本地目录移动，或不同成员将仓库克隆到不同位置，配置仍能对应同一个项目。

```yaml
git.example.com/group/name:
  aliases:
    - alias1
    - alias2
  domains:
    - value: domain.example.com
      type: page
  keywords:
    - keyword1
    - keyword2
  links:
    ci-test: https://build.example.com/group/name/test
    ci-prod: https://build.example.com/group/name/prod
  blockedDomains:
    - cdn.example.com
```

建议优先使用 `zhao tag` 修改手动元数据；需要批量调整时再使用 `zhao edit`。

### 数据文件

| 文件            | 维护者      | 用途                                     |
| --------------- | ----------- | ---------------------------------------- |
| `config.yaml`   | 用户        | 扫描根目录、CI 模板、选择器和扫描深度    |
| `projects.yaml` | 用户或团队  | 别名、手动关键词、域名、链接和域名黑名单 |
| `index.json`    | `zhao scan` | 自动生成的项目索引，可随时删除后重建     |
| `state.json`    | 程序        | 项目使用次数和最近使用时间，用于排序     |

旧版 `config.yml` 和 `projects.yml` 会在启动时安全迁移为 `.yaml`。若新旧文件同时存在且内容不同，`zhao` 会停止并要求手动合并，不会覆盖配置。

## 扫描内容

`zhao scan` 会在 `scanRoots` 下查找 `.git`，然后从每个有效仓库提取：

- Git remote：生成稳定项目 ID、仓库分组和 GitLab URL
- `package.json`：项目名、描述、关键词和依赖
- README 一级标题：在 `package.json` 没有描述时作为项目描述
- 依赖特征：识别 Vue 2/3、React、Next.js、Nuxt、Vite、Webpack、TypeScript 和 Pinia
- 常见配置文件中的域名：包括 `.env*`、根目录配置文件、`src/api/**`、`src/config/**` 和 nginx 配置

扫描域名时会忽略 `node_modules`、`dist`、`.git`、常见 registry/CDN、示例域名和项目的 `blockedDomains`。对于 `api.example.com` 形式的 API 域名，还会生成低置信度的 `example.com` 页面域名候选。

## 检索与排序

项目按命中质量和 frecency 综合排序，主要优先级为：

1. 页面域名、API 域名和猜测域名的精确、前缀或包含匹配。
2. 手动别名。
3. 手动关键词。
4. 项目名、描述、自动关键词和技术栈。
5. 最近且经常使用的项目获得额外权重。

手动页面域名的置信度最高，并会覆盖同值的自动扫描域名。`blockedDomains` 中的自动域名不会参与检索。

## 常见问题

### 执行 `zhao report` 后没有切换目录

shell wrapper 尚未生效。运行：

```bash
zhao setup
source ~/.zshrc
# bash 用户使用：source ~/.bashrc
zhao doctor
```

### 找不到新项目或刚添加的关键词

项目路径、自动提取元数据发生变化后，需要重建索引：

```bash
zhao scan
```

`zhao tag` 添加的别名和手动关键词会立即写入 `projects.yaml`，无需重新扫描。

### 索引损坏或不存在

`index.json` 不包含手工数据，可以直接重建：

```bash
zhao scan
```

### CI 页面提示没有链接

为项目单独设置链接：

```bash
zhao tag report --ci-test https://build.example.com/report/test
```

或者配置全局模板：

```bash
zhao config set ciTemplates.test 'https://build.example.com/{group}/{name}'
```

### 在脚本中使用

使用 `--print` 避免打开页面或切换目录：

```bash
project_path="$(zhao report --print)"
repository_url="$(zhao browse report --print)"
ci_url="$(zhao ci prod report --print)"
```

## 本地开发

开发环境使用 Bun 直接运行 TypeScript，依赖管理使用 pnpm 11；发布产物由 tsdown 构建为 Node.js 18 兼容的 ESM 可执行文件。

```bash
corepack enable
pnpm install

# 直接运行源码
pnpm dev -- --help
pnpm dev -- doctor

# 构建 dist/index.mjs
pnpm build

# 运行测试
pnpm test

# 格式、lint、类型检查和测试
pnpm check
```

监听模式：

```bash
pnpm test:watch
```

### 项目结构

```text
src/
├── index.ts       # 可执行入口与调用分类
├── cli.ts         # Citty 命令注册和帮助输出
├── commands/      # 管理命令实现
├── core/          # 扫描、存储、检索、排序和动作逻辑
├── middleware/    # 首次使用引导
├── shell/         # zsh/bash wrapper 与安装逻辑
└── ui/            # 交互提示和项目选择器

test/
├── fixtures/      # 测试配置与数据样本
├── helpers/       # 共享测试工具
└── *.test.ts      # Vitest 单元与 CLI 集成测试
```

新增命令时将薄命令处理器放在 `src/commands/`，可复用的领域逻辑放在 `src/core/`。本地 ESM 导入需保留 `.js` 扩展名，不要直接修改生成的 `dist/` 文件。

## 安全与数据边界

- 所有配置、索引和使用记录默认只保存在本机 `~/.config/zhao/`。
- 扫描过程只读取项目文件，不会修改被扫描的仓库。
- 索引只保存提取后的元数据、域名及其来源路径，不复制配置文件正文。
- `index.json` 可重建；需要备份或共享时应优先保留 `config.yaml` 和 `projects.yaml`。
- `projects.yaml` 可能包含内部仓库 ID 和 CI URL，请勿提交到公开仓库。
