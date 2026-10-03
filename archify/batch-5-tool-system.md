# Batch 5 · Tool System

基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。承接 Batch 2 的循环与调度、Batch 3 的输出预算、Batch 4 的 SDK tool conversion。C/A/B 简称分别为 `apps/zcode-cli/packages/core/src/`、`apps/zcode-cli/packages/adapters/src/`、`apps/zcode-cli/packages/bootstrap/src/`；行号对应当前提交。

## Findings

**Confirmed：ToolRegistry 是 native handler 与 MCP adapter 的共同入口。** `ToolRegistryImpl` 按 canonical 名保存 `ToolEntry`，支持受约束 aliases；`toContracts()` 仅投影模型声明，明确 `execute: undefined`。模型选择工具，Core executor 执行工具；普通 Agent 不让 AI SDK 直接代管这些 handler。证据：`C/tool/registry.ts:30,36,96,112`。

**Confirmed：注册集合不等于每步 provider-visible 集合。** 构造 Runtime 时注册内置工具，MCP startup 后注册 descriptors 并 invalidate cache；`getTools(model)` 过滤 runtime 分支与 model capability，还把 schema/description 按当前模型投影。源码里有 ToolSearch/deferred tools 的待办注释，但当前 builtInTools 没有 ToolSearch 注册，不能报告“模型按需检索所有隐藏 MCP tools”。证据：`C/runtime/helpers/runtime-tools.ts:34,47`、`C/runtime/methods/mcp.ts:121–167`、`C/runtime/methods/config.ts:136`、`C/tool/handlers/index.ts:76`。

**Confirmed：lookup、schema validation、input resolution、hooks、permission、handler、output validation、budget、history commit 是不同边界。** tool failure 通常回成带原 toolCallId 的失败结果，再由模型决定如何修正；executor 没有通用 handler 自动重试循环。并发按安全 metadata 分组，streaming 早执行还有更严格条件。证据：`C/tool/executor/call-runner.ts:99–315,443–597`、`C/tool/scheduler.ts:60,85,153`、`C/runtime/methods/turn-tools.ts:235,359`。

## Key Source Files

| 文件与定位 | 实际职责 |
|---|---|
| `apps/zcode-cli/packages/contracts/src/tools/contract.ts:117,183` | permission/resultBudget/timeout/cancellation 的声明契约 |
| `apps/zcode-cli/packages/contracts/src/model/index.ts:462` | 模型可见 ModelToolContract |
| `C/tool/types.ts:71,269,278,409,445` | metadata、handler/context、entry、execution/serialization result |
| `C/tool/registry.ts:36,112` | 注册/alias 冲突处理与 contracts 投影 |
| `C/tool/handlers/index.ts:76,195` | 实际内置列表、条件注册与分支变体 |
| `C/runtime/helpers/runtime-tools.ts:47,149` | runtime 能力门、executor ports/hooks 注入 |
| `C/runtime/methods/config.ts:136,149` | 本步工具集合与 cache invalidation |
| `C/runtime/methods/embedded-search-branch.ts:11,21` | 搜索分支刷新、Glob/Grep unregister |
| `C/runtime/methods/mcp.ts:42,121` | startup 与 descriptors 注册 |
| `C/mcp/index.ts:60,105,214` | MCP descriptor → ToolEntry → McpPort.callTool |
| `B/app/plugin-runtime-features.ts:11` | 官方插件对 runtimeFeatures 的当前推导 |
| `B/app/built-in-node-repl.ts:16` | Browser/CUA 共用宿主 MCP server 的装配 |
| `C/tool/model-contract.ts:4,21` | 模型 schema 的执行/描述同源投影 |
| `C/tool/executor/call-runner.ts:65,99,166,233,290,443,463,560` | 完整执行生命周期 |
| `C/tool/executor/permission-flow.ts:41,86,160,184,240` | policy、broker/hook 竞速与 modified-input recheck |
| `C/tool/scheduler.ts:48,60,85,153` | 并发判据与分组 |
| `C/tool/executor/batch-runner.ts:24,56` | Promise.all 批次与 turn-stop 后取消剩余组 |
| `C/tool/executor/result-serialization.ts:46` | 模型内容、artifact、截断与 CUA protection |
| `C/runtime/helpers/tool-result.ts:62,67` | 模型结果内容与 isError 的统一选择 |
| `C/runtime/methods/turn-tools.ts:235,280,359` | 按 ID 聚合、保存、提交 paired tool entries |

## Key Classes / Functions

### Tool Registry / Schema

**Confirmed：** `ToolEntry extends ToolContractDeclaration`，含 JSON input/output schema、可选 runtime schema、handler、metadata，以及 `resolveModelContract / validateInput / resolveInput / formatModelContent / prepareApproval` 等接缝。handler 收到窄的 `ToolExecutionContext`：trace/session/turn、abort、cwd/workspace identity、模型与 FS/Exec/HTTP/MCP 相关能力端口；不是直接拿整个 App 服务容器。

**Confirmed：** metadata 声明 readOnly/destructive/concurrentSafe/sideEffectScope/risk/needsApproval 等事实。provider contract 附 description 和 modelInstructions 的 Usage 文本；输出 schema 可以存在，但实际 output validation 在 executor 内完成。`resolveModelContract()` 同时用于 provider descriptor 和 executor entry，使当前模型看到和执行校验的 schema 一致。

**Confirmed：** 同名 canonical 注册会覆盖并告警；canonical 不能被旧 alias 遮蔽，alias 冲突时拒绝新 alias，重注册会清旧 aliases。并非 immutable registry；自定义宿主可注入 registry/executor，但改变 registry 后需让 runtime cache invalidation 与执行边界同步，不能把支持 register 解释为已经提供自动热发现机制。

### 实际核心工具目录

| 用户关心的能力 | 当前注册/实现 | 源码与边界 |
|---|---|---|
| Read | `readToolEntry` / readHandler | `C/tool/handlers/read.ts:141,468`；FS 文本读取，媒体/PDF 等专门路径 |
| Write | `writeToolEntry` / writeHandler | `C/tool/handlers/write.ts:66,125,214`；FS 写入与读取状态检查 |
| Edit | `editToolEntry` / editHandler | `C/tool/handlers/edit.ts:84,156,257,508`；读取、匹配、FS 写入，细节留 Batch 7 |
| Patch | 当前没有启用的内置 ApplyPatch | `C/tool/handlers/index.ts:80` 是注释；不能因 microcompact 列表有名字就认定可调用 |
| Search / Grep / Glob | 默认 Bash embedded search；保留 direct Grep/Glob 分支 | `C/embedded-search/capability.ts:4` 全局默认开，Bash 可用时隐藏 Grep/Glob；`C/tool/handlers/grep.ts:32,66` / `C/tool/handlers/glob.ts:25,56` 的 direct 分支走 FS search ports |
| Shell | Bash | `C/tool/handlers/bash.ts:97,110,187,449,512`；ExecutionPort，shell 选择并非仅 Unix bash |
| Git | Bash 执行 git 命令及 git safety 分类 | `C/tool/handlers/bash.ts:331` 与 `bash-git-runtime-safety.ts`；内置列表没有独立 Git tool |
| Browser / CUA | 官方插件启用宿主 `node_repl` MCP server | `B/app/plugin-runtime-features.ts:11` / `B/app/built-in-node-repl.ts:16`；裸 core `js` 仍有显式开关分支，但官方插件当前不打开它 |
| WebFetch | WebFetch handler | `C/tool/handlers/webfetch.ts:52,79` → `C/tool/handlers/webfetch-network.ts:27` 的 HTTP port → `C/tool/handlers/webfetch-processing.ts:20,67` 的内容处理/模型调用 |
| WebSearch | 本地 WebSearch wrapper 内部调用 provider-native web_search | `C/tool/handlers/websearch.ts:60,82,103,130,156`；当前模型必须 supportsNativeWebSearch，内部 stream 请求用 native contract |
| MCP | 动态 descriptors 包装为 ToolEntry | `C/mcp/index.ts:60,214`；外部执行经 McpPort，结果走统一 serializer |
| Skill | Skill tool 按需加载正文 | `C/tool/handlers/skill.ts:16,35,58,78`；SkillPort 最大请求 100,000 bytes，变量展开后回模型 |
| Agent/Task、Todo、Plan、交互 | 条件注册或默认内置条目 | `C/tool/handlers/index.ts:86–110`；端口与会话模式决定曝光，不推断是每轮自动 planner |
| Cron/OffPeak、workflow 工具 | 条件注册 | `C/runtime/helpers/runtime-tools.ts:50–89`；端口、child 限制、Host 灰度和 allow/disallow 共同控制 |

**Confirmed：** 默认 embedded branch 只要求 Bash 被允许，并不因为当前 shell 无法注入 find/grep function 就改变模型可见工具列表；实际搜索执行增强是另一个能力判断。Batch 6 应继续验证 backend 与 shell prelude，不能将“Glob/Grep 文件存在”写成默认全部曝光。

**Confirmed：** 官方 Browser Use/CUA 插件共用 `node-repl-host` seed 的实际 MCP runtime；启用任一插件且 host package 存在才装配 server，不回退到旧插件产物。`plugin-runtime-features.ts` 明确不设置 `nodeRepl`，避免 core 裸 js 与 MCP 重复投影。其隔离为 workspace，配置 timeout 600,000 ms；普通 MCP fallback timeout 则为 30,000 ms，不能混为统一超时。

## Control Flow

### 注册与曝光链

```text
createApp() → resolveStartupPlugins()
  → resolvePluginRuntimeFeatures / plugin MCP configs / built-in node_repl server
AgentRuntime constructor → initializeRuntimeTooling()
  → registerRuntimeBuiltInTools() → registerBuiltInTools()
  → createRuntimeToolExecutor(registry, permission, ports, hooks)
startMcpStartup()（可提前调度）
runRegularTurnLoop() → await initializeMcp()
  → registerMcpTools(startup snapshot) → invalidateToolCache()
getTools(currentModel)
  → registry.toContracts() → runtime branch/order → WebSearch capability
  → projectToolModelContract() → ModelRequest.tools
```

**Confirmed：** 插件通过装配出的 skills、profiles、hooks、MCP configs 和官方 runtime features 影响工具边界；本批没有发现任意 plugin manifest 直接注入任意 Core handler 的通用注册机制。MCP startup snapshot 在普通模型调用前等待；失败被标记/记录，不等于所有远端工具成功加载。插件完整生命周期留 Batch 11。

### Tool Execution Chain

```text
AI SDK final tool-call → StreamingToolCallAssembler / Core normalize+dedupe
  → 过滤 providerExecuted calls
  → runRegularTurnToolStep() → scheduleTools() / executeTools()
  → ToolExecutor.executeSchedule() → executeToolBatch() → executeToolCall()
  → registry lookup + canonical alias + 当前模型 schema
  → prepareInitialInput / initial schema / validateInput / resolveInput
  → PreToolUse hooks（可以 deny 或改 input；改写后再校验）
  → resolveToolPermission()（policy + project rules + runtime capability）
      allow → 继续；deny → paired error result
      ask → broker 与 PermissionRequest hooks 竞速 → 改写时 recheck
  → ToolCallStarted → handler + ToolDeadline/AbortSignal
  → validateOutput → serializeOutput → PostToolUse → 追加 hook contexts
  → ToolExecutionResult + ToolCallCompleted/错误事件
  → 按原声明 toolCallId 顺序聚合 → persist parts
  → createRuntimeToolResultEntry() / commitTurnRequestEntries()
  → 下一步 provider projection → Model
```

**Confirmed：** `resolveInput` 在 hooks/permission 之前将模型输入解析为真正执行事实，避免确认 A 而执行 B；PermissionRequest hook 改写后重新 normalize/validate/permission recheck。broker 与 hook 竞速是实际调用，不是等 hook 全部返回后才注册 broker；败者 abort（`C/tool/executor/permission-flow.ts:184,240`）。这层决定真实权限，不依赖 TurnMachine 的 awaiting_permission 枚举来执行。

### Parallel Tool / Streaming Early Execution

**Confirmed：** 一次响应可以有多个本地 tool calls。runtime 的普通 `scheduleTools()` 当前为每个 call 设 `dependsOn: []`，并从 registry metadata 构造安全属性；不能说模型已提供任意工具 DAG。Scheduler 的通用 API 有拓扑排序和 cycle detection，但普通入口没有建立基于文件路径的依赖图。

**Confirmed：** 默认 scheduler maxConcurrency=10。destructive 禁并行；显式 concurrentSafe=true 可并行，false 不并行；否则 readOnly 或 sideEffectScope=none 可并行。runtime 对 readOnly 还要求 sideEffectScope=none，但保留 concurrentSafe，例如 MCP readOnly/idempotent 的声明仍可让 scheduler 并发。分组顺序执行，组内 `Promise.all`，大组再切片；普通失败不会自动取消所有后续组，显式 turnControl.stopTurnAfterResult 才为后续未执行组生成 ToolCancelled。

**Confirmed：** streaming coordinator 在 final call 可用时只早执行已注册且 `readOnly && concurrentSafe && !destructive && !needsApproval && !requiresUserInteraction && sideEffectScope=none` 的工具；结果按 ID 缓存，最终聚合复用，不二次调用同一 call。它的判据比普通批次并发严格；含网络/权限的 MCP 不能仅因 readOnly hint 就早执行。

### Error / Retry

- **Confirmed：** lookup/schema/语义输入失败在 handler 前回结果；部分路径发布 ToolCallError 让 UI 不滞留 inputStreaming。空名保持原 call 配对，provider-specific 空名兼容留 Adapter 处理。
- **Confirmed：** handler 可 throw 或返回 ToolHandlerFailure；后者统一转执行失败，再跑 PostToolUseFailure hooks，错误内容保留原工具 ID，并可附诊断上下文。
- **Confirmed：** executor 没有通用 handler 自动 retry。模型收到失败后可再次发新 tool call；WebSearch/WebFetch 等工具内部模型请求的 retry 来自同一 Model runner，不能说“工具框架自动重跑写文件”。
- **Confirmed：** deadline 可在内部模型 admission 排队期间暂停计时；工具 timeout/cancel 经 AbortSignal 与 cleanup 合约处理，不能把 deadline 当强制回滚副作用的事务机制。
- **Confirmed：** Bash 的非零 exit code 是命令结果事实，不必然等同框架执行异常；`C/tool/handlers/bash.ts:322` 区分 structured failure、spawn、timeout/cancel 与普通命令退出。

## Data Flow

### Tool Result Format

**Confirmed：** `ToolExecutionResult` 是执行 envelope，不整体送模型。它含 `toolCallId / toolName / success / output / error? / durationMs / startedAt / completedAt`，以及可选 `modelContent / serialization / display / performance / turnControl / followUpUserInput / readFileStateMetadata`。UI display、遥测、raw output 与模型可见内容不是同一个字段。

`ToolResultSerialization` 含 `content`、可选结构化 `modelContent`、originalBytes、returnedBytes、truncated、budgetStrategy、artifactPath。`modelContentForToolResult()` 优先用 modelContent，否则 string/JSON/error 摘要。`createRuntimeToolResultEntry()` 保存如下模型消息（`C/agent/message-history.ts:379`）：

```text
{ role: 'tool', toolCallId, toolName, content: ModelMessageContent, isError }
```

**Confirmed：** turn-tools 从 streaming/pending results 建 ID map，再按模型 call 声明顺序输出；提交 tool result 后再做 checkpoint，取消也不能使 sibling results 留成未配对历史。canonical 与 turn-local history 同步提交，下一步经过 Batch 3 的 projection 和 Batch 4 的 `tool-result` converter。

**Confirmed：** `success` 与 provider-visible `isError` 不完全等价：`output.isError/is_error` 也可标记业务失败；Bash interrupted/provider error 有专门处理（`C/runtime/helpers/tool-result.ts:67`）。错误消息可能含 `<tool_use_error>`；最终 SDK 映射为 error-text，而非 raw stack/整个执行 envelope。

### Native vs MCP vs Provider-native

| 边界 | 本地内置工具 | MCP 工具 | Provider-native 工具 |
|---|---|---|---|
| 定义来源 | builtin ToolEntry 与条件变体 | MCP listTools descriptor | ModelToolContract.providerNative |
| 实际调用 | Core handler → FS/Exec/HTTP/其他 ports | Core wrapper → McpPort.callTool | Provider API 服务端执行 |
| 权限 | executor policy + project rules + broker/hooks | 同一 executor；普通 MCP needsApproval=true，含外部 server 风险 | 不重复进入本地 handler；外层 wrapper 仍有自己的权限 |
| 返回 | output → formatModelContent → serializer | MCP content/structured output → normalizer → serializer | SDK 标记 providerExecuted / sources / usage |
| 模型曝光 | runtime 注册/分支/model capability | descriptor 注册 + allow/disallow + cache invalidation | adapter 只编码实际已支持的 native spec |

**Confirmed：** 普通 MCP 用 descriptor readOnlyHint/destructiveHint/idempotentHint 设置 metadata；默认 sideEffectScope=network、needsApproval=true、timeout 30s、model result budget 50,000 bytes（inline 100,000）。宿主 node_repl/js 是 system/high 风险，artifact 策略、64 KiB model preview；authority-verified CUA 有 256 KiB 文本预算与原子媒体保护。hint 不授予可信身份，官方权限 capability 必须由不可伪造 authority 验证。

**Confirmed：** MCP handler 用 descriptor 的真实 serverName/toolName 路由，模型主名或 alias 不能改变外部执行目标；传递 workspacePath、workspaceIdentity/workspaceKey、remoteSessionId、session/turn/trace、clientMode/deliveryKind 与 abort/timeout。identity 空白时按 workingDirectory fallback，符合仓库身份隔离规则。媒体结果在 handler 阶段 normalize，再进通用预算。

**Confirmed：** 顶层 WebSearch 注册的是本地 wrapper，`providerNative: undefined`；它内部发一个带 provider-native `web_search` 的 model.streamText 请求，输出上限 min(4096, model max)、默认 maxUses=8。它仍走本地 executor lifecycle；内部 native call 不再次交 Core 执行。不能把全部 WebSearch 都标成“完全绕过 Core 的 native 工具”。

## Important Design Decisions

- **Confirmed：** provider contract 不携带本地 execute，确保权限、hooks、deadline、持久化由唯一 executor 路径管理。
- **Confirmed：** 当前模型 schema 同时投影给模型和 executor；input resolution 提前，hook 改写再验证，减少描述/批准/执行漂移。
- **Confirmed：** tool call/result 按 ID 关联，UI/持久化/模型内容分层；并发结束顺序不会改变最终配对顺序。
- **Confirmed：** 普通 MCP 与官方 CUA 的信任边界不按名字猜，媒体坐标引用只能随可信帧原子保留。
- **Inference：** 新本地工具可以沿 ToolEntry→register→executor 接入；真正扩展还需 spec、能力端口、权限/resultBudget、模型 schema 和有效注册门，不能仅新增 handler 文件。

## Unknowns

- **Need Verification：** 未运行外部 MCP、真实 Browser/CUA、并发失败/取消/权限竞速；descriptor hints 与外部 server 行为是否一致需要集成测试。
- **Need Verification：** FS edit、shell/security、完整搜索 backend、插件 hot reload、恢复后 tool pairing 分别留 Batch 6–11/13 深入，本批仅确认调用边界。
- **Unknown：** 没有本批可确认的启用 ApplyPatch、独立 Git/Browser 内置工具或 ToolSearch 懒发现机制。不要由留存文件、接口或待办注释恢复已移除能力。

## Archify Diagram

- [图 5A · Tool Architecture](diagrams/05a-tools/tools.html)：注册、contracts、scheduler/executor 与 handler ports/MCP 的边界。
- [图 5B · Tool Call Sequence](diagrams/05b-tool-call/tool-call.html)：final call → lookup/validation → hooks/permission → handler → commit。
- [图 5C · Tool Result Data Flow](diagrams/05c-tool-result/tool-result.html)：raw output 分流为 UI/事件、模型预算、history/下轮请求。

各图目录保留 candidate 与验收 receipts，交付验收见 [validation.md](validation.md)。

## Next Batch Dependencies

Batch 6 从默认 Bash embedded search 与 direct FS search ports 追实际检索算法、repo context；Batch 7 深入 Read/Write/Edit 的状态、匹配与 checkpoint；Batch 8 深入 ExecutionPort、shell policy 与权限；Batch 11 再追 MCP transport、技能发现和插件生命周期。Batch 3–5 已确认的工具定义/调用/内容边界可直接复用。
