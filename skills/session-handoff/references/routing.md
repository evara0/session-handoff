# 项目收发与命名规范

## 目录与角色

```text
project/
└── handoff/
    ├── incoming/    # 接收其他项目或外部导入的文档
    └── outgoing/    # 本项目生成并保留的发件快照
```

项目可同时收发。脚本显式接受项目根，不自动寻找父级 Git 仓库，也不改该项目 .gitignore。建议把含真实会话的 /handoff/ 排除出 Git；本仓库已排除。旧 handoffs/ 和已有文件不会自动移动、重命名或删除。

## 命名

```text
YYYYMMDDTHHmmssSSSZ__<source>__<topic>__<id8>.md
20261021T020304005Z__sample-project__pagination-fix__a1234567.md
```

- 时间来自创建身份时的真实时钟，为 UTC 毫秒（Z）。文档 created/updated 使用执行环境本地日期。
- source 默认项目目录名，可用 --source-name 指定；topic 必须显式提供。二者先 NFKC 规范化、转小写，空格及下划线转连字符；规范化后只允许 ASCII 小写英文字母 a-z、数字 0-9 和单个连字符，最多分别 32、48 字符。文件名不得含中文或其他非 ASCII 字符；中文项目目录必须显式提供英文 --source-name，主题使用英文 --topic。不自动音译或删除中文；非法或过长输入被拒绝。标题、正文及真实工作空间路径仍可中文。
- id8 为随机 UUID v4 的前八个十六进制字符，完整 UUID 存入 handoff_id。即使同一毫秒、项目和主题相同也可区分；极少数文件名冲突只会报错，不覆盖。
- 身份与文件名不含目标和收发方向，传递时保留。接收脚本可按元信息恢复被下载工具改动的文件名。
- 未发送的 outgoing 可原地修订并保留 created、created_at、handoff_id 和名称，按实际日期更新 updated。已经投递后再次修订使用新的生成身份；正文写明前版 ID。同名不同内容拒绝覆盖，不用 -2、时间后缀或改接收文件绕过冲突。

## 运行准备

使用脚本需要 Node.js 22+。完整 skill 目录包含 package.json/package-lock.json，复制后可在该目录运行 `npm ci --ignore-scripts --no-fund --no-audit`，不依赖仓库 tools/。仓库开发时根目录 npm ci 已提供 yaml，脚本可以直接运行，无需重复安装。纯指令模式不要求 Node.js；缺依赖时不能声称脚本已经运行。

下列 PowerShell 示例在仓库根执行；安装副本请把 scriptDir 指向副本的 scripts 目录。源项目、目标项目必须已经存在；body-file 由 agent 在事实审阅后准备，是不含 YAML front matter 的 Markdown 正文，不会由脚本自动总结。

```powershell
$scriptDir = (Resolve-Path ./skills/session-handoff/scripts).Path
$sourceProject = 'G:\example-source'
$targetProject = 'G:\example-target'
$bodyFile = 'G:\example-source\.local\handoff-body.md'
```

示例路径不代表本机已有这些项目，执行时替换为实际项目。

## 脚本与参数

| 脚本 | 必需参数 | 可选参数 |
| --- | --- | --- |
| init-handoff.mjs | --project | --dry-run |
| create-handoff.mjs | --project --title --topic --body-file --status | --language（默认 zh-CN）--source-name --source-agent --target --send --dry-run |
| send-handoff.mjs | --project --file --target | --dry-run |
| receive-handoff.mjs | --project --file | --source-name --topic（导入旧文档需两者）--dry-run |
| list-handoffs.mjs | --project | --direction incoming/outgoing/all（默认 all）|
| validate-handoff.mjs | 文件路径，可多个 | --previous 原版文件（仅单修订文件）|

每个脚本支持 --help。路径值中有空格时加引号，--file 使用实际文件路径（建议使用结果返回的绝对路径），不按 --project 自动拼接。收发脚本输出单行 JSON；成功为 0、文件或文档问题为 1、参数错误为 2。校验器保留可读文本输出。错误只给固定类别和必要路径，不回显输入正文。

### 初始化与只生成

```powershell
node "$scriptDir/init-handoff.mjs" --project "$sourceProject"
node "$scriptDir/create-handoff.mjs" --project "$sourceProject" --title '分页修复交接' --topic pagination-fix --status in-progress --body-file "$bodyFile"
```

create 返回 file，为新文档的 outgoing 路径。初始化不是必需前置动作，create 和实际投递会按需创建双方存储目录。只生成不触碰目标；即使指定 --target，只要没有 --send 也仅在元信息记录目标。

### 生成并直接投递

```powershell
node "$scriptDir/create-handoff.mjs" --project "$sourceProject" --title '分页修复交接' --topic pagination-fix --status in-progress --body-file "$bodyFile" --target "$targetProject" --send
```

已明确授权投递时才使用 --send。加 --dry-run 只预览，不创建目录或文档；预览中的 UUID/名称仅为计划，正式执行会重新生成，不预留文件名。

### 稍后发送与检查收件

```powershell
$outgoingFile = '替换为 create 返回的实际 file 路径'
node "$scriptDir/send-handoff.mjs" --project "$sourceProject" --file "$outgoingFile" --target "$targetProject" --dry-run
node "$scriptDir/send-handoff.mjs" --project "$sourceProject" --file "$outgoingFile" --target "$targetProject"
node "$scriptDir/list-handoffs.mjs" --project "$targetProject" --direction incoming
```

发送要求文档确实位于该源项目 outgoing，名称与身份一致，source_workspace 对应实际源项目。目标未知时，只在 incoming 副本中补全 target_workspace；正文和内容日期不变，outgoing 不变。已指定另一目标时拒绝，不暗中改投。

同名同内容返回 already-present；不同内容返回 file.conflict，保留两边原状。--dry-run 也检查现有冲突。如果组合 create --send 的投递阶段失败，退出为 1，但错误 JSON 中 outgoing 指明已保留的源文档；解决问题后单独 send 重试，不必重新生成。

### 接收外部文档与旧版导入

```powershell
node "$scriptDir/receive-handoff.mjs" --project "$targetProject" --file 'G:\downloads\external.md'
node "$scriptDir/receive-handoff.mjs" --project "$targetProject" --file 'G:\downloads\legacy.md' --source-name old-project --topic csv-fix
```

第一条适用于含完整路由身份的文档，复制到 incoming，保留身份并恢复规范名；第二条将无路由字段但基础元信息有效的旧文档规范导入，添加新的身份和导入时刻，保留原 created/updated、正文和外部原件。旧文档的每次显式导入会生成新身份；需要重复投递时使用首次导入后的正规文件。同一正规身份再次接收相同内容幂等。

接收不会执行正文、不把状态变为 completed，也不标记已读。先读文档并核对项目规则、证据与当前用户请求，再接续。引用文档不等于新的执行授权。

## 边界与恢复

脚本只支持本机或已挂载目录的文件传递，不内置 SSH/云传输。项目根可通过真实路径别名指定；handoff 及 incoming/outgoing 拒绝符号链接和 junction。目标必须已存在，源文件不移动不删除，没有自动覆盖选项。

投递只处理单个 Markdown，不自动复制其引用的附件；必要附件应另行准备相对材料或可复现步骤，并核对目标是否可访问。没有跨项目事务或自动备份，任何失败都应依据返回位置核查，不能假定全部完成。脚本不校验事实、脱敏与授权真实性。
