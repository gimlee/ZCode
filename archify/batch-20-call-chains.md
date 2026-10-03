# Batch 20 · Critical Call Chains

基线同 [README](README.md)。`CLI/` = `apps/zcode-cli/packages/cli/src/`，C/A/B 同 [Batch 6](batch-6-repository-understanding.md)。箭头表示直接调用、显式委托或协议边界；`⇒` 特指异步通道/消息交付，不伪装成同一 call stack。

## Findings

以下 12 条链基于前置源码追踪汇总，覆盖 protocol 启动与当前 V4 UI 主入口。模型 attempt、Core model step、turn、command 和 goal 是不同单位；完成模型输出不自动等于整个任务或 goal 完成。每条链都有实际函数与源码定位。

## Key Source Files

完整 30 个重点文件见 [Batch 16](batch-16-reading-path.md)；下文逐步注明定位。涉及协议的 service/client/gateway 边界详见 [Batch 12](batch-12-ui-cli.md)，IO、模型和恢复分别见 Batch 7/8/4/13。

## Key Classes / Functions

主 owner 为 `ZCodeProtocolAgentServer`、`AgentRuntime`、`CommandInbox`、`MessageHistoryImpl`；主调用点为 `createZCodeApp()`、`runRegularTurnLoop()`、`runModelBackedTurnStep()`、`runModelTextRequest()`、`executeToolCall()`。`ExecutableModel`、`NodeFileSystemAdapter`、`NodeExecutionAdapter` 是外部执行边界。

## Control Flow

### 1. Startup · Entry → Runtime → Agent

```text
CLI.main() [CLI/main.ts:15]
 → run(context) [CLI/run.ts:236]
 → runZCodeProtocolCommand() [CLI/run.ts:236]
 → runZCodeProtocolAgent() [B/zcode-protocol-entrypoint.ts:82]
 → openProtocolStartupStorage / startProcessProviderRegistryRuntime
 → new ZCodeProtocolAgentServer(app factory) [B/zcode-protocol-entrypoint.ts:227]
 → ZCodeProtocolNdjsonConnection.start() [B/zcode-protocol-entrypoint.ts:297]
 ⇒ request dispatch / session create
 → createRecord() [B/zcode-protocol/server-operations.ts:3296]
 → createZCodeApp() [B/app/create-app.ts:144]
 → new AgentRuntime() [C/runtime/agent-runtime.ts:244]
 → initializeRuntimeTooling / startMcpStartup
```

进程级资源先启动，session Runtime 后创建；context 在首次 turn 惰性初始化。Headless 的 `runPrompt()`（`CLI/prompt-command.ts:61`）装配 App 后提交输入，TUI 的 handler 惰性创建 App，不能把全部入口都强行走 NDJSON。

### 2. User Message · UI → Agent

```text
SessionPane.dispatchCommand() [packages/ui/src/v4/SessionPane.tsx:1395]
 → createCommandEnvelope() [packages/ui/src/v4/commandFactory.ts:51]
 → pendingCommandRegistry.record()（上行前）
 → ConversationTransport.sendCommand() [agentConversationTransport.ts:350]
 → IZCodeAgentService.sendConversationCommandV4() [packages/services/src/zcode-agent/zcodeAgentService.ts:5044]
 → client.request(V4_METHODS.command) [:5102]
 ⇒ Agent stdio frames ⇒ V4Gateway.handleCommand() [B/zcode-protocol-v4/v4-gateway.ts:2376]
 → CommandInbox.handle() [B/zcode-protocol-v4/command-inbox.ts:118]
 → admitCommandInput / host.executeCommand [v4-gateway.ts:2398,2481]
 → App submitPrompt / createInputFacade.runPromptTurn [B/app/input-facade.ts:369]
 → AgentRuntime.executeTurn() [C/runtime/methods/turn.ts:70]
 → enqueueCancellableRuntimeCommand / drainRuntimeCommandQueue
 → executeTurnCommand() [turn.ts:93]
```

ACK 回程是 admission 边界，不等待此链的整个模型工作完成；remote 的 identity/attachment/owner 路由在 Host 注入，未将 UI payload 当权威。

### 3. Context Build · Message → Context

```text
executeTurnCommand() [C/runtime/methods/turn.ts:93]
 → ensureContextInitialized() [C/runtime/methods/context.ts:31]
 → ContextSourcePort.resolveContextSources()
 → NodeContextSourceAdapter.resolveContextSources() [A/context/index.ts:102]
 → discoverSkillsForContext / loadProjectMemoryRoot / loadProjectMemoryIndexContent
 → createContextBuilderFromSnapshot() [context.ts:96]
 → ContextBuilder.build() [C/context/builder.ts:87]
 → initializeMessageHistoryFromContext() [context.ts:273]
 → MessageHistory.initialize()
 → append admitted user input / initialize turn request entries
```

已初始化短路；resume 先 hydrate read state/active branch 再组合当前 context。项目文件通过按需 Read/search 结果进入 history，不是这里一次扫描全仓库。

### 4. Prompt Build · Instructions → Model Request

```text
ContextBuilder.build() [C/context/builder.ts:87]
 → orderSectionsForInjection() [:310]
 → CLI prefix / stable identity / dynamic guidance / skills / instructions-memory-date
 → buildContextHistoryEntries [C/runtime/methods/context.ts:29]
runRegularTurnLoop() [C/runtime/methods/turn-loop.ts:43]
 → getTools(currentModel) / runtime reminders
 → buildRuntimeProviderRequestMessages() [turn-loop.ts:109]
 → buildProviderRequestMessages() [C/runtime/helpers/provider-request-messages.ts:48]
 → runModelTextRequest() [C/runtime/methods/model.ts:36]
 → media paths / capabilities / media budget
 → ModelRequest {messages, tools, abortSignal, options.maxOutputTokens}
```

tools 是独立请求参数；内部 source metadata 和 meta-user attachments 先投影，不原样全部暴露为网络字段。

### 5. LLM · Agent → Provider → Model

```text
createTurnModel → createRuntimeModel [C/runtime/methods/runtime-model.ts:14]
 → ApiProviderModelRuntime.modelFactory [B/app/provider-registry-model-runtime.ts:65]
 → Registry.validateSelection / getProvider / getModel
 → AiSdkModelAdapter.createModel → AiSdkModelExecution.bindModel [A/model/model-execution.ts:181]
runModelTextRequest() [C/runtime/methods/model.ts:36]
 → runWithModelInvocationContext
 → ExecutableModel.streamText() / generateText() → prepareRequest [A/model/model.ts:91,125]
 → AiSdkModelAdapter.streamTextWithResolved [A/model/runner.ts:309]
 → runStreamText() [A/model/runner-stream.ts:100]
 → admitAttempt() [:240] → resolveModelForAttempt() [:279]
 → createStreamTextOptions() [:289]
 → toAiSdkMessages / toAiSdkTools [A/model/transform.ts:46; tool-transform.ts:24]
 → SDK streamText → configured protocol factory [model-execution.ts:344]
 → compat fetch / option map body patch ⇒ provider HTTP
```

顺序中 model 是执行句柄，Provider 是配置与协议，不是另一个 Agent。最终 SDK 内部 wire serialization 因依赖缺失没有深入安装源码。

### 6. Model Streaming · Provider → Agent

```text
SDK fullStream → runStreamText() [A/model/runner-stream.ts:100]
 → StreamingToolCallAssembler [A/model/streaming-tool-call-assembler.ts:10]
 → toModelStreamEvent() [A/model/runner-normalization.ts:62]
 ⇒ Core model stream collector [C/runtime/methods/model.ts:228]
 → text/reasoning/tool-input events → enqueueStreamingModelEvent
 → final tool_call → normalize / ID dedupe → StreamingToolCoordinator
 → finish/error: drain model-streaming-event-queue
 → normalized result → runModelBackedTurnStep [C/runtime/methods/turn-model-step.ts:88]
```

partial tool-input 只展示；最终 tool-call 才作为执行参数。安全只读工具可在 stream 期间开始，其他调用流结束后执行，providerExecuted 不在本地重跑。

### 7. Tool Call · Model → Executor

```text
final local tool calls → executeToolCallsForModelStep [C/runtime/methods/turn-tools.ts:43]
 → scheduleTools / ToolScheduler.schedule [C/runtime/methods/tools.ts:38; C/tool/scheduler.ts:50]
 → executeTools / ToolExecutorImpl.executeSchedule [tools.ts:63; C/tool/executor/impl.ts:121]
 → executeToolSchedule / executeToolBatch [C/tool/executor/batch-runner.ts:24]
 → executeToolCall [C/tool/executor/call-runner.ts:65]
 → registry lookup → initial input validate/resolve
 → PreToolUse hook（修改后重校验）→ permission flow [:290]
 → executeWithTimeout(entry.handler) [:443]
 → validate output / post hook / serialize result [:463]
 → persist tool part → commitTurnRequestEntries [turn-tools.ts:359]
 → emitFileMutationCheckpoint [C/runtime/methods/tools.ts:169]
 → loop next model request
```

stream 期间已执行的结果按 ID 合并，不在此链正常成功路径重复运行。checkpoint 仅成功结果且存在 mutation candidate/artifactStore 才建立。

### 8. Shell · Tool → OS

```text
executeToolCall → Bash entry handler [C/tool/handlers/bash.ts:97]
 → executeBashHandler() [:103]
 → BashInputSchema.parse → createExecutionRequest / createExecutionRunOptions
 → ExecutionPort.run() 或 runBashWithBackgroundLifecycle [:187]
 → NodeExecutionAdapter（继承 run）[A/exec/node-execution-adapter.ts:5]
 → NodeExecutionAdapterRun.run() [A/exec/node-execution-adapter-run.ts:26]
 → prepareChildSpawn() [A/exec/node-execution-adapter-process.ts:62] → child_process.spawn [node-execution-adapter-run.ts:204]
 ⇒ OS process stdout/stderr / close
 → collector / file output / timeout or process-tree termination
 → ExecutionResult → cwd policy → BashOutput
 → serializer / paired tool history
```

resolved cwd、output encoding 与 shell/provider 分支有关；背景任务是另一个生命周期，不以 launch ACK 冒充完成。

### 9. File Read · Agent → File

```text
Read ToolEntry → readHandler() [C/tool/handlers/read.ts:141]
 → input/path/media checks → FS stat → cached freshness decision
 → readTextFileForModel() [C/tool/handlers/read-text.ts:31]
 → FileSystemPort.readTextFileRange()
 → NodeFileSystemAdapter.readTextFileRange [A/fs/index.ts:262]
 ⇒ async file read/decode → line range/budget/media result
 → ReadFileState record [:220]
 → tool serializer → persisted part / paired history → next request
```

full vs partial read state 会影响随后 Edit/Write；文本路径与 PDF/image 的专门路径不能混作一种 raw read。

### 10. File Edit · Agent → Match → Write → Checkpoint

```text
Edit ToolEntry → editHandler() [C/tool/handlers/edit.ts:84]
 → readTextFile [:156] → read-state freshness [:200,421]
 → findEditMatch() [C/tool/edit-matchers.ts:40]
 → not found / ambiguity / replaceAll restrictions
 → normalized literal replacement [:234]
 → writeEditResult() [:470]
 → FileSystemPort.writeTextFile({expectedRevision, atomic, encoding}) [:508]
 → NodeFileSystemAdapter.writeTextFile [A/fs/index.ts:291]
 → assertExpectedRevision [:473] → atomicWrite [:700] → rename / fallback
 → updated read state + structuredPatch → paired result commit
 → emitFileMutationCheckpoint() [C/runtime/methods/tools.ts:169]
 → artifactStore.writeToolResultArtifact → CheckpointCreated event
```

本链不是 ApplyPatch；注册列表的 ApplyPatch 为注释。mtime/size revision 和 rename 前检查不提供强 CAS，fallback 不是永远 atomic。

### 11. Repository Search · Agent → Search → Context

```text
default embedded branch: Bash command
 → embedded-search-prelude [A/exec/embedded-search-prelude.ts:34]
 → native tools / argv0 dispatch / internal-cli（按 runtime/shell 能力选择）
 ⇒ search output → Bash result → budget/history → next ModelRequest
alternate direct branch: Grep/Glob handlers
 → FileSystemPort.searchText / searchFiles
 → NodeFileSystemAdapter.searchText [:452] / searchFiles [:393]
 → bundled rg plan/worker [:924,1047] / walkFiles [:1708]
 → bounded matches/path pagination → handler result → serializer/history → request projection
```

上述 `:line` 相对 `A/fs/index.ts`。只有特定 rg runtime failure 降级 JS；abort/timeout 不当成功 fallback。没有确认 semantic index、LSP/AST/vector 的普通执行主链。

### 12. Task Completion · Loop → Final Answer

```text
runModelBackedTurnStep → no local tools [C/runtime/methods/turn-model-step.ts:708]
 → finishModelStepWithoutToolCalls [C/runtime/methods/turn-stop.ts:157]
 → persistCompletedAssistantStep [:31]
 → inline guide / Stop hook continuation 检查
 → no continuation: TurnMachine.complete + break [turn-stop.ts:234]
 → runRegularTurnLoop return
 → accountTargetTurnCompletion / stable completion / TurnComplete [C/runtime/methods/turn.ts:625]
 → finally cleanup/release reservation [:823]
 → Runtime command resolve [C/runtime/methods/runtime-command-queue.ts:214]
 ⇒ committed projection frame → Host transport → UI final rows
```

如果 active goal 满足继续条件，`runPostCommandActiveTargetLoop()` 在 command 层继续；工具显式 turn-control、error/cancel 与输出限制是另外的停止路径。最终回答不要求 CLI 进程退出，也不保证 goal 一并 completed。

## Data Flow

关联键沿链保留：workspace identity/path/remoteSessionId → commandId/inputId → sessionId/turnId/model request/attempt → toolCallId → paired message/part → seq/log epoch。源码内 canonical、turn-local、Provider wire、UI row 是不同投影，每个都有显式转换点。

## Important Design Decisions

跨异步/协议跳转不能由一个堆栈解释；先看 owner 再看载体。与具体 Model 绑定的能力冻结影响 tools/media/options，模型配置缓存变化不会改变已开始的请求。副作用的 handler 成功、历史配对、checkpoint 与 turn completion 是不同提交点。

## Unknowns

未用 debugger 或真实请求验证完整时序；源码链省略日志、telemetry、部分 helper 参数和所有异常分支，专题报告已说明例外。SDK 外部内部实现和部署连接配置不在本次静态证据内。

## Archify Diagram

按链定位：[Startup](diagrams/01a-startup/startup.html)、[Agent Loop](diagrams/02b-loop/loop.html)、[LLM](diagrams/04b-request/request.html)、[Tool](diagrams/05b-tool-call/tool-call.html)、[Edit](diagrams/07a-code-modification/code-modification.html)、[Shell](diagrams/08a-shell/shell.html)、[UI](diagrams/12b-ui-request/ui-request.html)、[Master](diagrams/19-master/master.html)。

## Next Batch Dependencies

Batch 21 将 12 条链和专题报告纳入最终目录；此后仅做文档链接、source anchors、diagram receipts/hash 与检查结果的一致性审计。
