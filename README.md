# session-handoff

把当前可见会话整理成其他项目、会话或 coding agent 能接续的 Markdown。每个项目既可发出，也可接收交接；文档包含 YAML 元信息，区分事实、建议、失败、上下文缺口和授权边界。

## 使用

可直接让 agent 阅读 [SKILL.md](skills/session-handoff/SKILL.md) 并执行：

```text
使用 session-handoff，为当前项目生成一份“分页修复”交接，先不发送。
保留状态、未提交改动、失败、下一步与验收方法。
```

支持技能调用语法的环境可使用 `$session-handoff`。也可以说“生成后直接传到 G:\target-project”或“读取当前项目 handoff/incoming 中的分页交接，按我的要求继续”。只生成不触碰目标；只有明确要求传递才投递。

交付实际文档链接及可粘贴的启动提示词；已投递时同时给出收件路径和结果。缺失历史或附件会标记，交接本身不授予新权限。

## 固定目录与命名

```text
project/
└── handoff/
    ├── incoming/    接收与外部导入
    └── outgoing/    本项目生成、保留的发件快照
```

新文件统一命名为：

```text
YYYYMMDDTHHmmssSSSZ__<source>__<topic>__<id8>.md
20261021T020304005Z__sample-project__pagination-fix__a1234567.md
```

UTC 毫秒时间＋来源项目英文简称＋英文主题＋UUID 前八位，整个文件名只用 ASCII 字符。来源和主题只允许小写英文字母 a-z、数字 0-9 及连字符，转小写，空格与下划线转连字符；长度最多 32/48 字符。中文项目目录需显式传入英文 --source-name，中文命名参数会被拒绝，不自动音译；标题、正文和工作空间路径仍可中文。传递保留身份与名称，同名同内容幂等、不同内容不覆盖；已发送后的修订用新身份。详见[收发与命名规范](skills/session-handoff/references/routing.md)。

旧 handoffs/ 不会自动搬迁；旧格式仍可校验或通过 receive 显式导入。真实交接建议排除 Git，本仓库已忽略 /handoff/。

## 脚本快速使用

脚本需要 Node.js 22+。在仓库根 npm ci 后，用 PowerShell 执行以下命令（示例项目需替换为已有目录，正文文件需先准备好）：

```powershell
$scriptDir = (Resolve-Path ./skills/session-handoff/scripts).Path
$sourceProject = 'G:\example-source'
$targetProject = 'G:\example-target'
$bodyFile = 'G:\example-source\.local\handoff-body.md'

# 初始化双向目录；create 和投递也会按需初始化
node "$scriptDir/init-handoff.mjs" --project "$sourceProject"

# 只生成；body-file 是不含 front matter 的 Markdown 正文
node "$scriptDir/create-handoff.mjs" --project "$sourceProject" --title '分页修复交接' --topic pagination-fix --status in-progress --body-file "$bodyFile"

# 生成后立即发送
node "$scriptDir/create-handoff.mjs" --project "$sourceProject" --title '分页修复交接' --topic pagination-fix --status in-progress --body-file "$bodyFile" --target "$targetProject" --send

# 稍后发送 create 返回的 file；先预览，可去掉 --dry-run 正式发送
$outgoingFile = '替换为 create 返回的实际 file 路径'
node "$scriptDir/send-handoff.mjs" --project "$sourceProject" --file "$outgoingFile" --target "$targetProject" --dry-run

# 导入外部正规文档，查看 incoming
node "$scriptDir/receive-handoff.mjs" --project "$targetProject" --file 'G:\downloads\external.md'
node "$scriptDir/list-handoffs.mjs" --project "$targetProject" --direction incoming
```

init/create/send/receive 支持 --dry-run，不创建目录或文件。完整参数、旧文档导入与失败重试见[脚本说明](skills/session-handoff/references/routing.md#脚本与参数)。脚本仅支持本机或已挂载目录，不内置 SSH/云传输。

生成时目标未知为 null；发送只在 incoming 副本补全目标，outgoing 不变。目标已指定为另一项目时拒绝。传递保留正文、状态和内容日期，不自动复制附件、执行正文或删除源文件。组合发送失败仍保留 outgoing，可单独 send 重试。

## 安装与分发

将整个 `skills/session-handoff/` 目录复制到目标 agent 支持的技能目录，保留内部相对结构；具体发现路径由目标 agent 决定。没有技能发现机制时，直接引用 SKILL.md。纯指令使用无需 Node.js；运行收发脚本时在副本目录执行 `npm ci --ignore-scripts --no-fund --no-audit`，依赖锁定在副本的 package-lock.json，不依赖仓库 tools/。

修改时以本仓库为唯一源码，安装目录仅作副本；更新前比较差异、保留目标旧版本，再同步已审阅的 skill 文件。本仓库没有自动安装或覆盖脚本。

分发时包含 skill 目录以及根目录 [LICENSE](LICENSE)，保留 MIT 版权与许可说明。无需分发 node_modules、OpenSpec、开发工具或真实交接材料。初版已发布到 GitHub；本次完善不自动推送或安装全局副本。

## 输出格式

每份文档以 YAML 1.2 front matter 开始，字段定义见 [元信息契约](skills/session-handoff/references/metadata.md)，骨架见 [模板](skills/session-handoff/assets/handoff-template.md)。模板需填充、转义并裁剪，不能直接当成完整交接。

基础必需字段为 `title`、`type`、`schema_version`、`created`、`updated`、`status`、`tags`、`language`、`source_agent`、`source_workspace`、`target_workspace`。未知来源或工作空间写 null，日期和版本用带引号字符串。新文档还包含 `handoff_id`、`created_at`、`source_project`、`topic`，用于命名与传递；旧文档缺少整组路由字段仍兼容。状态不是授权。

输出例子：[新命名与路由](evals/outputs/20261021T020304005Z__sample-project__pagination-fix__a1234567.md)；旧格式兼容例子：[普通交接](evals/outputs/ordinary.md)、[英语子任务](evals/outputs/subtask.md)、[失败与材料缺失](evals/outputs/blocked.md)、[更新交接](evals/outputs/revised.md)。均为合成资料。

## 本地开发与验证

开发与脚本需要 Node.js 22+ 及 npm。在仓库根目录运行：

```sh
npm ci
npm test
npm run validate:examples
node tools/validate-handoff.mjs path/to/handoff.md
node tools/validate-handoff.mjs path/to/revised.md --previous path/to/original.md
```

校验 CLI 不修改文件，成功为 0，文档无效或读失败为 1，参数错误为 2，不回显正文或 YAML 输入值。原版参数仅接受单修订文件。实现已移入 skill/scripts，tools/ 入口保留兼容。路由字段出现任一项时必须整组有效；其他扩展业务含义不检查。

安装了 OpenSpec CLI 的开发环境还可运行：

```sh
openspec validate --all --strict --no-interactive
openspec status --change add-project-handoff-routing
```

有 skill-creator 的环境可运行其 `quick_validate.py skills/session-handoff`；它只做结构检查。原合成场景见 [evals/cases.md](evals/cases.md)，本次脚本测试与演练见[验证记录](docs/routing-validation.md)。真实会话放在 handoff/ 或 .local/，不要混入公开案例。

## 限制

格式校验不证明事实准确、秘密已全部移除、元信息与正文一致、授权真实或接收方能访问材料。这些需要对照可见证据审阅；合成参考输出也不能替代不同模型上的真实行为测试。不提供历史导入、私有会话数据库读取、自动迁移或自动发布。

维护入口见 [MAINTENANCE.md](MAINTENANCE.md)。许可证：[MIT](LICENSE)。
