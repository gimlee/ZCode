# Batch 18 · ZCode Development Map

基线与 C/A/B 缩写同 [Batch 6](batch-6-repository-understanding.md)。本批是二次开发定位与验收建议，未修改功能；**变更前先 spec、架构检查和模块 context**，以下建议测试均不是本轮已执行测试。

## Findings

每一处改动都应同时定位“规则/状态 owner → 契约 → 当前实现 → 下游投影 → 验证”。Prompt、Model、Tool 都有公开接缝；Loop/Queue/Resume/远端恢复牵涉多个 owner，不能只补 UI 条件或超时。

## Key Source Files

| 17 个修改目标 | 当前主要位置 | 契约 / 连带点 | 应验证的场景 |
|---|---|---|---|
| System Prompt | `C/context/builder.ts:87`、`C/context/sections/identity.ts:1` | custom/workflow、meta-user instructions 与 tool guidance | default/custom/workflow；顺序与最终 request |
| Agent Loop | `C/runtime/methods/turn-loop.ts:43`、`turn-model-step.ts:235`、`turn-stop.ts:157` | command/turn/model-step 单位、Stop/goal/cancel | no tool/tool/error/output limit/Stop continuation |
| Provider | `packages/provider/src/config/provider-data-schema.ts:1`、`config-service.ts:223`、`A/model/model-execution.ts:344` | 同协议配置或新 api type、messages/tools/stream/auth | option-map body、reasoning/usage/tools、cancel/retry |
| Tool | `C/tool/types.ts:278`、`C/tool/handlers/index.ts:76`、`C/runtime/helpers/runtime-tools.ts:47` | schema/metadata/handler、model exposure、ports | input/output、permission、budget、registered vs visible |
| Tool Dispatcher | `C/tool/executor/call-runner.ts:65`、`impl.ts:89`、`batch-runner.ts:24` | hooks 改输入后校验、broker、scheduler | deny/approve/timeout/cancel、部分批次与结果配对 |
| Context 管理 | `C/runtime/methods/context.ts:31`、`C/runtime/helpers/provider-request-messages.ts:48` | canonical vs request projection、attachment 因果位置 | 多轮/tool pairing、system/reminder/媒体 |
| Context Compression | `C/compact/policy.ts:100`、`C/runtime/methods/compact-active.ts:75` | micro/auto/manual/reactive、tail 与 durable boundary | near limit、overflow、失败/中断恢复、rapid refill |
| Repository Search | `A/fs/index.ts:393,452`、`A/exec/embedded-search-prelude.ts:34`、`C/runtime/methods/embedded-search-branch.ts:11` | direct FS 与 Bash default branch、worker/CLI dispatch | ignore/glob/case/multiline、大输出、timeout/abort/fallback |
| File Edit | `C/tool/handlers/edit.ts:84`、`C/tool/edit-matchers.ts:40`、`A/fs/index.ts:291` | read freshness、encoding/newline、checkpoint | exact/normalized/ambiguous/replaceAll、外部更改、IO failure |
| Shell | `C/tool/handlers/bash.ts:97`、`A/exec/node-execution-adapter-run.ts:1` | shell provider、cwd/env、process tree/output、permission | Windows/macOS/Linux、foreground/background、timeout/cancel |
| Session | `B/app/session-facade.ts:1`、`C/runtime/methods/resume.ts:56`、`A/storage/session-store/sqlite-session-store.ts:225` | active branch/input/parts/read state、cold resume | restart、interrupted tool、queued input、archive/branch |
| MCP | `A/mcp/index.ts:157,438`、`C/mcp/index.ts:60`、`C/runtime/methods/mcp.ts:121` | descriptors/trusted authority、transport/auth/deadline | connect waiter、stdio close、HTTP auth、result/error/media |
| Skill | `A/skills/index.ts:58,94`、`roots.ts:19`、`C/tool/handlers/skill.ts:35` | metadata discovery vs正文、path identity、disabled | 重复名称/路径、变量、大小、symlink/禁用 |
| Plugin | `A/plugins/index.ts:127,587,648`、`B/app/startup-marks.ts:11`、`plugin-facade.ts:28` | enabled components / config / official features | disabled 不注入、安装失败清理、下一次 assembly、卸载 |
| Logging | `packages/ui/src/logger.ts:1`、`packages/services/src/logger/serviceLogger.ts:1`、`C/runtime/methods/events.ts:68` | 高频 debug 与生命周期 info、trace/IDs；不落凭据 | 关联 attempt/turn/tool；取消/错误可定位、敏感信息过滤 |
| Retry | `A/model/retry-policy.ts:1`、`runner-retry.ts:39`、`runner-stream.ts:1455`、`C/runtime/methods/streaming-recovery.ts:47` | physical retry vs Core recovery、admission release | Retry-After、预算、可见输出、工具提交、abort |
| Model Capability | `packages/provider/src/config/model-config.ts:1`、`A/model/model.ts:125`、`C/runtime/methods/config.ts:136` | properties/optionSpecs、tool/media/request 校验 | unsupported 请求拒绝、档位/上限、actual tools 与 descriptions |

默认内置 Provider 模板位置为 `config/provider/zcode-builtin.json`；作为账号规则而非 personal overlay 时还需当前 provider registry/rule schema。只新增 UI 品牌选项不会新增协议执行能力。

## Key Classes / Functions

`ContextBuilder.build`、`runRegularTurnLoop`、`ExecutableModel.prepareRequest`、`ToolRegistryImpl.toContracts`、`executeToolCall`、`NodeFileSystemAdapter`、`NodeExecutionAdapter`、`resumeFromStore`、`NodeMcpAdapter` 是表中主要接缝；精确链条见 [Batch 20](batch-20-call-chains.md)。

## Control Flow

修改流程：读当前 spec/package scripts/architecture policy → 定位 owner 与目标 module → 更新 spec 的产品规则、接口和验收 → 读取受控 module context → 增补行为/E2E 场景 → 有界实现 → 实际运行可用检查 → 报告真实结果。发现设计缺陷先对齐，不继续叠加兜底分支。本轮仅文档分析，不产生新的产品 spec 或行为。

## Data Flow

涉及远端必须从 UI 服务上下文贯穿 workspaceIdentity + remoteSessionId；identity key 使用 trim/fallback，IO/cwd 使用 path。涉及 queue/stream 必须同时覆盖 continuous 与 replayable；UI store 只拥有 drafts/pending/projection，Runtime Inbox 负责 accepted input。涉及 tool/file 需保证 declaration/result pair、read state 和 checkpoint 顺序。

## Important Design Decisions

不把跨包实现细节作为新入口；使用公开 exports、hooks/platform service 与已有 DI。修改 schema 时同步严格类型和 runtime validation。改变并发 metadata 即改变副作用排序，验证不能只测单个 handler 成功。变更 retry 不得将同一个 command/tool 重新生成 ID 来绕过已有幂等。

## Unknowns

没有实施上表变更；没有新增 Provider/Tool 或测试。当前提交测试缺口见 Batch 14，依赖缺失导致 typecheck/lint 未通过。目标模块 IDs 以执行时架构策略为准，这里不捏造不存在的 module context 命令参数。

## Archify Diagram

[Master Map](diagrams/19-master/master.html) 提供入口；对应专题图由 Batch 3～13 给出。状态/时序变更应复用 owner/事件顺序图说明预期，不只改静态包图。

## Next Batch Dependencies

Batch 19 用全部接缝汇总 Master Map；Batch 20 保留可复查的调用点，Batch 21 建最终 25 主题目录。
