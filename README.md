# session-handoff

把当前可见会话整理成一份其他项目、会话或 coding agent 能接续的 Markdown 交接文档。每份输出都包含 YAML 元信息，清楚区分事实、建议、失败、上下文缺口和授权边界。

## 使用

可直接让 agent 阅读 [SKILL.md](skills/session-handoff/SKILL.md) 并执行：

```text
使用 session-handoff，把当前工作交接到 handoffs/export.md。
重点保留当前状态、未提交改动、失败尝试、下一步与验收方法。
```

支持已安装技能调用语法的环境可使用 `$session-handoff`。也可以指定“只交接分页子任务，用英文”或“更新已有交接，保留原创建日期”。未指定路径时写入当前项目 `handoffs/session-handoff-YYYY-MM-DD.md`，同名文件默认加后缀避免覆盖。

交付包含实际文档链接和可粘贴的启动提示词。只交接当前可见信息，无法访问的旧历史或附件会明确标记；交接文档本身不授予接收方新权限。

## 安装与分发

将整个 `skills/session-handoff/` 目录复制到目标 agent 支持的技能目录，保留内部相对结构；具体发现路径由目标 agent 决定。没有技能发现机制时，直接引用该目录的 SKILL.md。无需部署服务、配置 API 或安装 Node.js 才能使用 skill。

修改时以本仓库为唯一源码，安装目录仅作副本；更新前比较差异、保留目标旧版本，再同步已审阅的 skill 文件。本仓库没有自动安装或覆盖脚本。

分发时包含 skill 目录以及根目录 [LICENSE](LICENSE)，保留 MIT 版权与许可说明。无需分发 node_modules、OpenSpec、开发工具或本地交接材料。本项目本次仅完成本地实现，尚未发布远端或安装全局副本。

## 输出格式

每份文档以 YAML 1.2 front matter 开始，字段定义见 [元信息契约](skills/session-handoff/references/metadata.md)，骨架见 [模板](skills/session-handoff/assets/handoff-template.md)。模板需填充、转义并裁剪，不能直接当成完整交接。

必需字段为 `title`、`type`、`schema_version`、`created`、`updated`、`status`、`tags`、`language`、`source_agent`、`source_workspace`、`target_workspace`。未知来源或工作空间写 `null`；日期和版本用带引号的字符串；更新保留 `created`。状态不是授权。

完整输出例子：[普通交接](evals/outputs/ordinary.md)、[英语子任务](evals/outputs/subtask.md)、[失败与材料缺失](evals/outputs/blocked.md)、[更新交接](evals/outputs/revised.md)。这些都是合成资料，不能当作真实项目状态。

## 本地开发与验证

开发校验需要 Node.js 22 或更新版本及 npm；skill 使用无此依赖。在仓库根目录运行：

```sh
npm ci
npm test
npm run validate:examples
node tools/validate-handoff.mjs path/to/handoff.md
node tools/validate-handoff.mjs path/to/revised.md --previous path/to/original.md
```

校验 CLI 不修改文件，成功退出码为 0，文档无效或读失败为 1，参数错误为 2。输出只包含路径与错误类别，不回显正文或 YAML 输入值。可选原版参数仅接受一个修订文件。带扩展字段的文档仍可校验，扩展字段业务含义不在检查范围。

安装了 OpenSpec CLI 的开发环境还可运行：

```sh
openspec validate add-session-handoff-skill --strict --no-interactive
openspec status --change add-session-handoff-skill
```

有 skill-creator 的环境可运行其 `quick_validate.py skills/session-handoff`；它只做技能结构检查。合成场景、参考输出与审阅方法见 [evals/cases.md](evals/cases.md) 和 [验证记录](docs/validation.md)。本地原始会话应放在已忽略的 handoffs/ 或 .local/，不要混入公开案例。

## 限制

格式校验不证明事实准确、秘密已全部移除、元信息与正文一致、授权真实或接收方能访问材料。这些需要对照可见证据审阅；合成参考输出也不能替代不同模型上的真实行为测试。不提供历史导入、私有会话数据库读取、自动迁移或自动发布。

维护入口见 [MAINTENANCE.md](MAINTENANCE.md)。许可证：[MIT](LICENSE)。
