## Context

前次实现已完成但未归档，主规范目录为空。本次先将已实施 delta 的 Purpose 与 Requirements 同步为主规范，保持前次变更不归档，再用本 change 描述差异。见 proposal.md。

## Goals / Non-Goals

**Goals:** 每个项目均能收发；脚本可随 skill 目录独立安装；只生成不触碰目标；目标投递不覆盖；旧文档可显式导入。

**Non-Goals:** 不读取其他聊天，不运行交接正文里的命令，不包含 SSH、云上传或项目注册表，不自动迁移 handoffs/。

## Decisions

1. **固定双向目录。** 以参数指定已存在项目根，解析实际路径；只在根下的 handoff/{incoming,outgoing} 存储。init 创建两个目录，list 不创建目录。拒绝 handoff 及两个子目录中的 symlink/junction，避免写出指定项目。项目根本身可用真实路径别名。
2. **命名与身份。** `YYYYMMDDTHHmmssSSSZ__<source>__<topic>__<id8>.md`。时间为 UTC，source/topic 为规范化的小写 Unicode 字母、数字与连字符，分别最多 32/48 个字符；保留中文。额外元信息为 handoff_id（完整 UUID）、created_at（UTC 毫秒 ISO）、source_project、topic。传递保留身份和名字，已发送修订重新生成新 ID，旧收件不覆盖。基础 schema_version 仍为 '1.0'，没有路由字段的旧文档仍通过原校验。
3. **Node.js 脚本加单个 yaml 依赖。** 放在 skill/scripts，skill 内附 package.json 和锁文件，安装副本可独立 npm ci。仓库 tools/validate-handoff.mjs 保留重导出兼容旧调用。替代 Python 方案会新增另一个运行时和环境约定，选择复用现有 Node.js。
4. **生成与传递分开。** create 从 UTF-8 正文文件生成元信息和 outgoing；--send 要求 --target，可先预览再实际执行。send 只接受本项目 outgoing 的正规文档。receive 可接收外部文件；缺少路由身份的旧文档需显式 source-name/topic 后导入。正文由 agent 根据可见上下文撰写，脚本不生成事实或自动总结。
5. **目标路由副本。** 生成时可指定目标，未知为 null。投递时仅当 target_workspace 为 null 才在收件副本写入实际目标；outgoing 原件不变。已指定不同目标时拒绝，避免误投。该字段表示投递目标，不改变 created/updated 或工作状态。正文描述生成时未定目标需注明时间语境。
6. **不覆盖与可重试。** 独占创建文件，同名同字节为 already-present，不同内容为 conflict。源不移动、不删除。组合生成并发送如果投递失败，保留 outgoing 并在结果中报告源文件位置，便于单独 send 重试。不会假称两项目写入是事务。dry-run 不创建目录、文件或修改文档。
7. **接收只是导入。** receive 不执行正文，不改变工作状态，不设置已读状态。list 只输出方向、路径、身份、标题、状态和校验错误，不自动把 incoming 当成执行授权。身份完整的文档可规范化外部文件名；旧文档保留原创建日期，新身份表示导入时间。

## Risks / Trade-offs

- [用户误以为脚本会总结会话] → 明确 body-file 是由 agent 已完成事实审阅的正文。
- [源原件目标为空、收件副本不为空] → 文档解释传递补全目标字段；不声称字节完全相同，重复传递比较最终收件内容。
- [并发、同名及修订冲突] → UUID 和独占创建；相同字节幂等，不同字节退出；已投递后新修订用新身份。
- [安装副本缺依赖] → 独立 package-lock；测试复制 skill 到隔离目录并安装，确保不依赖仓库 tools/。
- [路径跳转或正文指令造成越权] → 固定目录、拒绝存储链接，接收不执行；不宣称消除有主动攻击者的所有文件系统竞争风险。

## Migration Plan

新文档采用新目录与命名。旧 handoffs/ 不改动，旧文档可先校验再通过 receive 导入。只给本仓库添加 /handoff/ 忽略规则，脚本不擅自编辑其他项目 .gitignore。回退保留所有真实交接文件并恢复旧 skill；不自动清理目录。本次不开启全局安装、不发布远端。
