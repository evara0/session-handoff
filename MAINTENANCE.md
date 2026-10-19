---
title: 'session-handoff · 项目维护卡'
project: session-handoff
updated: '2026-10-19'
status: '本地实现、结构校验、自动测试与合成输出审阅；未全局安装或远端发布'
environments:
  - 'local-windows'
---

# session-handoff · 项目维护卡

**改仓库内的 skill，运行校验，再按需要同步到安装副本。**

本项目将可见会话整理为可携带的 Markdown 交接，不运行常驻服务。

## 项目是什么

| 部分 | 技术与位置 |
| --- | --- |
| 前端／后端／数据库 | 均无；没有服务端口 |
| 技能 | `skills/session-handoff/SKILL.md`，引用同目录 references 和 assets |
| 开发工具 | Node.js 22+、npm、YAML 2.9.1；依赖锁定在 package-lock.json |
| 测试与样例 | `test/`、`evals/`；全部为合成输入和参考输出 |
| 规范 | `openspec/changes/add-session-handoff-skill/`，已实施但未归档 |

## 本地怎么运行

当前源码目录为 Windows 的 `G:\session-handoff`。移动仓库后以实际路径为准；文档不依赖这个绝对路径。

在 PowerShell 中：

```powershell
Set-Location G:\session-handoff
npm ci
npm test
npm run validate:examples
```

成功表现是测试全部通过、四份输出均报告 `metadata valid (content not verified)`。命令完成即退出，无启动、停止或重启进程。使用 skill 不需要安装这些开发依赖，直接让 agent 阅读 SKILL.md 或复制完整 skill 目录到其技能目录。安装说明见 [README](README.md#安装与分发)。

本地 OpenSpec CLI 可运行 `openspec validate add-session-handoff-skill --strict --no-interactive`。技能基础检查可使用本机已有 skill-creator 的 quick_validate.py；这不是仓库运行依赖。

## 改什么，怎么生效

| 修改内容 | 文件 | 生效与验证 |
| --- | --- | --- |
| 交接行为 | `skills/session-handoff/SKILL.md` | 下一次读取新指令生效，审阅对应案例 |
| 元信息约定 | `references/metadata.md` 和模板 | 同步校验器及测试，运行 npm test |
| 输出骨架 | `assets/handoff-template.md` | 填充后使用；模板本身有占位符，不能直接当成成品 |
| 结构校验 | `tools/validate-handoff.mjs` | 运行 npm test 和 validate:examples |
| 开发依赖 | package.json、package-lock.json | npm ci 后运行测试 |

表中 references、assets 路径相对 skill 目录。安装副本不会自动同步源码修改。公开案例被 Git 跟踪；真实交接应保存在被忽略的 `handoffs/` 或 `.local/`。原始开发交接文档也被忽略，不包含在提交内。

## 本地更新与分发

修改前记录 Git 状态并保留未提交工作，先更新相应 OpenSpec change，再修改与验证。无需构建。分发整个 skill 目录及根 LICENSE 即可，目标已有版本应先比较差异并保留旧副本，避免丢失用户修改。全局安装与远端发布本次没有执行；没有自动覆盖、清理或上传行为。

## 出问题先做什么

- **格式失败：** 用 `node tools/validate-handoff.mjs <文件>` 取得固定错误类别，对照[字段契约](skills/session-handoff/references/metadata.md)。修订加 `--previous <原版>` 检查日期保留，不会写回文档。
- **缺少 yaml 包：** 在仓库根运行 npm ci；网络代理或 registry 异常先核对本机 npm 配置，仓库不保存代理和凭据。
- **语义错误：** 对照可见证据审阅事实、建议、状态、路径与授权；不要以格式通过证明交接正确。
- **日志与恢复：** 工具输出在终端，无常驻日志。Git 提供已提交源码版本；没有自动备份真实交接或安装副本，覆盖前自行保留。恢复源码时先保存当前工作，再选择 Git 版本，避免硬重置丢失修改。

验证范围与限制见[验证记录](docs/validation.md)。跨模型生成行为、全局技能发现和远端发布尚未实测。
