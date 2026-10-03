# Batch 2 · Agent Runtime 与 Agent Loop

基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。继承 [Batch 1](batch-1-startup-runtime.md) 的装配结论，只深入输入 admission、普通 turn 循环、停止和恢复。路径缩写：`Core/` = `apps/zcode-cli/packages/core/src/`，`Bootstrap/` = `apps/zcode-cli/packages/bootstrap/src/`，`Adapters/` = `apps/zcode-cli/packages/adapters/src/`。

## Findings

- **Confirmed**：Agent 核心执行对象是 `AgentRuntime`，真正控制普通 Agent Loop 的函数是 `runRegularTurnLoop()` 的 `while (true)`，而非 UI、Provider SDK 或 `TurnMachineImpl.getNextPhase()`（`Core/runtime/methods/turn-loop.ts:43–218`）。
- **Confirmed**：Runtime 外还有命令循环。`executeTurn()` 先 enqueue cancellable command；`drainRuntimeCommandQueue()` 串行处理 Runtime commands；普通 command 调用 `executeTurnCommand()`，结束后可能继续 active goal loop。因此 command、turn、model step、tool call 是不同单位（`Core/runtime/methods/turn.ts:70–99`；`runtime-command-queue.ts:25–69,187–221`）。
- **Confirmed**：每个 model step 经 context/compact/MCP/tool contract 准备，再调用 `runModelBackedTurnStep()` → `runModelTextRequest()` → Model `streamText()` 或 `generateText()`。响应由 core 收集，不把工具执行交给 SDK 自动循环（`turn-loop.ts:69–109,172–215`；`turn-model-step.ts:235`；`model.ts:141–155,228–234`）。
- **Confirmed**：本地工具调用使用 `!providerExecuted` 过滤。流式 final `tool_call` 按 ID 去重；满足只读、可并发、无副作用和无需交互等条件的工具可先执行。其余在流结束后调度；已执行结果按 ID 合并，避免正常成功路径重复执行（`model.ts:378–395`；`streaming-tool-coordinator.ts:73–100,339–360`；`turn-model-step.ts:645–646`；`turn-tools.ts:150–158,231–244`）。
- **Confirmed**：工具失败通常成为配对的 tool-result，再交模型决定下一步，不直接结束 turn。结果同时推进 canonical history 和 turn-local request entries；下一圈外层 while 再发模型请求（`turn-tools.ts:249–269,359–366,485`；`turn-output-token-continuation.ts:97–105`）。
- **Confirmed**：普通 final answer 的实际条件是没有可本地执行的 tool calls，且没有可消费 inline guide / Stop hook continuation，才 complete + break。模型的 assistant step completed、turn completed 和 goal completed 不能混为一谈（`turn-model-step.ts:708–715`；`turn-stop.ts:157–237`；`turn.ts:625–667`；`target-continuation-loop.ts:49–97`）。
- **Confirmed**：存在明确 `TurnPhase` 与合法迁移表，但它不是直接驱动外层 while 的控制器。普通错误路径通过 outcome event 收口；没有调用 `turnMachine.fail()`。实际权限请求走 ToolExecutor/PermissionBroker；本批检索未找到普通 loop 调用 machine 的 `requestPermission()` / `getNextPhase()`（`agent/turn-state.ts:25–36,230–268`；`agent/turn-machine.ts:238–341`；`runtime/methods/turn.ts:715–798`；`tool/executor/permission-flow.ts:200`）。

## Key Source Files

| 文件 | 核心证据 |
|---|---|
| `Bootstrap/app/input-facade.ts:99–144,369–380` | 输入准备 → Runtime public executeTurn |
| `Bootstrap/zcode-protocol-v4/command-inbox.ts:107–194` | 已接受远端输入的串行 admission、同 ID 幂等 pin |
| `Bootstrap/zcode-protocol-v4/v4-gateway.ts:2376,2398,2481` | inbox → durable admission → Host executor |
| `Core/runtime/methods/runtime-command-queue.ts:25–69,187–221` | command drain 和 foreground execution |
| `Core/runtime/methods/turn.ts:93–845` | turn admission、上下文/输入、外层 outcome/cleanup |
| `Core/runtime/methods/turn-loop.ts:43–218` | 真正的 model/tool while loop |
| `Core/runtime/methods/turn-loop-state.ts` | 单个 turn 的 loop counters、model 和 request entries |
| `Core/runtime/methods/turn-model-step.ts:88,235,645–732,742–802` | 请求、响应分类、执行分支、reactive compact |
| `Core/runtime/methods/model.ts:36–156,228–234,378–395` | Model request 和 streaming event collector |
| `Core/runtime/methods/turn-tools.ts:43–485` | 调度、配对结果提交和 tool turn-control |
| `Core/runtime/methods/turn-stop.ts:157–237` | text-only completion、guide 和 Stop hook |
| `Core/runtime/methods/streaming-tool-coordinator.ts:54–217,339–360` | during-stream execution、drain、断流恢复 |
| `Core/runtime/methods/streaming-recovery.ts:14,47,107,207–274` | recovery budget、安全锚点和 partial discard |
| `Core/tool/executor/impl.ts:16,89,107,121` | Executor 对 call/batch/schedule 的委托 |
| `Core/tool/executor/call-runner.ts:65,99–184,290,443,560` | lookup/validate/hook/permission/handler/failure |
| `Core/tool/executor/batch-runner.ts:25–124` | 分组并发、显式 stop 后的剩余工具取消 |
| `Core/agent/turn-state.ts:25–36,230–268` / `turn-machine.ts:68–341` | 状态定义与方法契约 |
| `Adapters/model/runner-stream.ts:123,1455–1498` / `runner-generate.ts:95,383` | adapter attempt loop 与 retry gate |

## Key Classes / Functions

### Agent Core Classes

| 对象 / 函数 | 谁控制什么 |
|---|---|
| `AgentRuntime` | 单个 session 的执行依赖和状态；methods 装到 prototype，类文件不是完整实现目录 |
| `RuntimeCommandQueue` / `drainRuntimeCommandQueue()` | command 的排序、取消与 foreground owner；防止多个输入抢同一个 active turn |
| `CommandInbox` | protocol v4 command admission 与同 command ID 幂等；不等于 Runtime tool scheduler |
| `executeTurnCommand()` | model selection 在 await 前冻结、初始化 turn、输入落盘、成功/错误 outcome、finally 释放 reservation |
| `RegularTurnLoopState` | Model handle、turn-local entries、usage/tool/model-step counters、recovery 与 Stop hook budget |
| `runRegularTurnLoop()` | 下一次请求是否开始；只在 step 返回 `break` 时退出正常循环 |
| `runModelBackedTurnStep()` | 处理当前 Model result，决定 `continue` / `output_continuation` / `break` 或抛错 |
| `ToolScheduler` / `ToolExecutorImpl` | safe parallel grouping / lookup-permission-handler 执行；不决定整个 goal 是否完成 |
| `MessageHistoryImpl` | canonical 会话历史；turn request history 是单次命令的局部投影，两者有显式 commit 规则 |
| `TurnMachineImpl` | 不可变式状态对象转换与合法迁移检查；不取代实际 while 分支 |

以上 **Confirmed**，对应源码见上一表和 `Core/runtime/agent-runtime.ts:244–307,664`。

## Control Flow

### Agent Runtime Call Chain

```text
Headless/TUI/协议 App 的 submitPrompt()
 → createInputFacade.preparePromptBoundary()       [shell / resume；Batch 1 已确认]
 → runPromptTurn()                                [附件、原始输入与命令展开]
 → AgentRuntime.executeTurn()
 → enqueueCancellableRuntimeCommand()
 → enqueueRuntimeCommand() → drainRuntimeCommandQueue()
 → runRuntimeCommand() → beginForegroundExecution()
 → executeTurnCommand()
    → freeze admittedModelSelection / outputStyle [在 await 前]
    → createTurnModel() → createRuntimeModel() → injected modelFactory
    → ensureContextInitialized() 或 rebuildContextPrefix()
    → session / user hooks → TurnMachine.start() → 输入 history / persistence
    → initialize RegularTurnLoopState
    → runRegularTurnLoop()
       → microcompactIfNeeded() / autoCompactIfNeeded()
       → initializeMcp() → getTools(actual Model)
       → buildRuntimeProviderRequestMessages()
       → TurnMachine.startModelRequest()
       → runModelBackedTurnStep()
          → runModelTextRequest()
          → Model.streamText() 或 Model.generateText()
          → collect result / normalize tool calls / persistence
          → no local tools: finishModelStepWithoutToolCalls()
          → local tools: executeToolCallsForModelStep()
             → scheduleTools() → ToolScheduler.schedule()
             → executeTools() → ToolExecutorImpl.executeSchedule()
             → executeToolSchedule() → executeToolBatch() → executeToolCall()
             → lookup / input validate / pre-hook / permission
             → executeWithTimeout(entry.handler, input, context)
             → result / persist / commitTurnRequestEntries()
          → continue 回到外层 while，或 break
    → accountTargetTurnCompletion() → stable completion boundary → TurnComplete
    → finally releaseTurnStart / finishActiveTurn / abort scope / browser turn end
 → runPostCommandActiveTargetLoop()                 [仅符合 active goal 条件]
 → command.resolve(last goal result 或 initial turn result)
```

入口定位：`Bootstrap/app/input-facade.ts:99,127,369`；Core `turn.ts:70,93,103,192,215,279,561,614,625,647,823`；`runtime-command-queue.ts:25,38,187,205,214`；`runtime-model.ts:15–47`；`turn-loop.ts:43–218`；`turn-model-step.ts:235,708,724`；`turn-tools.ts:145,178,359`；`tools.ts:38,63,82`；`tool/executor/impl.ts:89–129`；`call-runner.ts:99,172,290,443`。

**Confirmed — protocol v4 补充边界**：UI/远端的 command 先经过 `V4Gateway.handleCommand()` → `CommandInbox.handle()` → durable `admitCommandInput()` → `host.executeCommand()`，不是 Renderer 直接决定已接纳队列。Inbox 先 pin，再跨 gateway executor settle，串行的是 admission；这不表示等待整个 LLM turn 后才能接受下一输入（`v4-gateway.ts:2376,2398,2481–2485`；`command-inbox.ts:136–194`）。完整 UI/run-owner/lease 链留待 Batch 10/12。

### Agent Loop Pseudocode

下面是描述源码的伪代码，不是新增实现；省略展示日志和部分持久化细节。

```text
executeTurn(input): enqueue cancellable RuntimeCommand

executeTurnCommand(input):
  freeze model selection and output style before awaiting
  create model; initialize/rebuild context; run input hooks
  persist input; initialize loopState and local request entries
  try:
    while true:
      check cancellation
      at safe boundary: drain eligible background commands into request entries
      microcompact; autoCompact or raise rapid-refill error
      await MCP initialization
      project context + current reminders + capability-filtered tool contracts
      startModelRequest
      try:
        result = collectModelStreamOrGenerate()
        # finalized read-only calls may execute during this stream
      catch modelError:
        if coordinator can recover from safe anchor: continue
        if eligible later-turn Start Plan admission busy: bounded delay; continue
        persist failure/cancelled partial
        if input-context overflow and reactive compact succeeds: continue
        raise
      classify abnormal/empty/output-limit finish
      localCalls = result.toolCalls excluding providerExecuted
      streamedResults = drain already started local calls
      if output-limit without tools:
        persist partial; append query-local Continue if budget remains; continue
        otherwise raise output-limit error
      if no localCalls:
        persist assistant step
        if inline guide drained: continue
        if Stop hook requests continuation + context + budget remains: continue
        complete turn; break
      commit assistant with tool-call declarations
      schedule and execute only calls missing streamed results
      merge results by call ID; preserve declaration order
      persist tool parts; commit every paired tool-result to both histories
      if explicit tool turn-control:
        automation limit: disable tools; continue once for text explanation
        otherwise complete turn; break
      inject bounded anomaly warnings; drain guides; continue
    account goal usage; publish TurnComplete
  catch:
    publish cancelled/error outcome; preserve accepted future inputs; raise
  finally:
    release foreground/turn resources
```

**Confirmed**：主 while (`turn-loop.ts:48`) 与 adapter attempt loop (`runner-stream.ts:123`) 是两层不同循环；不能把 adapter attempts 算成 tool steps。普通循环的日志 `iteration = ceil(toolCallCount/10)` 是观测字段，不是停止阈值（`turn-loop.ts:202`）。

### Stop Conditions

| 场景 | 实际行为 / 范围 | 确定性与源码 |
|---|---|---|
| Final answer | 无本地 executable tool calls；guide 与 Stop hooks 不续跑后 `complete("success")` + break | **Confirmed** `turn-model-step.ts:708`；`turn-stop.ts:157–237` |
| Explicit finish | tool result 的 `turnControl.stopTurnAfterResult`；提交结果后完成 turn。automation-create-limit 是特例：下一次只允许文本回答 | **Confirmed** `turn-tools.ts:424–465`；`batch-runner.ts:90–124` |
| Max turns / tool calls | 普通 turn 主 while 无按次数硬停止；tool budget/repetition 生成 warning/context。`TurnResultType` 中存在 `error_max_turns` 等字面量，未发现本路径使用它们作为停止条件 | **Confirmed（限普通主路径）** `turn-loop.ts:48–218`；`turn-tool-warnings.ts:15–96`；`agent/turn-state.ts:149–156` |
| Subagent maxTurns | subagent request 有单独 maxTurns/default 4；不把它套到主 loop。本批未追全子会话执行，具体 enforcement 待后续 | **Confirmed 注入 / Unknown enforcement** `runtime/methods/subagent.ts:269` |
| Output max tokens | 无 tool calls 时 length/raw output-limit 先最多 3 次 Continue；耗尽抛 recoverable ModelError，结束当前 turn | **Confirmed** `turn-output-token-continuation.ts:18–54`；`turn-model-step.ts:647–705` |
| Input context overflow | micro/auto compact；异常时 reactive compact guard；不能恢复或 rapid refill breaker 触发则抛错 | **Confirmed** `turn-loop.ts:69–103`；`turn-model-step.ts:742–802` |
| Goal token budget | turn 完成后 accounting；SQLite target tokensUsed 达预算时转 `budget_limited`，后续 continuation 要求 active。不是每 chunk 立即截断当前 turn | **Confirmed** `turn.ts:625`；`target.ts:216–244,198–200`；`Adapters/storage/session-target.ts:271,370` |
| Cancellation | turn abort signal 在 loop、model 和 tool 边界检查；tool declarations 已入 history 时补齐配对 cancelled result；外层发布取消 outcome 并释放执行资源 | **Confirmed** `turn-loop.ts:49`；`turn-model-step.ts:368–393`；`turn-tools.ts:140–145,371–378`；`turn.ts:715–845` |
| Error | 不可恢复 model/context/internal error 抛到 turn outcome；accepted future inputs 保留，必要时暂停 queue auto-drain。普通 tool failure 经 result 回灌 | **Confirmed** `turn-model-step.ts:441`；`call-runner.ts:560–597`；`turn.ts:742–798` |
| Timeout | Model 有 stream idle timeout（默认 600000 ms，retry 每次增加 30000 ms）；Tool deadline 按调用策略且 admission 排队暂停计时。本路径未发现整个 turn 的统一 wall-clock deadline | **Confirmed 局部 / Unknown 全局** `apps/zcode-cli/packages/contracts/src/config/index.ts:284`；`Adapters/model/stream-idle-timeout.ts:5–24`；`tool/executor/timeout.ts:20–94` |

### 持续 Goal 的第二层循环

**Confirmed**：`runActiveTargetContinuationLoop()` 用 `while (!abortSignal.aborted)`；有 pending commands 会让出执行权。`executeTargetContinuationCommand()` 在 active target、非 plan、无 active turn/reservation、已持久化时才进入；background work 在跑可暂缓；verifier passed、没有有效 nextAction、目标在验证期间被暂停/替换都返回 null。继续时形成 model-only reminder 再 `executeTurnCommand()`（`target-continuation-loop.ts:49–97`；`target.ts:77–200`）。这是 goal 跨 turn 机制，普通用户任务不强制先经过 verifier。

### Retry Logic

| 层 | 策略与边界 |
|---|---|
| Adapter model retry | **Confirmed** 默认 10 次 retry / 11 attempts，2 秒 base、factor 2、max 60 秒、jitter；env/options 可覆盖。stream 已越过可见 retry boundary 不在 adapter 重放；cancel 不重试；按 failure classification 和预算门决定。SDK `maxRetries: 0`，重试由本项目 runner 管理。来源：`Adapters/model/retry-policy.ts:13–52`；`runner-stream.ts:1455–1498`；`runner-generate.ts:383–398`；`runner-options.ts:92,150`。 |
| Workflow retry budget | **Confirmed** `workflow_child` / `nested_workflow_child` 得到 Unbounded model retry budget，其他 session Default。无上限仍受确定性错误/取消等策略约束；并非整个 Agent 主会话无界 retry。来源：`Core/runtime/methods/runtime-model.ts:43–47`；`model-request-session-type.ts:21–28`；`Adapters/model/workflow-model-failure-policy.ts:114–120`。 |
| Core stream recovery | **Confirmed** 通常最多 10 次；无 tool 的 transient partial text/reasoning 丢弃尾巴、标记 durable discarded assistant，从前一安全消息锚点重开；有 tool declaration 时收集已完成结果，对未执行/状态未知生成 synthetic result，提交 assistant+paired results 后继续。不是对已完成有副作用 handler 盲目重放。来源：`streaming-recovery.ts:14,47,207–274`；`streaming-tool-coordinator.ts:148–217`。 |
| Start Plan busy admission | **Confirmed** 特定 Provider、后续 turn、特定业务码，在未形成 stream anchor 时额外短等待 1s/2s 重试；与 stream recovery 共享 counter。名称指 Provider 套餐 admission，不是 Agent 计划模式。来源：`streaming-recovery.ts:16–21,93–113`；`turn-model-step.ts:289–354`。 |
| Context recover | **Confirmed** `reactiveCompactAttemptedInCurrentModelStep` 防同一步反复压缩；compact 成功后重建 started machine 并重新进循环，rapid-refill guard 限制无效反复 refill。来源：`turn-model-step.ts:742–802`。 |
| Output continuation | **Confirmed** 独立 3 次预算；query-local Continue 不作为长期 canonical user intent；真实 assistant/tool entries 显式 commit 到两种 history。来源：`turn-output-token-continuation.ts:18–105`；`turn-model-step.ts:647–705`。 |
| Tool retry | **Confirmed（统一 executor 范围）** 无通用 execute-handler retry loop；schema/lookup/handler/timeout 错误返回 result，模型下一 step 可重新提出不同 call。during-stream Promise 异常可能 fallback 到 end-of-stream；已完成结果复用。各工具内部自己的 retry 未在本批穷尽。来源：`call-runner.ts:121–184,443,560–597`；`streaming-tool-coordinator.ts:89–99`。 |
| Parse recovery | **Confirmed** malformed JSON/null tool input 在 adapter 归一为 `{}`，交 tool schema 决定报错/执行，不为该错误统一重试整个模型请求。可疑空 non-stop model result 由 guard 抛 ModelError，不视为成功；未发现该 guard 后立即通用 parse retry。来源：`Adapters/model/tool-input-normalization.ts:9–48`；`Core/runtime/helpers/model-errors.ts:126–146`。 |
| Resume | **Confirmed** App `resumeFromStore()` → Runtime `resumeFromStore()` 读取持久化 session/messages、恢复 shell/workspace/branch generation、重建 history/context、hydrate tool/read-file state、todos/target；不是恢复旧 while 的 JS continuation/原 HTTP stream。来源：`Bootstrap/app/create-app.ts:476–495`；`Core/runtime/methods/resume.ts:62,91–152,235`。 |

## Data Flow

**Confirmed**：原始 UI 文本与展开后的 runtime input 可不同；`displayInput` 用于 transcript/UI/title，展开 input 用于模型 history（`turn.ts:503–529`）。模型选择在 turn admission 前冻结，随后所有 context、tools、options 使用实际 Model，session 切模主要作用于未来 turn（`turn.ts:100–104,217–223,557`）。

```text
Input → canonical RuntimeMessageEntry[]
      → turnRequestState.entries（一次借入，之后显式推进）
      → compact / reminder / provider projection
      → ModelRequest { messages, tools, abortSignal, maxOutputTokens }
      → text / reasoning / tool_call / usage / finishReason
      → assistant tool declarations
      → ToolExecutionResult[]（按 tool-call ID 合并并按声明顺序排列）
      → durable parts + createRuntimeToolResultEntry(modelContent, isError)
      → commitTurnRequestEntries() → canonical history + turn-local entries
      → 下一次 provider projection / ModelRequest
```

来源：`turn.ts:595–600`；`turn-loop.ts:168–185`；`model.ts:119–125`；`turn-tools.ts:231–244,359–366`；`turn-output-token-continuation.ts:97–105`。Model 实际能力投影、图片预算与 prompt 拼装细节继续交 Batch 3/4，不把 durable transcript 等同于 API 全量输入。

### State Ownership 与迁移契约

**Confirmed**：10 个 `TurnPhase` 的完整合法迁移如下（`agent/turn-state.ts:230–268`）。这张表是契约，不承诺每条路径在普通 runtime 都使用。

| 当前 phase | `canTransitionTo()` 允许的下一 phase |
|---|---|
| idle | processing_input |
| processing_input | awaiting_model_response、completing |
| awaiting_model_response | streaming、completing、error |
| streaming | scheduling_tools、aggregating_results、completing、error |
| scheduling_tools | executing_tools、awaiting_permission、error |
| executing_tools | aggregating_results、awaiting_permission、error |
| aggregating_results | awaiting_model_response、scheduling_tools、completing、error |
| awaiting_permission | executing_tools、error |
| completing | idle |
| error | idle |

**Confirmed**：普通 loop 每次构造新的 `TurnMachineImpl(nextState)`。`receiveModelResponse()` 在本步结果返回后推进到 streaming；实时 delta 展示走 streaming events/coordinator，并非每个 delta 都调用 machine。因此这个 enum 中的 streaming 不能直接当作实时 socket 正在流的完整事实（`turn-model-step.ts:630–631`；`model.ts:255–265`）。

**Confirmed**：工具真实权限 owner 是 executor/broker；machine 的 `requestPermission()` 在当前 core 搜索只有定义，普通工具 batch 先 schedule 将 calls 设为 scheduled，再 startToolExecution，实际执行通常保持 executing_tools。错误终态对外来自 outcome events；`fail()` 直接设置 error，还绕过 transition table。新 turn 用 `create()`，普通 loop 没有使用 completing → idle 的重置分支（`agent/turn-machine.ts:151–181,238–305`；`turn.ts:124,715–798`）。

## Important Design Decisions

### Planning Model

- **Inference**：普通 loop 的运行形态可以描述为“模型提出行动 → 工具返回观察 → 模型再决策”，接近 ReAct 风格。但源码没有要求固定 thought/action/observation 文本格式，不将其宣称为正式 ReAct framework（`turn-loop.ts:205–218`；`turn-tools.ts:359–366`）。
- **Confirmed**：存在可进入/退出的 Plan Mode，handler 调用 `sessionModePort.enterPlanMode()` / `exitPlanMode()`，退出先保存 approved plan。它是执行模式和交互边界，普通任务不必先生成 Plan DAG（`tool/handlers/plan-mode.ts:37–103`）。
- **Confirmed**：TodoRead/TodoWrite 读写 session store，TodoWrite 替换 todo 列表；loop 按条件追加 todo reminder。它是模型可用的任务管理工具，不是 todo 自动调度器（`tool/handlers/todo.ts:25–70`；`runtime/methods/turn-loop.ts:138–153`）。
- **Confirmed**：仓库另有 `WorkflowGraphScheduler`，持有 optional plannerRunner 和 activity runner，处理 workflow graph nodes（`Core/workflow/scheduler.ts:34–55`）。它没有出现在普通 turn 主 while 的必经调用链；可选 workflow/dynamic workflow 工具由 runtime capability gates 暴露（`runtime/helpers/runtime-tools.ts:47–91`）。完整 graph 执行与 reviewer/critic/Reflection 角色是否提供强制质量门，留 Batch 11/13/15；不能从角色名称推断所有主会话都经过这些阶段。

### 其他执行决策

1. **Confirmed**：显式历史 commit 保证 assistant tool-call 与结果配对，包含取消/断流 synthetic error 的闭合；这比只把结果存 UI 或 SQLite 更关键（`turn-tools.ts:140–145,359–366`；`streaming-tool-coordinator.ts:189–208`）。
2. **Confirmed**：scheduler 根据 metadata 和 sideEffectScope 排并发组；组内 Promise.all，组间按 schedule 顺序 await。普通失败不自动跳过全部后续工具，显式 stopTurn 则取消剩余组（`tools.ts:38–60`；`tool/scheduler.ts:153–198`；`batch-runner.ts:25–124`）。
3. **Confirmed**：repeated tool / budget warnings、Stop hook budget、output continuation budget、model retry budget 是不同机制；不要把其中一个“10”或“3”写成 Agent 全局 max-turns。
4. **Inference**：实际控制跨 while、coordinator、queue、broker、event projection 多处，二次开发时应同时检查调用点和 durable history invariants；单独改 enum 或 `getNextPhase()` 无法证明行为已经变更。

## Unknowns

- **Unknown / Need Verification**：没有调用真实 LLM 或运行故障注入，本批证明的是源码分支，不证明 retry/recovery 在所有 Provider 上有效。
- **Unknown / Need Verification**：所有工具内部 retry、MCP reconnect、子代理 maxTurns enforcement、workflow graph 全部错误策略待 Batch 5/11/13。
- **Unknown / Need Verification**：完整用户 queue admission 与 Host owner/lease、跨 Host stale-run/mobile replay 需 Batch 10/12；本批仅确认 CommandInbox 和 RuntimeCommandQueue 的局部权威。
- **Unknown / Need Verification**：prompt 内容来源、压缩策略的最终 Model input、large tool output 裁剪阈值留 Batch 3/5；本批只追结果确实进入下一次 request 的路径。

## Archify Diagram

- [图 2A · Agent Runtime Workflow](diagrams/02a-workflow/workflow.html)：输入/command owner、模型、工具、结果和 output owner。
- [图 2B · Agent Loop Lifecycle](diagrams/02b-loop/loop.html)：while 的工具回环、text completion gate、恢复和退出。
- [图 2C · Agent Loop State Machine](diagrams/02c-state/state.html)：完整 TurnPhase 合法迁移契约；强调它与实际事件轨迹的差异。

图 2A/2B 是实际 control-flow 的抽象阶段；图 2C 才使用明确源码 enum。自动验收与视觉审查状态见 [validation.md](validation.md)。

## Next Batch Dependencies

Batch 3 接着 `buildRuntimeProviderRequestMessages()`、`MessageHistoryImpl`、`ensureContextInitialized()`、`microcompactIfNeeded()` / `autoCompactIfNeeded()` / `reactiveCompactAfterContextExceeded()`，回答一次 API 请求究竟收到哪些 instructions/history/attachments/tools，以及 canonical 与 query-local Continue 如何分离。Batch 4 从 `createRuntimeModel()` → ProviderModelRuntime → Adapter runner 追模型转换；Batch 5 从已确认的 executor 链追工具 handler，避免重做 loop 导航。
