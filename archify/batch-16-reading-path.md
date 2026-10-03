# Batch 16 · 核心源码阅读路线

基线同 [README](README.md)。按理解执行主干与二次开发价值排序，不按文件大小；C/A/B 路径缩写同 [Batch 6](batch-6-repository-understanding.md)。

## Findings

先定位实际 while、session owner 与 input admission，再读 Context/Model/Tool 的契约，最后追 Node IO、storage 和平台投影。不要先在 UI 大文件或生成的 Bash command registry 中迷失。下表列出恰好 30 个已存在文件，每项给出作用、重要性、主要符号和阅读时机。

## Key Source Files

| 排名 / 文件路径 | 核心作用 | 为什么重要 | 主要 Class / Function | 应该何时读 |
|---|---|---|---|---|
| 1. [C/runtime/methods/turn-loop.ts](../apps/zcode-cli/packages/core/src/runtime/methods/turn-loop.ts) · :43 | model/tool 外层循环 | 实际 continue/break 权威 | `runRegularTurnLoop` | 先读核心主干 |
| 2. [C/runtime/agent-runtime.ts](../apps/zcode-cli/packages/core/src/runtime/agent-runtime.ts) · :244 | 单 session 对象装配 | 确定依赖和状态所有者；实现分布在 methods | `AgentRuntime / installAgentRuntimeMethods` | 循环前后对照 |
| 3. [C/runtime/methods/turn.ts](../apps/zcode-cli/packages/core/src/runtime/methods/turn.ts) · :93 | 输入、turn 生命周期与 cleanup | 冻结 selection、成功/取消/异常收口 | `executeTurn / executeTurnCommand` | 理解一次完整输入 |
| 4. [B/app/create-app.ts](../apps/zcode-cli/packages/bootstrap/src/app/create-app.ts) · :144 | ports/model/runtime/facades composition | 知道对象从哪里来及 owns/shared 边界 | `createZCodeApp` | 定位启动和 DI |
| 5. [C/runtime/methods/turn-model-step.ts](../apps/zcode-cli/packages/core/src/runtime/methods/turn-model-step.ts) · :235 | 模型结果分类与恢复分支 | 连接 stream、tools、compact、完成 | `runModelBackedTurnStep` | 深入一次模型步 |
| 6. [C/runtime/methods/turn-tools.ts](../apps/zcode-cli/packages/core/src/runtime/methods/turn-tools.ts) · :359 | 工具调度和 paired commit | 执行成功不等于历史已提交 | `executeToolCallsForModelStep / commitTurnRequestEntries 调用` | 追副作用与回注 |
| 7. [C/runtime/methods/runtime-command-queue.ts](../apps/zcode-cli/packages/core/src/runtime/methods/runtime-command-queue.ts) · :36 | 串行 command drain | 并发输入不会直接进入 while | `drainRuntimeCommandQueue / runRuntimeCommand` | 研究 busy/queue/cancel |
| 8. [B/zcode-protocol-v4/command-inbox.ts](../apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/command-inbox.ts) · :118 | ID 幂等与 durable admission | 远端重连 accepted input 的所有者 | `CommandInbox.handle` | 研究发送重复和队列 |
| 9. [B/zcode-protocol-v4/v4-gateway.ts](../apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/v4-gateway.ts) · :2376 | V4 command/subscription 边界 | trusted profile、cold resume、ACK 与投影 | `V4Gateway.handleCommand` | 跨 UI/Host/CLI 时 |
| 10. [C/runtime/methods/model.ts](../apps/zcode-cli/packages/core/src/runtime/methods/model.ts) · :36 | 最后请求与 stream 采集 | 真正调用 Model 的位置 | `runModelTextRequest` | 核对 LLM 请求 |
| 11. [C/context/builder.ts](../apps/zcode-cli/packages/core/src/context/builder.ts) · :87 | system/meta-user sections | prompt 顺序与 custom/workflow 差异 | `ContextBuilder.build` | 修改 prompt 时 |
| 12. [C/runtime/methods/context.ts](../apps/zcode-cli/packages/core/src/runtime/methods/context.ts) · :31 | 惰性环境/技能/memory 装配 | context 不是启动时全量仓库扫描 | `ensureContextInitialized / createContextBuilderFromSnapshot` | 理解上下文来源 |
| 13. [C/runtime/helpers/provider-request-messages.ts](../apps/zcode-cli/packages/core/src/runtime/helpers/provider-request-messages.ts) · :48 | 请求视图投影 | reminder 因果位置与内部 metadata 剥离 | `buildProviderRequestMessages` | 调试模型看到的内容 |
| 14. [C/agent/message-history.ts](../apps/zcode-cli/packages/core/src/agent/message-history.ts) · :135 | canonical 历史模型 | 真实输入/attachments/tool pairing 与 clone | `MessageHistoryImpl` | 改消息/持久化前 |
| 15. [C/runtime/methods/compact-active.ts](../apps/zcode-cli/packages/core/src/runtime/methods/compact-active.ts) · :75 | 摘要、tail、boundary 替换 | context overflow/长期任务的主实现 | `compactActiveConversation` | 调 compact/recovery 时 |
| 16. [A/model/model.ts](../apps/zcode-cli/packages/adapters/src/model/model.ts) · :40 | Model handle / request 校验 | 能力和 bound/per-request options 权威 | `ExecutableModel.prepareRequest` | 扩展模型契约时 |
| 17. [A/model/model-execution.ts](../apps/zcode-cli/packages/adapters/src/model/model-execution.ts) · :181 | 协议 factory / snapshot / auth | Provider 品牌与 wire protocol 分离 | `AiSdkModelExecution.bindModel / createFactory` | 新增 Provider 时 |
| 18. [A/model/runner-stream.ts](../apps/zcode-cli/packages/adapters/src/model/runner-stream.ts) · :123 | stream attempts / retry boundary | 可见输出后不能无条件重放 | `runStreamText / canRetryStreamFailure` | 查断流/429 时 |
| 19. [C/tool/executor/call-runner.ts](../apps/zcode-cli/packages/core/src/tool/executor/call-runner.ts) · :65 | 完整工具执行边界 | 校验、hooks、permission 与结果互相约束 | `executeToolCall` | 改 dispatcher 或权限时 |
| 20. [C/tool/registry.ts](../apps/zcode-cli/packages/core/src/tool/registry.ts) · :30 | entry/alias/contracts | 注册集合与模型曝光不是一回事 | `ToolRegistryImpl.register / toContracts` | 增加 Tool 时 |
| 21. [C/tool/scheduler.ts](../apps/zcode-cli/packages/core/src/tool/scheduler.ts) · :50 | 安全并发分组 | 副作用和交互工具不能任意 Promise.all | `ToolScheduler.schedule` | 修改 tool concurrency 时 |
| 22. [C/tool/handlers/read.ts](../apps/zcode-cli/packages/core/src/tool/handlers/read.ts) · :141 | 文本/媒体读取与 read state | 后续 Edit/Write freshness 的依据 | `readHandler` | 查读缓存/文件回注时 |
| 23. [C/tool/handlers/edit.ts](../apps/zcode-cli/packages/core/src/tool/handlers/edit.ts) · :84 | 匹配、替换、编码与 freshness | 不是直接应用统一 diff patch | `editHandler / writeEditResult` | 修改文件匹配时 |
| 24. [C/tool/handlers/bash.ts](../apps/zcode-cli/packages/core/src/tool/handlers/bash.ts) · :97 | shell tool 产品行为 | cwd/background/timeout 与 permission entry | `bashHandler / createBashToolEntry` | 研究测试执行/OS 时 |
| 25. [A/fs/index.ts](../apps/zcode-cli/packages/adapters/src/fs/index.ts) · :115 | FS/search backend | 实际 revision/atomic fallback 与 rg worker | `NodeFileSystemAdapter` | 追 IO/search 的真实实现 |
| 26. [A/exec/node-execution-adapter-run.ts](../apps/zcode-cli/packages/adapters/src/exec/node-execution-adapter-run.ts) · :1 | Node process 执行 orchestration | spawn、输出收集、终止树分布到相关模块 | `NodeExecutionAdapterRun` | 追 shell 进程生命周期 |
| 27. [A/storage/session-store/sqlite-session-store.ts](../apps/zcode-cli/packages/adapters/src/storage/session-store/sqlite-session-store.ts) · :225 | session/message/part/input storage | 多 port 共用 DatabaseSync 与事务 | `SqliteSessionStore` | 查 durable 状态时 |
| 28. [C/runtime/methods/resume.ts](../apps/zcode-cli/packages/core/src/runtime/methods/resume.ts) · :56 | 恢复 active history / read state | 中断工具不会自动重跑 | `resumeFromStore` | 研究重启恢复时 |
| 29. [packages/services/src/zcode-agent/zcodeAgentService.ts](../packages/services/src/zcode-agent/zcodeAgentService.ts) · :5044 | Host V4 service facade | identity/trusted mode 与 CLI client 路由 | `sendConversationCommandV4` | 跨平台集成时 |
| 30. [packages/ui/src/v4/SessionPane.tsx](../packages/ui/src/v4/SessionPane.tsx) · :1395 | 当前 UI 提交与 pending | ACK admission 与订阅 facts 分离 | `dispatchCommand` | 改用户输入/重连交互时 |

## Key Classes / Functions

上表覆盖 Runtime/Loop/Inbox/Model/Tool/History/FS/Exec/Storage/Host/UI 的主要对象；精确跨函数调用链见 [Batch 20](batch-20-call-chains.md)。methods 的 free function 通过 prototype 安装使用 this，不能把类文件没有方法 body 误判为功能缺失。

## Control Flow

### 30 分钟：只建立全局模型

- 5 分钟：Master Map + Batch 0 的包/产品入口。
- 10 分钟：排名 4 → 2 → 1，知道谁创建 Runtime、谁控制循环。
- 10 分钟：排名 3 → 5 → 6，连接输入、模型步与工具结果。
- 5 分钟：排名 8 → 29 → 30，知道 UI accepted input 不是 Renderer queue。

### 2 小时：理解核心 Runtime

先按 30 分钟路线，再用 30 分钟读 7/8/9 的两层队列、协议 ACK；30 分钟读 10/11/12/13/14 的最终请求；最后 30 分钟读 19/20/21 与 Batch 2 stop/recovery，对照一条 read-only tool call 与一条副作用工具的区别。

### 1 天：理解完整 Agent

上午：启动/App + 1～15，画自己的一次 turn 与 compact 调用链；下午：16～26 追 provider transform/stream、permission、Edit 和 OS 执行；傍晚：27～30 追 durable input/resume/投影。补读 Batch 8、10、11 的信任/并发/MCP 接缝。时间为学习安排建议，不是测得的阅读耗时。

### 3 天：达到可二次开发程度

第 1 天走上述路线；第 2 天逐一核对 Batch 18 的目标模块受控架构上下文，追 Desktop/Web owner/lease、identity 和两种恢复链路，确认 spec/test 的现状；第 3 天选择一个有界练习（如同协议 model config 或无副作用 Tool），先 spec 再实现/验证，同时复盘 stream+tool commit、resume、取消和错误。当前依赖缺失时先完成静态追踪，不把练习列为已执行成果。

## Data Flow

阅读时连续记录同一 sessionId/turnId/toolCallId/commandId，从输入 metadata → history/request projection → wire → tool result → persistence → subscription，关注 workspaceIdentity 与路径的差别。通过排名 13 与 6 比较 canonical 与请求视图，避免把所有 messages 都认为直接原样发给 Provider。

## Important Design Decisions

30 个是入口清单而非封闭依赖集合；读到 ports/types/helper 时沿公开入口继续。Write、edit-matchers、MCP/skills/plugins、permission-flow、streaming-recovery 的专题文件见对应 Batch 7/11/13，未因不进前 30 而降低其安全边界的重要性。

## Unknowns

没有实际阅读速度或理解度测量。表中 :line 为源码定位点，不声称完整类只在该行；linked source 采用 repo 相对文件，diagram source links 固定 revision。

## Archify Diagram

[Master Map](diagrams/19-master/master.html) 是全局入口；[UI sequence](diagrams/12b-ui-request/ui-request.html) 与 [LLM sequence](diagrams/04b-request/request.html) 支持分段深入。

## Next Batch Dependencies

Batch 17/18 使用这 30 个文件识别最小责任核与修改接缝，Batch 20 给出精确方法链。
