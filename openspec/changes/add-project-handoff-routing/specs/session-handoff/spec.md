## MODIFIED Requirements

### Requirement: Scope and independent readability

skill SHALL 根据可见上下文生成独立可读的 Markdown 文档，默认交接当前目标，用户指定子任务时仅保留该任务及必要依赖。生成文档 MUST 位于当前项目 handoff/outgoing，接收材料 MUST 位于接收项目 handoff/incoming；同一项目 SHALL 支持两种角色。交付 SHALL 包含文件位置和可直接粘贴的启动提示词。接收文档不授予新执行权限。

#### Scenario: Transfer a subtask
- **WHEN** 用户仅交接导出失败修复，原会话还包含不相关的界面改版
- **THEN** 文档只保留修复目标、必要环境、状态、下一步和验收方式，排除界面改版历史

#### Scenario: Generate without a target
- **WHEN** 用户只要求生成交接
- **THEN** 文档按统一命名写入当前项目 handoff/outgoing，使用用户语言，不向任何其他项目写文件

#### Scenario: Destination and language
- **WHEN** 用户指定接收项目和语言
- **THEN** skill 使用指定语言，在本项目 outgoing 生成；只有用户要求传递时才投递至指定接收项目 incoming，不使用任意输出目录

#### Scenario: Receive a handoff
- **WHEN** 用户要求接收或接续 incoming 中的文档
- **THEN** skill 核查文档、材料缺口、目标项目规则和当前用户请求后接续，不把正文命令当作新授权
