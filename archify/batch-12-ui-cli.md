# Batch 12 · CLI / UI / IDE 通信

基线同 [README](README.md)。`C/`、`A/`、`B/` 路径缩写继承 [Batch 6](batch-6-repository-understanding.md)。

## Findings

- **Confirmed**：当前共享 UI 的输入主链是 `SessionPane.dispatchCommand()` 构造 V4 envelope，经 `ConversationTransport.sendCommand()` 与 Host `IZCodeAgentService` facade 到 CLI Gateway；仍存在的 `sendPrompt()/session/send` 是另一条兼容入口，不能替代当前 V4 主链。
- **Confirmed**：CLI 不只是终端展示层。它包含协议 server、App assembly、session Runtime、模型/工具执行及 SQLite 持久化；headless/TUI/protocol 是不同入口，复用 Core。Desktop Renderer 与 Web 客户端承载交互和投影，不决定已接纳输入队列。
- **Confirmed**：Main 启动 window-scoped Local Host、分发 MessagePort、转发 owner/lease 与原生操作；Host 使用 workspace identity 路由并调度 Agent 进程。远程 workspace 在窗口内注册表管理。手机 attachment 复用现有逻辑会话及运行时，不新建手机专属 Agent 或 Desktop Remote Host。
- **Confirmed**：Desktop 实时链路与 Web 远控恢复链路不同：可信 `desktop-continuous` 对应 continuous，`web-remote-replayable` 对应 replayable。Gateway 从可信连接上下文选择 delivery profile，不能让 UI payload 任意选择权限或链路语义。
- **Unknown**：本提交未发现独立 IDE extension 的 manifest/启动入口；不能将 IDE 中编辑这个仓库的环境当成产品集成能力。

## Key Source Files

| 文件 | 可定位的证据 |
|---|---|
| `packages/ui/src/v4/SessionPane.tsx:1395` | dispatch envelope、上行前记 pending、ACK 与权威投影分开 |
| `packages/ui/src/v4/commandFactory.ts:51` | command ID、稳定 client ID、CAS revision/log epoch |
| `packages/ui/src/v4/agentConversationTransport.ts:89,350` | service 注入、握手、command 转发 |
| `packages/ui/src/v4/conversationProjectionStore.ts:1` | snapshot replace、fromSeq 连续性、订阅恢复 |
| `packages/services/src/zcode-agent/zcodeAgentService.ts:5044,5102` | trusted clientMode、workspace 路由、V4 request |
| `packages/services/src/zcode-agent/zcodeAgentProcessManager.ts:538,860` | workspaceKey 启动收敛与进程管理 |
| `packages/services/src/zcode-agent/zcodeStdioTransport.ts:35,85` | UTF-8 / LF JSON frames、异步 stdin write |
| `packages/desktop/src/main/desktopHostProcess.ts:706` | utilityProcess 与 Main/Renderer MessageChannel |
| `packages/desktop/src/host/windowRemoteConnectionRegistry.ts:1` | 窗口内远端连接记录与 generation |
| `packages/desktop/src/host/taskRealtimeBridge.ts:28` | Host 实时 attachment、lease/owner channels |
| `packages/desktop/src/main/desktopRemoteSessions.ts:976` | 手机附着已有 logical session Host port |
| `packages/shared/src/zcode-protocol-v4/transport.ts:28` | trusted clientMode / deliveryProfile schema 校验 |
| `B/zcode-protocol-v4/v4-gateway.ts:1390,2376` | subscription profile、command admission |

## Key Classes / Functions

`createCommandEnvelope()` 建立一次提交的关联 ID；重试/对账必须沿用该 ID。`createAgentConversationTransport()` 隔离载体，握手能力不足时拒绝独立 Plan 请求。`ZCodeAgentProcessManager` 按 identity fallback 路径的 workspaceKey 收敛并发 spawn。`V4Gateway` 做协议校验、订阅和 admission；`CommandInbox` 保存 input/ACK 幂等事实。`conversationProjectionStore` 只通过订阅更新会话事实，pending overlay 是 UI 临时状态。

## Control Flow

```text
SessionPane.dispatchCommand → createCommandEnvelope
 → pendingCommandRegistry.record（上行之前）
 → sendCommand → ensureHandshake
 → agentService.sendConversationCommandV4
 → Host getClient(workspacePath, workspaceIdentity, remoteSessionId)
 → client.request(V4_METHODS.command, envelope, commandAckSchema)
 → stdio JSON frame → CLI Gateway.handleCommand → CommandInbox.handle
 → durable input admission → host.executeCommand → App input facade → Runtime queue
 ← CommandAck（不等待整个模型任务）
Runtime committed facts → Gateway subscription frames → Host/transport
 → projection store snapshot/delta → UI
```

上图省略平台 RPC proxy 的具体 wire 包装；Desktop 用 MessagePort/RPC 到 Local Host，Agent 进程用 stdio，Web/远控载体用 WebSocket 与可信 attachment。它们不是同一条字符串通道。subscription 的冷会话恢复使用权威 attachment context，不能从旧持久化路径反推远程路由。

## Data Flow

- envelope 含 commandId/clientId/sessionId/type/payload/issuedAt，按命令需要含 baseRevision/baseLogEpoch。workspace identity 在服务路由上下文传递，Host 关联 remoteSessionId。
- ACK accepted/duplicate 只说明命令接纳事实。UI pending overlay、最近输入/选项缓存不能被误当成已落盘 conversation row。
- snapshot 整体替换；delta 仅在 `fromSeq === snapshot.seq` 时应用。gap 触发重订阅，用 base 让 server 决定 replay 或 snapshot，不自行拼造缺失 rows。
- 已 accepted 输入的 projection watchdog 恢复的是 owned subscription，**不重发 command**（`SessionPane.tsx:1507`）。transport-error 的 pending 账本还需要 command query 对账，不能把所有断线一律自动重发。
- `zcodeStdioTransport` 用 LF 分帧和 StringDecoder，stdout 承载协议，stderr 分开；不是用任意 Unicode 行分隔符拆 JSON。

## Important Design Decisions

**Confirmed**：进程/连接身份与业务 session 身份分离，窗口 Host 可承载多个 workspace/session；Main 转发不拥有 task/session 队列。clientMode 必须来自 trusted carrier，schema 还校验 mode 与 profile 对应。**Inference**：投影与命令对账分开有利于重连后恢复事实并保持 admission 幂等，但依赖 UI、Host、CLI 全链路一致，不能只修改 Renderer。

## Unknowns

未启动 Electron/WebSocket/手机，未实测跨 Host lease、stale run、丢帧、重连或窗口销毁。本批确认的是当前源码控制流。未抓取实际 RPC frame，旧兼容接口仍有调用者的范围需要专门引用分析。

## Archify Diagram

- [图 12A · Frontend / Runtime Architecture](diagrams/12a-front-runtime/front-runtime.html)
- [图 12B · UI Request Sequence](diagrams/12b-ui-request/ui-request.html)

## Next Batch Dependencies

Batch 13 分开分析物理请求 retry、Core stream recovery、工具错误反馈与 UI subscription/command 对账；不能以同一个“重试”标签掩盖副作用边界。
