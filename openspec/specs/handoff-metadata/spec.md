## Purpose

为所有交接输出定义一致且可机器读取的 YAML 元信息，支持跨项目检索、未知信息表达和既有文档修订，同时明确结构校验只证明格式契约成立，不能替代正文事实与证据的核对。

## Requirements

### Requirement: Mandatory metadata

每份输出 MUST 以由两行独立 `---` 包围的 YAML 1.2 mapping 开始，且有非空正文。MUST 包含非空字符串 title、status、language，固定 type 为 session-handoff，带引号版本字符串 schema_version 为 '1.0'，带引号的真实 YYYY-MM-DD 日期 created、updated，以及至少一个非空字符串构成的 tags 列表。source_agent、source_workspace、target_workspace MUST 为非空字符串或 null。MUST 拒绝重复键、类型错误及 updated 早于 created。元信息 MUST 与正文一致，不携带秘密或虚构未知值。

#### Scenario: Unknown origin and Windows path
- **WHEN** 来源 agent 未知而来源工作空间是 Windows 路径
- **THEN** source_agent 为 null，路径正确引用并可解析，所有必需字段存在；没有将未知值伪造为已知

#### Scenario: Invalid metadata
- **WHEN** 文档缺少必需字段、包含重复键、日期类型错误、无效日历日期或倒置日期
- **THEN** 校验返回失败，不把该文档报告为有效，不回显输入正文或秘密值

### Requirement: Preserve creation date on update

修订既有交接文档时 MUST 保留 created，使用实际修订日期更新 updated，同步状态及变化字段；无法读取既有文档时 MUST 不假称保留过原始创建日期。

#### Scenario: Revise an existing handoff
- **WHEN** 用户更新已有交接文档且工作从 blocked 变为 in-progress
- **THEN** 原 created 不变，updated 使用修订日期，元信息及正文均反映新状态

### Requirement: Read-only validation

本地校验工具 SHALL 对文件和可选的原版本进行只读校验，成功退出码为 0，格式或访问失败为非零；CLI 输出 SHALL 只包含路径和不带输入值的错误类别。格式通过 SHALL 不被描述为事实、授权或脱敏已全部验证。

#### Scenario: Validate a revision
- **WHEN** 使用原版本校验修订文件，修订文件错误地改变 created
- **THEN** 工具失败且不修改任一文件
