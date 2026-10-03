# Batch 17 · ZCode Minimal Core

基线同 [README](README.md)。这里是基于源码的裁剪设计推断，**没有删除代码**。“20%”是核心责任的比喻，未做依赖闭包/行数测算，不能承诺直接删除其他目录后可构建。

## Findings

最小可用 coding agent 必须保留：一个入口与会话 owner、串行输入/取消、context/history、一个 Model protocol、安全 tool execution、FS/Exec/search、workspace identity 和结果闭环。若要求跨进程客户端/恢复，则 V4 admission、storage/replay 也成为核心；单次本地 headless 原型可以先不保留完整 GUI/remote/workflow 产品面。

## Key Source Files

| 最小责任 | 当前源码路径 | 保留原因 |
|---|---|---|
| CLI/headless composition | `apps/zcode-cli/packages/cli/src/main.ts:15`、`B/app/create-app.ts:144` | argv/cwd、构造真实 adapters、资源 close |
| Session execution owner | `C/runtime/agent-runtime.ts:244`、`C/runtime/methods/turn.ts:93` | 依赖/active turn/input/outcome 的唯一协调点 |
| Admission / command serial | `C/runtime/command-queue.ts:134`、`C/runtime/methods/runtime-command-queue.ts:36` | 防止并发输入抢同一 turn、取消传播 |
| Agent loop | `C/runtime/methods/turn-loop.ts:43`、`turn-model-step.ts:235`、`turn-tools.ts:359` | model → tool → paired result → next step |
| History / context / compact | `C/agent/message-history.ts:135`、`C/context/builder.ts:87`、`C/runtime/methods/compact-active.ts:484` | 因果消息、指令、token/summary；长任务不能只无限追加 |
| One model protocol | `A/model/model.ts:40`、`A/model/model-execution.ts:344`、`runner-stream.ts:123`、`transform.ts:46` | 能力与请求校验、wire 适配、stream/retry |
| Tool core | `C/tool/registry.ts:30`、`C/tool/executor/call-runner.ts:65`、`result-serialization.ts:46` | schema/permission/handler/output budget |
| Coding tools | `C/tool/handlers/read.ts:141`、`edit.ts:84`、`write.ts:66`、`bash.ts:97` | 获取证据、受控修改、运行验证 |
| OS adapters | `A/fs/index.ts:291`、`A/exec/node-execution-adapter.ts:1` | IO/进程树、cwd/env、超时/取消、search backend |
| Contracts / identity / events | `apps/zcode-cli/packages/contracts/src/model/index.ts:1`、`C/runtime/methods/events.ts:68` | 类型契约、跨层追踪与错误收口 |
| Durable mode 追加 | `A/storage/session-store/sqlite-session-store.ts:225`、`C/runtime/methods/resume.ts:56` | 会话恢复与 input/message 事实 |
| Client mode 追加 | `B/zcode-protocol-v4/v4-gateway.ts:2376`、`command-inbox.ts:118` | stable IDs/admission、订阅一致性；不能用 UI 临时队列替代 |

## Key Classes / Functions

`createZCodeApp()` 是复用当前实现的装配入口；`AgentRuntime` + `runRegularTurnLoop()` 是执行核；`Model` 与 `ToolEntry` 是两个外部能力契约；`MessageHistoryImpl` 保持工具声明/结果成对。最小化可以减少产品功能，不能让 Provider SDK 接管现有副作用工具而绕过 permission/commit。

## Control Flow

```text
local headless entry → createApp(ports, modelFactory)
 → submitPrompt → Runtime command queue → executeTurnCommand
 → initialize context / persist optional input
 → loop { compact; model request; collect; execute local tools; commit pairs }
 → no pending continuation → final turn result → cleanup
```

保留一次真实 tool 回注而不是仅实现“模型返回即结束”。streaming early execution 可以在原型中关闭以缩小复杂度，但不能删除 cancellation、paired tool history 与已执行调用去重规则。

## Data Flow

最小状态为 workspace identity/path、session/turn IDs、canonical history、turn-local request entries、read-file freshness、模型能力、当前 command/abort 与权限选择。长期模式另持久化 session/input/parts/checkpoint。工具大输出仍需要 budget/artifact，否则仅裁剪 GUI 并不会降低 context 失控风险。

## Important Design Decisions

可作为可选产品面逐步移出：Desktop/Web UI、Main/relay/配对、浏览器/CUA 官方插件、完整 marketplace、cron/offpeak、workflow/goal 产品编排、telemetry/发布/SEA 安装流程、多 Provider 模板目录。它们各有当前用户功能，不能在真实 ZCode 产品中不经需求对齐直接删除。

MCP/Skill/profile 是扩展能力，可在最小演示配置关闭；memory index 与 compact 可按单次短任务缩减。但删除 feature flags 不能导致工具描述与注册集合不一致。若仍声称支持 remote/mobile/resume，就必须保留 identity、remoteSessionId、owner/lease/stale run 和 delivery profile，不属于可随意精简的“兜底”。

## Unknowns

尚未构建独立包或计算传递依赖闭包；Core 不一定可以脱离 contracts/provider/adapter packages 直接运行。没有验证裁剪后 bundle size/performance。上述是责任裁剪方案，不是已经可执行的删除清单。

## Archify Diagram

从 [Master Map](diagrams/19-master/master.html) 阅读 Runtime → Context/Model 与 Tool → FS/Exec 两条路径；核心顺序详见 [Agent Loop](diagrams/02b-loop/loop.html)。

## Next Batch Dependencies

Batch 18 明确各责任的实际改动点和验证边界；Batch 19 将完整产品面与最小执行核一起定位。
