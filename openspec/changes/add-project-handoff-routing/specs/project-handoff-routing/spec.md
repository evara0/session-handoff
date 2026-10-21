## Purpose

为每个项目提供独立且一致的交接收件箱和发件箱，以可识别的文件名与稳定身份支持只生成、主动投递、外部导入、检查和重复传递，同时保护已有文件并保留来源文档以便审阅与重试。

## ADDED Requirements

### Requirement: Fixed project layout

脚本 MUST 仅在用户指定的现存项目根下使用 handoff/incoming 和 handoff/outgoing；初始化 SHALL 幂等创建两目录，列表 SHALL 只读。MUST 拒绝存储层级的符号链接或 junction，以及非法方向与越界源文件。

#### Scenario: Initialize a bidirectional project
- **WHEN** 对一个存在的项目执行初始化两次
- **THEN** 两目录存在且原文件内容不变

#### Scenario: Reject redirected storage
- **WHEN** handoff 或其 incoming/outgoing 是指向其他位置的链接
- **THEN** 操作失败，不写入链接目标

### Requirement: Stable portable filename

新文档 MUST 使用 `YYYYMMDDTHHmmssSSSZ__<source>__<topic>__<id8>.md`，时间为 UTC 毫秒，source/topic 为小写 Unicode 字母、数字和连字符且最多 32/48 字符，id8 为完整 UUID 的前八个十六进制字符。MUST 保存 handoff_id、created_at、source_project、topic，文件名与元信息一致。传递 SHALL 保留身份和名称。

#### Scenario: Concurrent generation with a Chinese topic
- **WHEN** 同一毫秒生成同项目同主题的两份文档
- **THEN** 两文档通过不同 UUID 区分且不覆盖；中文主题保留，名称无路径分隔符或 Windows 非法字符

### Requirement: Generate only or generate and send

生成 SHALL 使用显式正文文件和真实的当前日期组装有效元信息，写入 outgoing；可选组合发送 MUST 要求明确目标。只生成 MUST 不写目标。组合发送失败 MUST 保留已生成源文件并报告其路径。dry-run MUST 不创建目录或文件。

#### Scenario: Generate and delivery fails
- **WHEN** 生成成功但目标已有同名不同内容文件
- **THEN** 返回失败和可供重试的源文件路径，保留 outgoing，不覆盖目标

#### Scenario: Preview delivery
- **WHEN** 用户对生成或投递执行 dry-run
- **THEN** 仅报告计划位置，没有任何项目目录或文档被创建

### Requirement: Copy delivery with explicit routing

发送 MUST 校验源文件位于指定源项目 outgoing 且名称与身份匹配；接收导入 SHALL 接受外部文件并生成规范名。目标路径 MUST 是明确的现存项目根。目标字段未知时 SHALL 只在收件副本补全实际 target_workspace；已指向不同目标时 MUST 拒绝。MUST 保留正文、工作状态、created/updated 与 outgoing 原件。同名同内容 SHALL 幂等成功，不同内容 MUST 报冲突，不提供隐式覆盖。

#### Scenario: Send a previously untargeted document twice
- **WHEN** outgoing 的 target_workspace 为 null，同一文档向明确目标发送两次
- **THEN** incoming 中仅一份文档，目标字段为实际目标，第二次为 already-present，源文件不变

#### Scenario: Import a legacy document
- **WHEN** 外部文档符合原元信息契约但缺少路由身份，用户提供来源简称与主题
- **THEN** 导入 incoming 时添加新身份和规范名，保留原创建日期及正文，不修改外部原件

#### Scenario: Invalid metadata or mismatched target
- **WHEN** 元信息无效、路由身份不完整、或已指定的目标与实际投递目标不同
- **THEN** 写入前失败，不回显输入中的秘密值，不修改源或目标文档

### Requirement: Distributed scripts and non-executing receipt

skill 分发目录 MUST 包含脚本与其依赖清单，复制后可独立安装运行，不依赖仓库开发工具。接收和列表 MUST 不执行正文命令、不改变工作状态、不授予新权限；格式校验通过不证明事实或秘密已检查。

#### Scenario: Installed copy outside repository
- **WHEN** 仅将 skill 目录复制到隔离位置并按锁文件安装依赖
- **THEN** 初始化、生成、传递、接收和校验仍可运行，无需仓库 tools 目录
