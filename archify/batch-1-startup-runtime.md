# Batch 1 · Startup 与 Runtime

基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。继承 [Batch 0](batch-0-repository-map.md) 的仓库导航，本批只追启动、依赖装配和生命周期。以下定位均指当前源码；`CLI/`、`Bootstrap/`、`Core/` 分别缩写 `apps/zcode-cli/packages/cli/src/`、`bootstrap/src/`、`core/src/`。

## Findings

- **Confirmed**：主要 Agent 进程入口是 `CLI/main.ts:15` 的 `main()` → `CLI/run.ts:313` 的 `run()`。无位置命令默认 TUI；`prompt`、`target`、`agent-server`、`app-server` 分流。协议入口共享 `runZCodeProtocolCommand()`，并非 Desktop 内另写一套 Agent Loop（`CLI/run.ts:67,498,514,537`）。
- **Confirmed**：协议进程和单个会话有两次不同的准备边界。`runZCodeProtocolAgent()` 先准备 SQLite、进程 Provider Registry、可选 MCP pool、协议 server/browser broker、NDJSON transport；会话 App 在 `session/create` 或恢复时再创建（`Bootstrap/zcode-protocol-entrypoint.ts:138,156,227,249,310,334`；`zcode-protocol/server-operations.ts:1271,3331`）。
- **Confirmed**：`createZCodeApp()` 是会话依赖装配根，不是全局单例，也不是模型调用本身。它必须收到外部 Provider Registry，然后构造配置、插件/技能 roots、存储及 I/O adapters、Model factory、`AgentRuntime`、输入/工作流/会话 facades（`Bootstrap/app/create-app.ts:144,212,238,392,548,726,791,824,847`）。
- **Confirmed**：`AgentRuntime` 构造时创建 history、CommandQueue、Registry、Scheduler、Reducer、hook runner、executor，并启动 MCP preparation。默认 context builder 在这里仍为 `null`；首次 turn 才初始化，不能把 `completeAppStartup()` 理解成上下文和所有 MCP 工具已经可用（`Core/runtime/agent-runtime.ts:244–307`）。
- **Confirmed**：生命周期所有者是分层的。协议入口持有进程共享资源；`ZCodeProtocolAgentServer` 持有 session records；`ProtocolRuntimeResources` 跟踪包括临时 App 在内的资源；App close 关闭自己拥有的端口，注入的共享 store/port 不重复关闭（`Bootstrap/zcode-protocol/runtime-resources.ts:5–60`；`app/session-facade.ts:264–304`）。
- **Unknown / Need Verification**：未在当前 workspace 导航中找到独立 IDE extension 入口。本批不把 IDE 当作已实现运行入口；完整安装包/外部插件仓库仍不在范围内。

## Key Source Files

| 文件 | 阅读目的 |
|---|---|
| `CLI/main.ts:15–111` | stdout 边界、环境准备、动态加载、进程 cleanup |
| `CLI/run.ts:236–286,313,476–571` | 参数解析与运行模式分派 |
| `CLI/prompt-command.ts:166–247,295` | Headless provider/app/observer 的装配 |
| `CLI/tui-prompt-handler.ts:134–190` | TUI 惰性 App 创建与替换边界 |
| `Bootstrap/zcode-protocol-entrypoint.ts:82–376` | 进程级共享依赖与 transport 生命周期 |
| `Bootstrap/zcode-protocol/server-operations.ts:1238,3296` | 会话请求 → workspace App → session record |
| `Bootstrap/zcode-protocol/workspace-model-runtime.ts:69–76` | workspace 范围模型配置注入 |
| `Bootstrap/app/create-app.ts:144–884` | 会话依赖完整装配顺序 |
| `Bootstrap/app/process-provider-registry-runtime.ts:45,141` | Provider Registry 进程初始化 |
| `Bootstrap/app/provider-registry-model-runtime.ts:1–94` | Registry selection → Model factory |
| `Core/runtime/agent-runtime.ts:228–307,664` | Runtime 构造与 prototype methods 安装 |
| `Bootstrap/app/session-facade.ts:264–304` | shutdown 顺序与 owns 标记 |

## Key Classes / Functions

### Runtime Object Map

| 创建者 | 创建/持有对象 | 作用与生命周期 |
|---|---|---|
| `runZCodeProtocolAgent()` | startup store、process registry、MCP pool、protocol server、connection | 整个 Agent 协议进程共享；EOF/abort 后统一 cleanup |
| `ZCodeProtocolAgentServer` constructor | `ProtocolRuntimeResources`、session map/context、resident pool | server 资源所有者与 session 路由；不是全局 AgentRuntime |
| `createRecord()` | per-session event store、App、session record | workspace identity/path、model/mode、broker 注入；登记到 `context.sessions` |
| `createZCodeApp()` | `ApiProviderModelRuntime`、Model adapter、I/O ports、`AgentRuntime`、facades | 单个会话的装配与 close 边界；共享依赖采用借用语义 |
| `ApiProviderModelRuntime` | Registry 引用、Model adapter、factory closure | `start()` 开启 factory；按目标 selection 创建 Model，非启动时发 LLM 请求 |
| `AgentRuntime` constructor | History、RuntimeCommandQueue、ToolRegistry、ToolScheduler、ToolExecutor、Reducer | 会话执行状态、能力面和循环依赖；具体方法由 `installAgentRuntimeMethods()` 安装 |
| `createInputFacade()` / `createSessionFacade()` | Runtime 引用和闭包 | 产品输入、resume、模型切换、关闭等公开 App 接口 |

来源：`Bootstrap/zcode-protocol/server.ts:234–278`、`runtime-resources.ts:10–33`、`server-operations.ts:3308–3406`、`app/create-app.ts:528–556,726–779`、`Core/runtime/agent-runtime.ts:244–307`。以上均 **Confirmed**。

## Control Flow

### Startup Call Chain · 协议 Agent 主路径

```text
CLI.main()
  → 读取 argv / 识别 protocol & TUI / sanitizeAgentProcessEnv()
  → 配置 stdout（协议仅 NDJSON；日志走 stderr）
  → ensureSeaRuntimeTools() / prepareCliProviderRuntimeEnv()
  → run(context)
    → parseGlobalArgs() / validateGlobalArgs() / resolve cwd
    → runZCodeProtocolCommand()                 [agent-server 或 app-server]
      → 按运行形态决定是否加载 dotenv → sanitize env
      → runZCodeProtocolAgent()
        → createConfig()
        → openProtocolStartupStorage()          [先完成 DB，后续 account/telemetry 可读]
        → startProcessProviderRegistryRuntime() → await runtime.start()
        → telemetry / optional MCP pool + process lease
        → new ZCodeProtocolAgentServer(app factory closure)
        → optional NodeReplBrowserBroker.ready
        → new ZCodeProtocolNdjsonConnection()
        → setNotificationSink() → connection.start()
        → MCP tracker / sampler / startup timing complete
        → await connection.waitForClose()
        → finally cleanupProtocolRuntime()
```

定位：`CLI/main.ts:15–82`；`CLI/run.ts:236–286,313,476,537`；`Bootstrap/zcode-protocol-entrypoint.ts:137–161,227–249,297–346,356`；`app/process-provider-registry-runtime.ts:141`。

**Confirmed**：`prepare-storage-only` 是前置特殊分支，准备存储后直接返回，不会启动协议 server（entrypoint `:85–91`）。`plugin-host` 也在主入口动态加载 bootstrap 前快速分流（`CLI/main.ts:63`）。

### 会话创建与实际装配顺序

```text
protocol dispatch session/create
  → createSession() → createSessionWithProjection()
  → materializeSessionRecord() → createRecord()
  → createWorkspaceZCodeApp() → context.deps.createZCodeApp()
  → ProtocolRuntimeResources.create() → createZCodeApp(options)
    1. require injected Provider Registry → session ID / trace / cwd
    2. createConfig + resolveEffectiveConfigResult → logger / telemetry
    3. agent profiles → resolveStartupPlugins → bundled skill roots
    4. injected SessionStore 或 openStartupSessionStore → persisted mode
    5. resolveAppRuntimeConfig → plugin catalogs / workspace hook policy / permission
    6. input history / artifact / image / mailbox adapters
    7. MCP port → Execution port → PDF / filesystem / HTTP ports
    8. Model adapter → ApiProviderModelRuntime.start() → modelFactory
    9. workflow bridges/optional dynamic workflow → new AgentRuntime(deps)
   10. runtime tooling registration + MCP preparation → startup timing complete
   11. input/workflow/session facade → return ZCodeApp
  → context.sessions.set() → initial model/thought mutations
  → imported history 分支持久化并 app.resume()
  → project snapshot → session/create response
```

定位：`Bootstrap/zcode-protocol/server.ts:570`；`server-operations.ts:1213,1238,1271,1281,1289,1321,1335,3296`；`workspace-model-runtime.ts:69`；`app/create-app.ts:144,153,212,222,238,244,342,348,375,392,408,528,548,726,785,791,847`。

**Confirmed**：新会话并不在 `createZCodeApp()` 返回前自动跑一次模型。resume 是显式接口或用户执行边界触发的准备工作：`prepareUserExecutionBoundary()` 先确定 shell，再 `prepareResume()`；后者只在 `options.resume && !resumePrepared` 时调用 `resumeFromStore()`（`create-app.ts:476–520`）。

### 其他真实入口

- **Confirmed — Headless**：`run()` → `runPrompt()` → `startProviderRegistryRuntime()` → `createApp()` → command-center 特殊分支或 `app.submitPrompt()`；CLI observer 输出事件/result，finally close App、browser、telemetry 和 process registry。源码：`CLI/prompt-command.ts:131–140,166–247,268–295`。
- **Confirmed — TUI**：`runTuiCommand()` → `runTui()` + `createTuiSubmitPrompt()`；handler 的 `getApp()` 才 `createApp()`，通过 `prepareTuiAppRuntime()` 准备 provider/runtime 环境。TUI 不是以 protocol server 套一层运行。源码：`CLI/tui-command.ts:16–59,102–109`；`tui-prompt-handler.ts:134–190`。
- **Confirmed — Desktop**：Electron `app.whenReady()` → settings/data dir/network/bootstrap → `primaryWindowCoordinator.ensurePrimaryWindow("app-ready")` → `createWindowInstance()` → `createWindow()` 注入 `spawnHostProcess()`。Host 收到 `InitLocal` 后经数据库启动 coordinator 创建 `createLocalServices()`，开放 `desktop-continuous` base attachment；service 的 process manager 运行 Agent stdio。源码：`packages/desktop/src/main/index.ts:1926,1940,2004,2279,908,1672,1699`；`main/desktopHostProcess.ts:248–270`；`host/index.ts:2780,2838,2922,2933`；`packages/services/src/zcode-agent/zcodeAgentProcessManager.ts:1019–1037`。
- **Confirmed — HTTP Server**：`entry-http.main()` → materialize bundled provider config → `createLocalServices()` → `createHttpServer()`。WebSocket/RPC frontend 与同一 service 层衔接。源码：`packages/server/src/entry-http.ts:8–26`。
- **Confirmed — stdio Server**：`entry-stdio.main()` → hello → wait ack → device/provider environment → `createStdioServices()` → `createStdioServer()` → process lifecycle/ready。这个 RPC server transport 与 Agent NDJSON 是不同层。源码：`packages/server/src/entry-stdio.ts:39–87`。
- **Confirmed — Web**：`packages/web/src/main.tsx:438–469` 挂载共享 UI Root；它不是本地 core runtime 装配根。具体连接恢复与远控 attachment 语义留待 Batch 12。

## Data Flow

**Confirmed**：`argv/env/cwd` → CLI dependencies → ConfigResult + per-session RuntimeConfig → adapter options/feature gates → Runtime。`workspaceIdentity` 注入隔离键，`workingDirectory = workspacePath` 用于实际 I/O；protocol 同时保留 remote session 信息，不能只按路径看会话（`server-operations.ts:3369–3372,3394–3399`）。

**Confirmed**：进程 Registry → App `ApiProviderModelRuntime.modelFactory` → 按 turn 的模型目标生成 Model；SessionStore → 恢复 mode/model/shell/history；插件解析结果 → tools/hooks/agent profiles/skill roots/runtimeConfig。MCP pool 在进程共享，session App 可获得单独 lease。Registry、pool、store 不是每个 Runtime 重建一份（entrypoint `:251–283`；create-app `:212–244,476–496,548–556`）。

## Important Design Decisions

1. **Confirmed**：I/O 与模型通过 ports/factory 注入 core；App 装配 Node adapters，Runtime 持有抽象端口。Desktop/Headless/TUI 可复用 core（create-app `:726–779`）。
2. **Confirmed**：process-ready、App-created、context/MCP execution-ready 分开；首个模型步骤仍等待 `initializeMcp()`，避免凭一个 startup timing 标记推断完整 readiness（Core `runtime/agent-runtime.ts:302–307`；`runtime/methods/turn-loop.ts:105`）。
3. **Confirmed**：App resources 与业务 session map 分开。EOF 后迟到的 factory result 会立刻停止关闭，不能重新进入 serving（`runtime-resources.ts:12–32`）。
4. **Confirmed**：close 先 `beginShutdown()`，再 drain memory、停止 App 所属 dynamic workflow，最后关闭自己拥有的 browser/execution/MCP/store；App 再 dispose model runtime/telemetry（session-facade `:264–304`；create-app `:1109–1117`）。
5. **Inference**：这些边界让多会话共享进程资源而保留独立执行状态；是否所有异常 shutdown 都无泄漏，需要运行时测试，不能由装配代码证明。

## Unknowns

- **Unknown / Need Verification**：本批静态追踪没有启动 Electron、连真实 Provider 或 MCP；握手耗时、网络失败与打包环境行为未实测。
- **Unknown / Need Verification**：所有配置层的优先级、Provider auth refresh 和 plugin discovery 细节留待 Batch 4/11。本批只确认实际被调用的位置及依赖顺序。
- **Unknown / Need Verification**：remote relay、owner/lease 与 mobile replay 对 ready 的完整定义留待 Batch 9/10/12。

## Archify Diagram

- [图 1A · Startup Lifecycle](diagrams/01a-startup/startup.html)：协议进程准备、按需会话装配及 ready/关闭边界。
- [图 1B · Runtime Architecture](diagrams/01b-runtime/runtime.html)：进程 owner、会话 App、core objects 和注入端口。

图中为 **Confirmed** 的源码路径；阶段分组是可视化抽象，不是额外 Runtime enum。验证详见 [validation.md](validation.md)。

## Next Batch Dependencies

Batch 2 从 `AgentRuntime.executeTurn()` / `executeTurnCommand()` 追 `runRegularTurnLoop()`；沿 `runModelBackedTurnStep()`、streaming tool coordinator、`executeToolCallsForModelStep()` 与 `TurnMachineImpl` 确认每次请求、工具结果、结束和恢复的实际控制权。复用本批 App/Provider/ports 装配结论，不重新导航整个仓库。
