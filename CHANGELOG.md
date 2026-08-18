# 更新日志

本项目的主要变更都记录在此文件中。版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.6.0] - 2026-08-18

### 新增

- 新增 `zhao open [query]`，可从已安装的 macOS 编辑器、终端、Finder、Xcode 和 Android Studio 中选择工具打开项目。
- 支持 `--with/-w <tool>` 直接指定工具；工具别名忽略大小写，显式指定未安装应用时会返回明确错误。

### 改进

- 通过 LaunchServices 按 bundle ID 检测应用，不依赖固定安装目录；非 macOS、SSH 和无图形环境会在进入项目选择前停止。
- 原先规划中的链接别名打开命令改名为 `zhao link <alias>`，为项目应用打开功能释放 `zhao open`。

## [0.5.0] - 2026-08-14

### 改进

- `zhao list` 默认以带表头、边框和行分隔线的表格展示项目，并根据终端宽度自动截断过长的名称、路径和描述。
- `zhao info` 按“基本信息 / 标记 / 域名 / 链接”分区展示响应式表格；长路径和 URL 会自动换行，避免信息丢失。
- 表格宽度按中文、Emoji 和组合字符的实际终端显示宽度计算，并会清理单元格中的控制字符，提升不同终端下的对齐稳定性。

### 修复

- 收紧源码中的裸域名识别规则，不再将 JavaScript 成员访问、环境变量访问和资源文件名误判为域名。
- 继续支持从 HTTP(S) URL、`.env`、Nginx 配置和明确的 URL、host、domain 等配置项中识别真实域名。

### 文档

- 更新 `zhao list` 和 `zhao info` 的输出格式说明。

## [0.4.0] - 2026-08-12

### 新增

- `projects.yaml` 支持在 Git 仓库下手动维护 `targets`，为 monorepo 中可独立构建的子项目配置名称、相对路径、别名、关键词、域名和 CI 链接。
- monorepo target 会以独立项目参与搜索、排序和使用频次记录，并使用 `仓库 ID#target key` 作为稳定标识。
- 在 target 目录或其任意子目录执行命令时，Zhao 会按最长路径自动识别当前 target，无需额外提供查询参数。

### 改进

- `zhao ci` 为每个 target 解析独立的测试和生产构建地址，且不会误继承父仓库的 CI 链接。
- `zhao tag` 可将别名、关键词、域名和 CI 链接正确写回父仓库的 `targets.<key>` 配置。
- `zhao info`、内置项目选择器和 fzf 选择器会展示 target 所属仓库，便于区分 monorepo 中的同名子项目。
- 加强 target 路径校验，拒绝绝对路径、越出仓库的路径和与仓库根目录重叠的路径。

### 文档

- 补充 multiple repo 与 monorepo 的 `projects.yaml` 配置示例，并明确 `targets` 由用户手动维护，`zhao scan` 不会自动生成或删除。

## [0.3.0] - 2026-07-24

### 改进

- 扫描项目时统一使用仓库目录名作为项目名称，避免 `package.json` 中的包名、作用域或发布名称影响检索结果。
- 项目选择列表会根据终端宽度自动截断长名称、描述和匹配原因，中文、Emoji 等宽字符也能保持正确对齐。
- 精简项目选择列表，不再显示完整本地路径，减少窄终端中的换行和视觉干扰。

### 文档

- 移除 `AGENTS.md` 中已经过时的记忆上下文说明。

## [0.2.0] - 2026-07-24

### 新增

- `zhao scan` 会自动创建并维护 `projects.yaml`，为新扫描到的项目补齐可编辑的元数据结构。
- 使用 Git remote 生成稳定项目 ID，使配置在项目移动或不同成员使用不同克隆路径时仍能正确对应。

### 改进

- 扫描时保留已有的别名、域名、关键词、CI 链接、域名黑名单以及暂未发现的项目条目。
- 没有新项目时不再重写 `projects.yaml`，并以空行分隔项目条目，减少无意义变更并提升可读性。
- `zhao info` 不再显示自动生成但尚未配置的空链接。

[0.6.0]: https://github.com/Bo-Tao/zhao/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/Bo-Tao/zhao/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/Bo-Tao/zhao/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/Bo-Tao/zhao/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/Bo-Tao/zhao/releases/tag/0.2.0
