# 项目收发验证记录

日期：2026-10-21。Windows PowerShell；Node.js 22.22.2、npm 10.9.7、OpenSpec 1.13.0。测试只使用临时合成项目，没有向真实其他项目投递或安装全局副本。后续归档与远端更新按用户明确授权执行。

## 自动验证

- `npm test`：55 项测试，包含旧版 34 项回归及新增收发、命名和分发约束。
- `npm run validate:examples`：旧格式四份参考输出及新路由命名示例共五份通过。
- `openspec validate --all --strict --no-interactive`：归档前检查主规范与两个变更；归档后检查三份主规范。`openspec validate --archived --strict --no-interactive` 检查两份归档变更，均通过。
- skill-creator `quick_validate.py skills/session-handoff`：技能结构检查，不代替行为验证。

收发测试覆盖：双向目录幂等初始化、同毫秒不同身份、ASCII 命名、中文命名拒绝、中文项目通过英文别名生成且内容保留中文、只生成不写目标、组合生成发送、未知目标仅在副本补全、重复投递幂等、冲突不覆盖、失败保留 outgoing、外部改名恢复、旧文档显式导入、路由字段完整性、修订身份保持、只读列表、dry-run、错误不回显输入、junction 拒绝及正文指令不执行。

按用户修订，已将 source_project/topic 及规范文件名限定为 ASCII，并同步校验、skill、命令示例和样例文件名。新增测试确认中文路由字段在 send/receive 写入目标前即失败；不修改已有真实交接，历史中文路由文档需显式重新生成合规身份后传递。没有路由字段的旧 v1.0 文档仍可通过 receive 配合英文 source-name/topic 导入。

## 独立副本演练

本节记录 ASCII 命名修订前的独立依赖与收发演练；本次命名变更通过上面的 55 项回归检查，未重新安装依赖或向真实项目发送。

仅复制 skills/session-handoff 到项目内已忽略的 `.local/routing-eval-31ec08bd/skill`，在副本目录执行 `npm ci --ignore-scripts --offline --no-fund --no-audit`，只安装一个 yaml 依赖，并确认解析路径位于副本自己的 node_modules。该演练不使用仓库 tools/。

在同一隔离目录创建 source-project 与 target-project，从接收项目工作目录调用副本脚本，依次执行 init、create、send、重复 send、receive、list 和 validate。结果：

| 观察 | 结果 |
| --- | --- |
| 初始化 | incoming/outgoing 均创建 |
| 生成 | 源 outgoing 文档存在，规范文件名 |
| 投递 | 同名目标 incoming 存在，补全实际目标 |
| 重复 send 与 receive | 均为 already-present |
| 列表 | incoming 仅一份文档 |
| 源文件 | 逐字节比较，未改变 |
| 结构校验 | metadata valid (content not verified) |

演练过程中曾发现 npm 在带 --prefix 的生成锁文件操作中意外添加父仓库 file: 链接。已移除该依赖并在 skill 自身工作目录重新生成锁文件，重新复制并独立安装验证成功；新增测试锁定依赖清单，防止再次引入父项目耦合。旧演练材料保留在 .local/，不进入 Git。

## 范围与限制

文档正文依然由 agent 对照可见证据撰写，脚本只负责格式、位置、身份和传递。结构与收发成功不代表事实、脱敏或授权真实。没有独立模型生成评测；没有 SSH/云传输、全局发现或真实项目端到端业务执行。正文引用的附件不随脚本自动复制，必须另行提供或复现。

旧版合成输入和输出为兼容夹具，不按新规范自动重命名。用户于 2026-10-21 明确要求归档后，按先初版、后收发完善的顺序归档两个变更，当前主规范包含 ASCII 命名与完整收发约定；归档位于 openspec/changes/archive/2026-10-21-add-session-handoff-skill 和 2026-10-21-add-project-handoff-routing。
