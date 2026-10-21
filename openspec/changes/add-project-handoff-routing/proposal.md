## Why

现有版本只生成交接文档，默认目录为 handoffs/，没有统一接收位置或可分发的传递脚本。项目需要同时作为发送方与接收方，并用稳定名称识别文档、避免冲突和重复投递。

## What Changes

- **BREAKING**：新文档固定写入项目 `handoff/outgoing/`，接收写入 `handoff/incoming/`，不再默认任意文件名或 handoffs/。
- 采用 UTC 毫秒时间戳、来源项目、主题和 UUID 短段组成的文件名，支持中文及稳定传递身份。
- 提供初始化、生成、发送、接收导入、只读列表与校验脚本；支持只生成及生成后直接发送。
- 投递保留源文档；重复相同内容幂等，不同内容报冲突；提供 dry-run，拒绝存储目录链接跳转。
- 将校验实现放进可分发 skill，保留仓库旧入口；脚本使用 Node.js 与锁定的 yaml，纯指令使用不要求运行时。
- 将前次已实施变更的两份规范同步为主规范基线，保留原 change 不归档，供本次 MODIFIED 引用。

## Capabilities

### New Capabilities
- `project-handoff-routing`: 固定收发目录、命名身份及本地文件交接生命周期。

### Modified Capabilities
- `session-handoff`: 文档输出路径、生成和接收两种使用方式及脚本交付约定。

## Impact

涉及 skill 指令、模板、脚本及其依赖清单、测试、README、维护卡和 Git 忽略规则。v1.0 旧文档仍可只读校验并显式导入，不自动迁移、删除旧目录或改变用户 Git 忽略规则。仅在临时合成项目测试，不向真实其他项目投递、不自动推送或全局安装。
