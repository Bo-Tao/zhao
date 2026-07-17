# CLI 参数简写与 Codex 启动设计

## 目标

为项目检索命令补充一致的短参数，并新增使用 Codex 打开项目的能力，同时保持现有路径解析、交互选择和 Shell `cd` 机制不变。

支持的参数如下：

| 短参数 | 长参数 | 行为 |
| --- | --- | --- |
| `-p` | `--print` | 只打印选中项目的路径，不切换目录 |
| `-cc` | `--claude` | 切换到选中项目后执行 `claude` |
| `-cdx` | `--codex` | 切换到选中项目后执行 `codex` |
| `-t` | `--tmux` | 在 tmux 新窗口中打开选中项目 |

## 方案选择

采用“两层显式别名”方案：Node CLI 和 Shell wrapper 都直接识别长短参数。

仅在 wrapper 中转换别名会导致 `command zhao -p <query>` 无法工作；改用 Shell 动作协议则会扩大 stdout 协议和热路径的改动范围。两层显式识别能维持现有架构，同时保证直接调用二进制和通过 wrapper 调用时行为一致。

## 组件与数据流

### Node CLI

- citty 根命令为四个布尔参数声明别名，使帮助页展示短参数。
- 热路径参数解析器同时接受长短参数，并在返回值中增加 `codex` 布尔值。
- Node CLI 仍只负责解析参数、选择项目并向 stdout 输出路径，不直接启动 Claude、Codex 或 tmux。
- 直接执行二进制时，`-p` 与 `--print` 均保留纯路径输出语义。

### Shell wrapper

wrapper 在调用 Node CLI 前提取动作参数：

1. 将 query 和非动作参数传给 `command zhao --print`，获得项目路径。
2. 如果指定 `-p/--print`，直接打印路径并返回。
3. 如果指定 `-t/--tmux`，执行 `tmux new-window -c "$dir"` 并返回。
4. 否则切换到项目目录。
5. 根据参数执行 `claude` 或 `codex`；没有编辑器参数时停留在项目目录。

tmux 保持现有优先级：与 Claude 或 Codex 参数共同出现时，只打开 tmux 新窗口，不自动启动编辑器。

## 冲突与错误处理

- `--claude/-cc` 与 `--codex/-cdx` 不允许同时使用。
- Node 热路径解析器和 Shell wrapper 都执行冲突校验：前者保护直接二进制调用，后者在项目解析前快速失败。
- 冲突时输出明确错误并返回非零状态，不切换目录，也不启动任何外部程序。
- 长短参数可以混用，参数顺序不受限制；同一选项的长短形式重复出现视为同一布尔值，不报错。

## 测试策略

- 参数单元测试：验证四组长短参数等价、`codex` 默认值以及 Claude/Codex 冲突。
- CLI 帮助测试：验证帮助页包含 `-p`、`-cc`、`-cdx`、`-t` 及对应长参数。
- zsh/bash wrapper 测试：使用临时可执行文件验证纯路径输出、目录切换、Claude/Codex 启动、tmux 优先级和冲突失败。
- 完整回归：运行全部 Vitest、TypeScript 类型检查和 tsdown 构建，并在真实 zsh wrapper 中验证关键命令。

## 非目标

- 不改变项目匹配和交互选择逻辑。
- 不引入新的 Shell 动作协议。
- 不改变 tmux 与编辑器参数组合时的现有优先级。
- 不检查 `claude`、`codex` 或 `tmux` 是否预先安装；保持 Shell 的标准 command-not-found 行为。
