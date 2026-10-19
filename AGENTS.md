# 仓库工作约定

- 本仓库是 session-handoff 的唯一编辑源；`skills/session-handoff/` 是可分发的 skill，仓库开发工具不属于运行依赖。
- 持久化行为变更先在 OpenSpec 中记录 proposal、spec、design、tasks，再实施与验证。未经用户要求不自动归档。
- 原始会话、真实业务资料、秘密和本机配置不放入 Git；公共案例只使用合成输入。
- 使用 `npm ci` 安装开发依赖，`npm test` 运行测试；`npm run validate:examples` 校验参考文档。
- 修改 skill 时检查元信息契约、模板与案例的一致性；不能以格式通过代替事实和授权审阅。
- 不自动发布、推送或安装全局副本。用户明确授权时按授权范围操作。
