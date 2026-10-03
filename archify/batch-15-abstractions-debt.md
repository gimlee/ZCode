# Batch 15 · 核心抽象、设计模式、技术债与扩展性

基线与 C/A/B 缩写同 [Batch 6](batch-6-repository-understanding.md)。本批综合前置源码证据；**技术债是有依据的维护风险评价，不是未经运行确认的 bug**。

## Findings

ZCode 的主干是“平台 Host / 协议 admission → Session Runtime → Context 与 Model → 本地 Tool Executor → ports/adapters”，而不是单个万能 Agent 类。复杂性主要在不同所有者之间的状态、恢复、身份与副作用提交规则。抽象存在不表示所有入口都使用同一实现，例如 TurnMachine 的类型契约不直接驱动实际 while。

## Key Source Files

核心对象的准确文件列在下一表；源码阅读顺序与每个文件的主要符号见 [Batch 16](batch-16-reading-path.md)。风险交叉证据：[Context](batch-3-prompt-context.md)、[文件编辑](batch-7-file-editing.md)、[并发](batch-10-events-concurrency.md)、[UI](batch-12-ui-cli.md)、[测试](batch-14-testing-eval.md)。

## Key Classes / Functions

| 核心抽象（18 个） | 所有者 / 契约 | 源码 |
|---|---|---|
| App assembly / facades | 将 ports、model factory、session runtime 装成公开会话 API | `B/app/create-app.ts:144` |
| AgentRuntime | 单 session 执行依赖、active turn、history、queue | `C/runtime/agent-runtime.ts:244` |
| CommandInbox | protocol command 的 durable admission / ID 幂等 | `B/zcode-protocol-v4/command-inbox.ts:118` |
| RuntimeCommandQueue | now/next/later 排序、可取消 commands | `C/runtime/command-queue.ts:134` |
| RegularTurnLoopState | 单 turn counters、request entries、model/recovery budget | `C/runtime/methods/turn-loop-state.ts:1` |
| TurnMachineImpl | 合法阶段迁移的不可变状态对象 | `C/agent/turn-machine.ts:68` |
| MessageHistoryImpl | canonical entries，区分真实输入/attachments/tool pairing | `C/agent/message-history.ts:135` |
| ContextBuilder | system/meta-user sections 构造与顺序 | `C/context/builder.ts:51` |
| Model / ExecutableModel | immutable selection/options/capabilities 与 request 校验 | `A/model/model.ts:40` |
| ApiProviderModelRuntime | Registry 到 Model factory 的注入桥 | `B/app/provider-registry-model-runtime.ts:1` |
| ToolEntry / ToolRegistryImpl | schema/metadata/handler 与模型 contracts 投影 | `C/tool/types.ts:278`、`C/tool/registry.ts:30` |
| ToolScheduler | 根据安全 metadata 分组，并非规划整个任务 | `C/tool/scheduler.ts:50` |
| ToolExecutorImpl | lookup/validate/hooks/permission/handler/serialization | `C/tool/executor/impl.ts:16` |
| ExecutionPort / FS adapter | Core 与 OS/process/file IO 隔离 | `A/exec/node-execution-adapter.ts:1`、`A/fs/index.ts:291` |
| NodeMcpAdapter | 外部连接、deadline、auth/reconnect 与结果适配 | `A/mcp/index.ts:157` |
| SqliteSessionStore | 多存储 port 的 session/message/part/input 事实 | `A/storage/session-store/sqlite-session-store.ts:225` |
| SessionEventStore | seq/bounded replay 与 Runtime event sinks | `apps/zcode-cli/packages/contracts/src/events/in-memory-session-event-store.ts:32` |
| ConversationTransport / projection store | 载体注入、只读权威投影与 UI pending overlay | `packages/ui/src/v4/agentConversationTransport.ts:89`、`packages/ui/src/v4/conversationProjectionStore.ts:1` |

## Control Flow

### 实际模式与证据

| 模式 | 实际体现 | 边界 |
|---|---|---|
| Dependency Injection / ports-adapters | createApp 注入 FS/Exec/MCP/Storage/Model；Core 不直接依赖 Node IO | 是当前主结构，不代表所有 Host services 同样窄小 |
| Factory / Adapter | Registry modelFactory、三种协议 SDK factory、消息/tool/usage 转换 | Provider 品牌模板不等于独立协议 adapter |
| Registry | Tool canonical/alias、模型配置、插件发现 | mutable registry 需要 cache invalidation |
| Observer / reducer | append event 后 persistence/sinks；subscription projection | event buffer 并非所有事实的持久 Event Sourcing |
| Command | envelope + Inbox + Runtime queue | 三种命令单位不可混为同一 queue |
| Strategy / policy | model failure policy、tool concurrency、权限与 compact 判据 | 按具体函数判断，未硬套所有条件分支 |
| State | TurnMachine 合法迁移、session flags | 普通 while 与错误 outcome 不是全部由 machine 驱动 |
| Plugin | startup 解析 components 注入 roots/hooks/MCP/profiles | 未证实任意 handler 自动热注入 |

### 扩展难度（相对评价）

| 变更 | 难度 | 主要成本 / 接缝 |
|---|---|---|
| 同协议 Provider | 低～中 | registry config/capability/options/auth；真实服务兼容验证 |
| 全新协议 Provider | 高 | schema、SDK factory、message/tool/media/stream/error/usage 转换 |
| Tool | 中 | contract/handler/registry/exposure/permission/result budget 与测试 |
| Agent profile | 中 | profile prompt/tool allowlist，subagent 生命周期/通知与父子输入隔离 |
| MCP | 配置低；新 transport 高 | trusted authority、deadline、disconnect/auth、结果映射 |
| Skill | 低 | root/SKILL metadata；变量、大小限制、disabled/path identity |
| Agent Loop | 高 | stream commit、tool pairing、compact、goal/stop、cancel/queue |
| Memory | 中～高 | index/root 与写入唯一 owner、隔离、compaction 后读取提醒 |
| Repository Search | 中 | FS/search port、embedded branch、shell dispatch、预算/超时/取消 |

## Data Flow

消息/工具描述通过 canonical data model → 请求投影 → adapter wire；工具结果经过 serializer → persist/paired history → 后续请求。UI snapshot 与 canonical history 是不同模型，转译需维护 row IDs/seq/log epoch。workspaceIdentity 用于隔离，workspacePath 用于 IO/cwd，远程还需 remoteSessionId；这些字段不能压成路径字符串。

## Important Design Decisions

### 有证据的技术债 / 维护风险

1. **集中 orchestration**：`AgentRuntime` methods 注入分散实现，但 internal interface/多种状态仍由大对象协调；`v4-gateway.ts`、`zcodeAgentService.ts` 承担大量路由与恢复分支。拆文件不自动解决所有者复杂度，改动应按 owner/use case 划分，而非只按行数。
2. **状态机与实际流程双重表达**：machine 完整迁移与普通循环实际调用范围不完全一致（Batch 2）。文档/测试若只覆盖类型迁移可能漏实际 error/cancel path。
3. **恢复策略有 Provider 特例**：Start Plan busy provider IDs/业务码位于 Core recovery，workflow failure policy 另有表；改 classifier 时必须确认两层预算和业务码传播。
4. **同步 SQLite**：异步 port 外壳内部使用 DatabaseSync，事务一致性有价值，但不能据 async 方法名认为不阻塞；批量 replay 的延迟风险待测（Batch 9）。
5. **文件保护不是强 CAS**：revision 基于 mtime/size，check → rename 有竞态；atomicWrite fallback 可能就地 truncate。改进前需真实故障/并发测试，不能在文档中承诺 ACID（Batch 7）。
6. **复杂恢复缺少提交内回归**：仅四个迁移/退役测试，没有已提交 Agent/Provider/Tool/E2E suite（Batch 14）；这是最明显的验证风险。
7. **新旧协议入口并存**：V4 UI 与 legacy service methods 共存，引用调查前不应清理旧路径。只修一侧可能使兼容/远端行为漂移。
8. **无确认的运行时语义索引**：现有搜索是文本/on-demand；大型仓库多次发现/读取的成本待测，不能把开发工具依赖图当 runtime intelligence。

**未确认项**：没有本轮依赖图测量来证明循环依赖；没有系统审计证明“异常普遍吞掉”“过多全局状态”或“重复所有工具逻辑”。有意的可恢复 warn/fallback 与静默吞错应逐处区分。Prompt 与工具能力相连是当前行为设计，不自动判为缺陷；风险是 capability 变更后 guidance/schema 失配。

## Unknowns

难度为源码接缝推断，不是工期估算；没有运行 benchmark、依赖环审计或代码覆盖率。维护建议未实现，未删模块、未恢复旧依赖。

## Archify Diagram

复用 [最终 Master Map](diagrams/19-master/master.html) 及 Batch 2/4/5/10 的图。本批以对象、模式、风险表为主，不额外生成抽象的“设计模式图”。

## Next Batch Dependencies

Batch 16 将这些对象落到 30 个按理解价值排序的真实文件；Batch 17 的裁剪边界保留 side-effect safety，Batch 18 以实际接缝给出开发地图。
