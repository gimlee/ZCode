# Batch 9 · Session / State / Persistence

基线与 C/A/B 简称沿用 [Batch 6](batch-6-repository-understanding.md)。本批区分 durable session、resident App、运行中 turn 与 UI projection。

## Findings

**Confirmed：会话主要存储是 SQLite，而非 renderer localStorage。** `SqliteSessionStore` 实现 SessionStore/InputHistory/LocalSetting/ScriptWorkflow/Usage ports，使用 Node `DatabaseSync`。默认数据库 `~/.zcode/cli/db/db.sqlite`，配置可覆盖；多个 Agent 可以共享此 DB。startup 工厂完成迁移后才发布 store；这不是远端 relay 的业务存储。

**Confirmed：一份 App/Runtime 对应一份会话执行状态；进程可驻留多个 session。** sessionId 与 directory/workspaceID、model selection、permission mode、goal、message/parts 共同形成恢复事实。resident pool 是容量/生命周期 controller，不拥有消息；默认 target 8、high-water 16、idle 10 分钟，只有 persisted 且无运行工作/待交互/队列/订阅等阻挡事实才可去激活。

**Confirmed：Resume 是重建，不是把原 JS 对象或 OS process 复活。** 冷订阅先 single-flight activate，再进入既有 READY hydration；Runtime 读取 session/messages，选择 active branch/compact segment，重建 Context、history、read-state、mode/model/shell selection、checkpoint。中断工具形成配对的 interrupted result，而不是自动执行旧 call。

## Key Source Files

| 文件 | 职责 |
|---|---|
| `B/app/create-app.ts:150,476` | sessionId、App 创建与 resume 包装 |
| `B/app/session-store.ts:74,104` | startup store 与 DB path |
| `A/storage/session-store/paths.ts:6` | 默认 DB 路径 |
| `A/storage/session-store/sqlite-session-store.ts:225,241,275,609,650` | 真正 SQLite connection、fact 写入 |
| `A/storage/session-store/repositories/session-inputs.ts:191` | input promotion 与 message/parts 事务 |
| `C/runtime/methods/message-persistence.ts:1` | user/assistant/parts 与 promotion 后事件 |
| `C/runtime/methods/resume.ts:56,124,141,153` | 恢复 owner 与顺序 |
| `C/agent/session-history-hydrator.ts:51` | active messages → RuntimeMessageEntry |
| `B/zcode-protocol-v4/cold-session-resume.ts:42` | 冷恢复 single-flight 与错误分型 |
| `B/zcode-protocol/session-resident-pool.ts:56` | operation lease、LRU/TTL eligibility |
| `C/runtime/methods/workspace-checkpoint-persistence.ts:28,101` | checkpoint entry 持久化/恢复 |

## Key Classes / Functions

### 状态所有者

| 状态 | owner / 生命周期 | 持久化或重建 |
|---|---|---|
| App dependencies | Bootstrap App / 进程共享 ports | 配置与 store 创建，不序列化整个 App |
| Session facts | SessionStore、session facade | SQLite session/message/part/session_entry |
| canonical conversation | MessageHistoryImpl | 从 active persisted messages + Context 重建 |
| 当前请求/turn | Runtime、TurnMachine、turn-local entries | 运行中对象不原样恢复；部分 execution facts 落库 |
| 已接受输入 | CLI CommandInbox + Runtime queue/input ledger | pending/reserved/promoted 等 durable facts |
| Tool tasks | runtime task registry、background lifecycle | 元数据与结果有独立路径，不能等同 OS 进程恢复 |
| live event seq | InMemorySessionEventStore | 单调 seq；瞬态按 turn window 回收 |
| UI 状态 | services projection / UI stores | snapshot/transcript hydration；草稿不是 CLI 事实 |

**Confirmed：** `resumeFromStore()` 拒绝不存在/archived session；修复旧远程路径的持久化失败可保留内存修复并 warn；不是所有存储错误都被忽略。

## Control Flow

```text
createApp(sessionId?, resume?) → open session store → create Runtime
  → 首次输入 ensureSessionPersisted → save user/parts → 模型/工具 → save parts
close / 去激活 → 释放 resident runtime；保留 durable session
重新订阅 → ColdSessionResumeCoordinator.ensureResumed（同 session 单飞）
  → 宿主恢复 App → restore model selection → Runtime.resumeFromStore
  → read session/messages → branch generation/path/shell/workingDirectory
  → hydrate read-state → ensureContextInitialized
  → recover interrupted compact timeline → hydrateMessageHistoryFromSession
  → 恢复 checkpoint/rewind、execution/mode 等事实 → READY hydration
```

**Confirmed：** 输入 promotion 支持把 ledger 置 promoted 与 user message/parts 放同一事务，提交后才发送 SessionInputPromoted 并解除 live-input pin；避免队列已消费而 transcript 未落盘时重复执行。一般各 save 方法不自动组成跨 IO 全局事务；fork/shared import 等有专门事务 bundle。

## Data Flow

Model/user/tool entries → message/parts 或 session_entry repository → SQLite；raw tool artifacts/checkpoint snapshot/output 等另走 artifact/file ports；cold restore 读取这些事实，再依据 branch、compact、tool declaration order 重建 provider-neutral history。完整 transcript、当前活跃上下文和 live/replay event buffer 是不同视图。

## Important Design Decisions

- **Confirmed：** Session resident pool 要 fresh eligibility 与 operation lease；关闭 resident App 不删除 session。
- **Confirmed：** 恢复先 hydrate read-state 再 Context，避免单次加载 memory 后状态被重置。
- **Confirmed：** workspacePath 用于 IO/cwd；workspace identity/remote session 用于路由与隔离，恢复不能沿用进程启动目录当作会话目录。
- **Inference：** message/parts + metadata 的设计允许冷热相同投影，但 serializer、branch/compact 与恢复代码必须共同维护这些不变量。

## Unknowns

- **Need Verification：** 未用真实用户 DB 跑迁移、并发启动或崩溃恢复；DatabaseSync 不等于异步 IO，async port 表面并不改变底层同步执行。
- **Need Verification：** checkpoint 可恢复受跟踪文件；不是任意 shell/network/MCP 副作用的事务 undo。
- **Unknown：** 不能由保存 task 元数据推出重启后原 OS pid/网络请求继续存在。

## Archify Diagram

- [图 9A · Session Lifecycle](diagrams/09a-session/session.html)
- [图 9B · State Architecture](diagrams/09b-state/state.html)
- [图 9C · Persistence Data Flow](diagrams/09c-persistence/persistence.html)

## Next Batch Dependencies

Batch 10 追 append → seq → sinks、stream write queue、CommandInbox 与不同并发层，避免把 live event buffer 误当 durable DB。
