# Batch 10 · Event / Async / Concurrency

基线与简称沿用 [Batch 6](batch-6-repository-understanding.md)，工具并发判据复用 Batch 5，不重新定义。

## Findings

**Confirmed：核心不是一个无约束的全局 EventEmitter。** Runtime `appendEvent()` 先 eventStore.append 分配 sequenceNumber，持久化需 durable 的事件、记录 usage，然后 notify sinks；live/replay/snapshot 使用同一编号事实。ModelStreaming/ToolCallProgress 等高频瞬态不意味着每个 token 都永久落 SQLite。

**Confirmed：并发有多层 owner。** CommandInbox 串行同 session admission；Runtime queue 串行 foreground command；工具 scheduler 分安全组并发；多个 session/child Agent 可各自执行；model admission 控制实际 in-flight 请求。Node async 并不表示每个 session 一个 OS 线程，Worker 检索与 shell 子进程才有明确独立执行单元。

## Key Source Files

| 文件 | 职责 |
|---|---|
| `apps/zcode-cli/packages/contracts/src/events/session.events.ts:1` | Session/Turn/Model/Tool/交互事件契约 |
| `apps/zcode-cli/packages/contracts/src/events/in-memory-session-event-store.ts:32,60` | seq owner、turn-window retention |
| `C/runtime/methods/events.ts:68,80` | create/append、durable、usage、sink 顺序 |
| `C/runtime/methods/model-streaming-event-queue.ts:12` | promise tail、有序写与 backpressure |
| `B/zcode-protocol-v4/command-inbox.ts:87,118,133` | key gate / session gate / pinned facts |
| `C/runtime/command-queue.ts:134` | now/next/later priority 与稳定队列 |
| `C/runtime/methods/runtime-command-queue.ts:22,36` | 单 drainer、批量后台通知 |
| `C/runtime/methods/streaming-tool-coordinator.ts:51` | final call 的早执行与 ID cache |
| `C/tool/executor/batch-runner.ts:24` | group Promise.all 与顺序组 |
| `C/subagent/runner.ts:131,171` | child task/abort/watchdog/foreground/background |
| `A/model/request-admission.ts:38` | 单 attempt 的准入 ticket |

## Key Classes / Functions

### 实际事件族

SessionCreated/Title/Mode、TurnStarted/Complete/Error、ModelRequest/Streaming/NetworkStatus/Complete、ToolCallStarted/Progress/Completed/Error、StreamingToolLedgerUpdated、SessionInputPromoted、Checkpoint/rewind 等以当前 `SessionEventType` 定义为准。任务说明里的 AgentStarted/MessageAdded 只是搜索示例，不凭空添加同名事件。

**Confirmed：** InMemorySessionEventStore 默认 turn-window retention，淘汰不回退 latestSequenceNumber；时间兜底 prune 处理已 sealed 的瞬态 turn。完整 unbounded 是显式模式，不是默认。

**Confirmed：** `createModelStreamingEventQueue()` 用 tail promise 串行写，默认 high-water 128；enqueue 让 SSE reader 继续消费，finish/error/tool-call 边界 drain，达到高水位也 drain。writeFailure 记住后在边界抛出，不静默宣布成功。

## Control Flow

```text
raw command → parse envelope → key gate → 查 pinned/durable 精确事实
  → per-session admission gate → epoch/revision/guard → 分配 admissionSeq
  → gateway execute → settle 才释放 session gate
Runtime enqueue → 单 drainRuntimeCommandQueue → await 当前 command
  → model stream enqueue → 有序 append → eventStore seq
  → persist durable/usage → notify sinks → protocol/service/UI projection
  → final tool call → 可选安全早执行 / end-of-stream scheduler
  → paired results → 最终 outcome
```

**Confirmed：** CommandInbox 的 in-flight 与 live input 不进入 settled LRU；只有 settled 才进 512/session LRU，查询还会查精确 sourceCommandId 的 durable facts。阻止 pending 命令因 cache churn 丢幂等锚点。

**Confirmed：** Runtime drainActive 保证单 drainer，队列按 now/next/later 排序；后台通知可合批进一轮，branchGeneration 检查拒绝旧分支结果。foreground promotion lease/turn reservation 防止两个输入各自创建 turn。

## Data Flow

事件 source payload → append 后带 seq 的 storedEvent → durable facts/usage/sinks；streaming delta → 有序 queue → live projection，最终 message/parts 形成恢复事实。tool calls 按 ID 缓存早执行结果，按原声明序保存；完成顺序不变成 history 配对顺序。

## Important Design Decisions

- **Confirmed：** key/session admission、foreground command、tool concurrency、model attempt admission 分工，不能用一个“全局队列”概括。
- **Confirmed：** 子 Agent 有独立 session/task abort/watchdog 与共享注入能力；不是自动复制桌面 Host。
- **Confirmed：** event sink 收到 append 后的 seq；seq buffer 与 durable transcript 生命周期分离。
- **Inference：** 高风险共享事实包括 input promotion、read-state、branch/run generation、owner/lease 和冷恢复 activation；源码已有针对竞态的 guards，不等于证明不存在所有 race。

## Unknowns

- **Need Verification：** 未做高吞吐 token、跨 Host ownership、并发取消和 LRU churn 压力测试。
- **Need Verification：** sink/transport 的 replay/连续流交付语义留 Batch 12；不能由 EventStore.getEventsAfter 推断手机与桌面使用相同重连策略。

## Archify Diagram

- [图 10A · Event Flow](diagrams/10a-events/events.html)
- [图 10B · Concurrency Architecture](diagrams/10b-concurrency/concurrency.html)

## Next Batch Dependencies

Batch 11 追外部 MCP/Skill/Plugin 的装配与信任，再由 Batch 12 追 frontend、Host、CLI 的跨进程交付。
