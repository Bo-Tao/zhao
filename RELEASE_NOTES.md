# zhao v0.4.0

Zhao 现在支持为 monorepo 中拥有独立构建地址的子项目配置 `targets`，同时保持现有 multiple repo 配置完全兼容。

## 新功能

- 在仓库配置下手动声明 `targets`，为每个可部署子项目设置稳定 key、名称、相对路径、别名、关键词、域名和 CI 链接。
- target 作为独立项目参与搜索、选择和使用频次排序。
- 进入 target 目录或其子目录后，`zhao ci` 等命令可自动识别对应 target。

## 行为与可靠性改进

- target 使用独立 CI 链接，不继承父仓库构建地址，避免打开错误的构建页面。
- `zhao tag` 会将手动元数据写回嵌套的 `targets.<key>`，不会创建错误的顶层项目。
- `zhao info` 和项目选择器会显示 target 所属仓库。
- target 的 `path` 必须是安全的仓库内相对路径。

## 配置示例

```yaml
git.example.com/group/frontend-platform:
  targets:
    admin-web:
      name: 运营后台
      path: apps/admin-web
      aliases:
        - 后台
      links:
        ci-test: https://build.example.com/frontend-platform/admin-web/test
        ci-prod: https://build.example.com/frontend-platform/admin-web/prod
```

`targets` 由用户手动维护。`zhao scan` 仍只负责发现 Git 仓库，不会自动创建或删除 target。

## 升级

```bash
npm install --global @botaoxyz/zhao@0.4.0
zhao --version
zhao scan
```

现有 multiple repo 的 `projects.yaml` 无需修改；只有 monorepo 需要按需新增 `targets`。
