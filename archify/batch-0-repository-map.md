# Batch 0 · ZCode Initial Repository Map

## Findings

- **Confirmed**：当前源码是 TypeScript 为主的 pnpm workspace。根 `pnpm-workspace.yaml:1` 同时收纳 `packages/*`、`apps/zcode-cli`、其 `packages/*` 和 `tools/*`，CLI 并非外置子模块。根工具链固定 Node 24.14.0 / pnpm 10.33.2（`mise.toml:1`）。CLI 子 workspace 用 Turbo 编排 build/typecheck/lint。
- **Confirmed**：ZCode 的核心不是 React 聊天界面，而是按会话运行的 `AgentRuntime`：它持有历史、工具 registry/scheduler/executor、模型 factory、session/event store 与可注入 I/O 端口。Desktop、Web、TUI、headless prompt、stdio 协议服务是不同入口。
- **Confirmed**：产品服务层 `packages/services` 和执行核心 `apps/zcode-cli/packages/core` 分工不同。前者装配 Session facade、task wrapper、工作区/文件/Git/终端等服务；后者运行 turn、模型与工具反馈循环。
- **Inference**：理解项目最有效的主线是“CLI 入口 → Bootstrap App → AgentRuntime → turn loop → Model/Tool → History/Event”。这是阅读路线建议，不能推导出所有调用都经过同一种客户端协议。
- **Unknown / Need Verification**：未找到独立 IDE extension 入口；本阶段不能把 Electron 工作台、浏览器编辑器能力等同于 VS Code 插件。手机外部 relay 的完整部署链、所有插件机制和 repository indexing 留到后续 Batch。

分析基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`，origin 为 `https://github.com/gimlee/ZCode.git`。开始时已有未跟踪 `promt/`，予以保留。freshness 检查通过。之前 `.archify/` 下的总览不作为本任务的当前提交证据。

## Key Source Files

### Entry Points

| 入口 | 实际源码与符号 | 初步确认的行为 |
| --- | --- | --- |
| Agent CLI | `apps/zcode-cli/packages/cli/src/main.ts:15` · `main()` | 清洗环境、保护 stdout、按调用类型装配生命周期、动态加载 `run()` |
| CLI 分流 | `apps/zcode-cli/packages/cli/src/run.ts:498` · `run()` | `--prompt`/`--target` → `runPrompt()`；app-server/agent-server → 协议入口；缺省命令为 tui |
| TUI | `apps/zcode-cli/packages/cli/src/tui-command.ts:16` · `runTuiCommand()` | 初始化 TUI 侧提示处理与客户端呈现；具体运行连接见 Batch 1 |
| Protocol Agent | `apps/zcode-cli/packages/bootstrap/src/zcode-protocol-entrypoint.ts:82` · `runZCodeProtocolAgent()` | 进程级 SQLite、Provider Registry、MCP pool、Server 与 NDJSON connection |
| Desktop Main | `packages/desktop/src/main/index.ts`；`desktopHostProcess.ts:257` · `spawnHostProcess()` | Electron 窗口/原生生命周期、utilityProcess Host 启动 |
| Desktop Host | `packages/desktop/src/host/index.ts:2780` · InitLocal handler | 窗口 scoped services、attachment 与远端连接注册表 |
| Renderer | `packages/desktop/src/renderer/src/main.tsx:303` · `initializeBusinessRoot()` | MessagePort service proxy → 共享 Root + desktopPlatform |
| Web | `packages/web/src/main.tsx:425` · `bootstrapWebApp()` | WebSocket service proxy → 共享 Root + Web platform |
| HTTP Server | `packages/server/src/entry-http.ts:8` · `main()` | Provider 配置物化 → createLocalServices → createHttpServer |
| 远端 stdio Server | `packages/server/src/entry-stdio.ts:39` · `main()` | hello/ack → services → stdio RPC → 退出清理 |
| Server CLI 管理入口 | `packages/zcode-server-cli/src/main.ts:8` | bundled Agent wiring → runServerCli；Supervisor 细节不在本轮范围 |

### Core Modules / 疑似核心源码目录

“候选”指后续阅读重点；表中职责由入口的 import/factory/实际构造点初步确认，不宣称已审计整包。

| 模块候选 | 当前源码定位 | 已确认的接缝 |
| --- | --- | --- |
| Runtime | `core/src/runtime/agent-runtime.ts:228` | `AgentRuntime` 构造，deps 注入与方法安装 |
| Agent Loop | `core/src/runtime/methods/turn-loop.ts:43` | `runRegularTurnLoop()` 的 `while(true)` |
| Turn 状态 | `core/src/agent/turn-state.ts:25`；`turn-machine.ts:68` | 明确 TurnPhase 与 TurnMachineImpl |
| Context / Prompt | `core/src/context/builder.ts`；`runtime/methods/turn-loop.ts:172` | ContextBuilder 候选；请求前 provider message projection 已有真实调用 |
| Message History | `core/src/agent/message-history.ts`；Runtime 构造第 277 行 | Runtime 持有 MessageHistoryImpl |
| Model / Provider | `bootstrap/src/app/provider-registry-model-runtime.ts`；`create-app.ts:523` | Registry、modelAdapter、modelFactory 注入 |
| Provider Environment | 根 `packages/provider`、`provider-node` | Bootstrap 实际导入 createNodeModelSelectionFacade；不等同于具体供应商请求 adapter |
| Tool | `core/src/tool/registry.ts`、`scheduler.ts`、`executor.ts`、`handlers/` | Runtime tooling 注册原生 tools、构造 executor，I/O 来自 deps |
| Repository / Workspace | `runtime.workingDirectory`、`contextSourcePort`、工具 handlers | 本阶段只确认这些入口，搜索/索引策略属于 Batch 6 |
| Session / Storage | `adapters/src/storage/session-store/sqlite-session-store.ts` | `saveMessage/savePart` 实际调用 repository 写入；不是 UI 直写库 |
| Event | `core/src/runtime/methods/events.ts:83` | append → durable persistence → usage → notifyEventSinks |
| Plugin / Skill | `bootstrap/src/app/create-app.ts:206` | profiles、startup plugins、bundled skill roots 与 plugin features 装配 |
| MCP | `zcode-protocol-entrypoint.ts:227`；`create-app.ts` | 进程连接池与 session lease / adapter 接缝 |
| UI | 根 `packages/ui/src/Root.tsx`、`hooks/`、`store/` | 共享 Root，services/platform 注入，Zustand 临时/投影状态 |
| RPC | 根 `packages/client/src/messageport.ts:25`、`websocket.ts`、`rpc` | ChannelClient、MessagePortProtocol/SocketProtocol、服务代理 |
| 扩展 runtime | `dynamic-workflow`、`dynamic-workflow-runtime`、`node-repl-host` | Bootstrap 有真实装配调用；本轮仅解释其与普通 Loop 的边界 |

表中的 `core/bootstrap/adapters` 相对根为 `apps/zcode-cli/packages/`。

### External Dependencies

**Confirmed（声明依赖）**：React/React DOM、Zustand、Vite、Electron；服务端 Hono、ws、ssh2、node-pty；Agent adapters 的 `ai`、`@ai-sdk/openai`、`@ai-sdk/anthropic`、`@ai-sdk/openai-compatible`、`@modelcontextprotocol/client`、Playwright、ripgrep、Zod。版本与脚本以对应 `package.json` 为准。

声明依赖不自动等于完整运行能力。例如 Playwright 文件不证明存在 E2E 测试套件，Provider SDK 不证明所有模型已配置可用。Batch 4/14 才做能力和测试矩阵。

### Tests 初步侦察

**Confirmed**：当前 tracked 源码有 `packages/services/test/importedClaudeRecovery.test.ts`、`nonCliAcpRetirement.test.ts`、`providerConfigMigration.test.ts` 与 `packages/ui/test/nonCliAcpRetirement.test.ts`。存在 `harness/remote/` 和 Desktop e2e coverage 注入文件。

根及主要 CLI 包 `package.json` 未声明统一 `test` 脚本。`dev:desktop:test` 是开发环境选择，不能当作单测命令。未发现的 Agent unit/E2E 入口标为 **Unknown / Need Verification**，不借历史仓库假设补齐。

## Key Classes / Functions

`main()`、`run()`、`runPrompt()`、`runTuiCommand()`、`runZCodeProtocolAgent()`、`ZCodeProtocolAgentServer`、`createZCodeApp()`、`AgentRuntime`、`TurnMachineImpl`、`ToolRegistryImpl`、`ToolScheduler`、`createRuntimeToolExecutor()`、`SqliteSessionStore`。

核心类的位置不是按文件名猜测：Runtime 构造点在 `create-app.ts:726`，ToolRegistry/Scheduler/History 的真实持有点在 `agent-runtime.ts:228–307`。

## Control Flow

```text
Desktop Renderer.initializeBusinessRoot / Web bootstrapWebApp
  → connectViaMessagePort / connectViaWebSocket
  → RPC service proxy
  → Host / Server 的 createLocalServices
  → ZCodeAgentProcessManager spawn + ZCodeStdioTransport
  → CLI main → run → runZCodeProtocolCommand
  → runZCodeProtocolAgent
  → ZCodeProtocolAgentServer（session 按需创建 App）
  → createZCodeApp → new AgentRuntime

headless CLI main → run → runPrompt → createZCodeApp
  → app.submitPrompt → Runtime turn（不要求经过 Desktop RPC）
```

这里没有把“进程 ready”误画成“所有 session 已创建”；精确的 lazy 创建条件在 Batch 1 深挖。

## Data Flow

用户请求在各呈现入口形成输入，协议路径通过 typed RPC/stdio 到 CLI。Runtime 将 model response/tool result 更新到 History，持久化 session/messages/parts，并通过事件向客户端发布投影。每条边的条件、反馈与重试由 Batch 2 补全，本阶段仅作为导航。

## Important Design Decisions

1. **Confirmed**：Runtime 对文件、Shell、模型、MCP、Storage 使用可注入契约，不将 React/Electron 当作必要运行环境。
2. **Confirmed**：Services task wrapper 与 Runtime session 执行事实不同（`packages/services/src/node.ts:2330`）。
3. **Confirmed**：CLI 协议 stdout 被严格保护，普通 console 被重定向到 stderr（`cli/src/main.ts:29`）；这直接决定协议启动是否可用。
4. **Inference**：最重要的阅读单位是相互连接的调用片段，而非遍历每个大文件。后续按入口、装配、loop、模型、工具返回依次追踪。

## Unknowns

独立 IDE 插件入口、所有运行模式的端到端 ready 时机、运行时外部服务可用性、测试入口覆盖、所有 Provider 支持清单。这些不影响本阶段定位，但不能被升级成 Confirmed。

## Archify Diagram

[图 0：Repository High-Level Architecture](diagrams/00-repository/repository.html) · [规格](diagrams/00-repository/candidate.json)。12 个一级角色，含当前提交的源码引用；最终自动检查状态集中于 [validation.md](validation.md)。

## Next Batch Dependencies

Batch 1 按顺序确认：CLI 模式分流 → 协议进程启动资源 → Server session factory → App 配置/扩展/I/O 装配 → Runtime 构造/start/resume → ready/close。然后 Batch 2 追 `executeTurnCommand → runRegularTurnLoop → runModelBackedTurnStep → executeToolCallsForModelStep`，避免预先把任务套进 Planner/Executor 模式。
