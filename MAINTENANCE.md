---
title: 'session-handoff · 项目维护卡'
project: session-handoff
updated: '2026-10-21'
status: 'v1.1 本地测试与独立副本收发演练；初版已推送，本次未推送或全局安装'
environments:
  - 'local-windows'
---

# session-handoff · 项目维护卡

**改仓库内的 skill，运行校验，再按需要同步到安装副本。**

本项目生成、接收和按需传递 Markdown 交接，固定存储在各项目 handoff/incoming 与 handoff/outgoing，不运行常驻服务。

## 项目是什么

| 部分 | 技术与位置 |
| --- | --- |
| 前端／后端／数据库 | 均无；没有服务端口 |
| 技能 | `skills/session-handoff/SKILL.md`，引用同目录 references、assets 和 scripts |
| 脚本与开发工具 | Node.js 22+、npm、YAML 2.9.1；仓库和 skill 内均有锁文件，副本可独立安装 |
| 测试与样例 | `test/`、`evals/`；全部为合成输入和参考输出 |
| 规范 | `openspec/specs/` 为初版基线；当前变更 `add-project-handoff-routing`，旧 change 保留不归档 |

## 本地怎么运行

当前源码目录为 Windows 的 `G:\session-handoff`。移动仓库后以实际路径为准；文档不依赖这个绝对路径。

在 PowerShell 中：

```powershell
Set-Location G:\session-handoff
npm ci
npm test
npm run validate:examples
```

成功表现是测试全部通过、五份输出均报告 `metadata valid (content not verified)`。命令完成即退出，无启动、停止或重启进程。纯指令使用无运行时依赖；收发脚本需要 Node.js 与 yaml。安装副本时进入 skill 目录执行 `npm ci --ignore-scripts --no-fund --no-audit`；无需仓库开发文件。详见 [README](README.md#安装与分发)。

在仓库根，初始化当前项目可运行 `node skills/session-handoff/scripts/init-handoff.mjs --project .`。create 需要已审阅的正文文件；生成、发送、接收和列表参数见[收发规范](skills/session-handoff/references/routing.md)。脚本无需配置端口、服务或 API。只生成不传递；实际投递必须明确目标和授权，--dry-run 不写文件。

OpenSpec 检查运行 `openspec validate --all --strict --no-interactive`。技能基础检查可使用本机已有 skill-creator 的 quick_validate.py；不是仓库运行依赖。

## 改什么，怎么生效

| 修改内容 | 文件 | 生效与验证 |
| --- | --- | --- |
| 交接行为 | `skills/session-handoff/SKILL.md` | 下一次读取新指令生效，审阅对应案例 |
| 元信息约定 | `references/metadata.md` 和模板 | 同步校验器及测试，运行 npm test |
| 输出骨架 | `assets/handoff-template.md` | 填充后使用；模板本身有占位符，不能直接当成成品 |
| 收发和结构校验 | `scripts/*.mjs`、`scripts/lib/`；仓库 tools/ 是兼容入口 | 运行 npm test 和 validate:examples |
| 开发与脚本依赖 | 根目录和 skill 内 package.json、package-lock.json | 进入对应目录运行 npm ci，再测试 |

表中 references、assets、scripts 路径相对 skill 目录。安装副本不会自动同步源码修改。公开案例被 Git 跟踪；真实交接保存在已忽略的 `handoff/`，临时正文放 `.local/`。旧 `handoffs/` 和原始开发交接也被忽略，不会自动迁移；脚本不会替其他项目修改 .gitignore。

## 本地更新与分发

修改前记录 Git 状态并保留未提交工作，先更新 OpenSpec change，再修改与验证。无需构建。分发完整 skill 目录（包括其脚本、清单和锁文件）及根 LICENSE，目标已有版本先比较差异并保留旧副本。初版 9ca18d6 曾推送至 https://github.com/evara0/session-handoff；本次完善没有自动推送或全局安装。

## 出问题先做什么

- **格式失败：** 用 `node tools/validate-handoff.mjs <文件>` 取得固定错误类别，对照[字段契约](skills/session-handoff/references/metadata.md)。修订加 `--previous <原版>` 检查日期保留，不会写回文档。
- **缺少 yaml 包：** 仓库开发在根目录运行 npm ci；安装副本在 skill 目录运行 npm ci。网络代理或 registry 异常先核对本机 npm 配置，仓库不保存代理和凭据。
- **投递失败：** 先核对错误类别和目标目录。组合生成发送失败时从错误 JSON 的 outgoing 找回源文件，修正目标问题后单独 send 重试；file.conflict 不覆盖，应核查是否发送了同一身份的修改版。已投递后的修订生成新身份。
- **目录链接被拒绝：** handoff 及 incoming/outgoing 不支持 symlink 或 junction，使用项目内实际目录，不绕过路径检查。
- **语义错误：** 对照可见证据审阅事实、建议、状态、路径与授权；不要以格式通过证明交接正确。
- **日志与恢复：** 工具输出在终端，无常驻日志。Git 提供已提交源码版本；没有自动备份真实交接或安装副本，覆盖前自行保留。恢复源码时先保存当前工作，再选择 Git 版本，避免硬重置丢失修改。

当前验证见[收发验证记录](docs/routing-validation.md)，初版记录见[历史验证](docs/validation.md)。跨模型生成行为、全局技能发现、跨机器网络传输未实测；本次只在合成项目内完成本地收发。
