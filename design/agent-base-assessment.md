# ZCode 改进与行业 Agent 基座：评估结论

日期与版本见 [总入口](README.md)。本评估针对当前源码，不以通用 Agent 框架宣传或历史目录推断能力。

## 结论

**可以改造成基座 Agent，且有值得复用的执行能力。最合理的起点是“ZCode 执行内核 + 行业扩展包 + 业务系统适配”，先验证一个明确任务。** 不建议一开始重写 Agent Loop，也不建议仅替换 System Prompt 就宣称完成行业化。

它已经具备模型调用、工具调度、权限交互、上下文压缩、会话恢复、MCP、Skill、Agent profile 和工作流实现。这些是行业 Agent 需要的共性能力。行业差异应集中在业务规则、知识证据、受控工具、结果契约及验收标准中。

但当前整体仍是以 coding/工作区为中心的完整产品，内部包均不能直接视为稳定的外部 SDK。面向团队或客户提供云服务时，租户身份、细粒度业务授权、领域数据权限、外部写操作幂等、审计和质量评测需要独立设计与验证。`workspaceIdentity`、工具 approval 和 conversation checkpoint 都不能替代这些能力。

这里的“可行”是架构和接缝可复用的判断；尚未验证独立部署、行业任务成功率、容量、故障恢复或运营成本，不能给出生产成熟度分数。

## 1. 哪些能力可以复用

| 能力 | 当前证据 | 行业化用途 | 边界 |
|---|---|---|---|
| 执行循环与输入串行 | [turn-loop.ts](../apps/zcode-cli/packages/core/src/runtime/methods/turn-loop.ts)、[command-inbox.ts](../apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/command-inbox.ts) | 多步调查、工具调用与输入幂等 | conversation command/turn 不等于业务流程状态 |
| 多模型协议 | [model-execution.ts](../apps/zcode-cli/packages/adapters/src/model/model-execution.ts)、[provider model runtime](../apps/zcode-cli/packages/bootstrap/src/app/provider-registry-model-runtime.ts) | 按场景选择模型、接入兼容服务 | 当前三种协议工厂；新 wire protocol 仍需 adapter 改造 |
| Context、摘要与结果预算 | [context/builder.ts](../apps/zcode-cli/packages/core/src/context/builder.ts)、[compact-active.ts](../apps/zcode-cli/packages/core/src/runtime/methods/compact-active.ts) | 长任务、行业指令、控制工具输出体积 | 对话摘要不能代替证据库存档或业务事实 |
| 工具契约与权限 | [tool/types.ts](../apps/zcode-cli/packages/core/src/tool/types.ts)、[call-runner.ts](../apps/zcode-cli/packages/core/src/tool/executor/call-runner.ts) | schema 校验、审批、超时、统一结果 | 原有权限不自动理解“可修改哪张工单/哪个组织” |
| MCP / Skill / Plugin | [MCP adapter](../apps/zcode-cli/packages/adapters/src/mcp/index.ts)、[Skill adapter](../apps/zcode-cli/packages/adapters/src/skills/index.ts)、[插件装配](../apps/zcode-cli/packages/bootstrap/src/app/startup-marks.ts) | 行业 API、操作规程、打包交付 | 插件不是任意 Core handler 的通用热注入机制；MCP hints 不授予业务权限 |
| Agent profile | [profile.ts](../apps/zcode-cli/packages/core/src/subagent/profile.ts) | 角色 Prompt、tools、MCP、memory、模型和 maxTurns | profile 是执行配置，不是租户、员工身份或业务审批者 |
| 持久化与恢复 | [SqliteSessionStore](../apps/zcode-cli/packages/adapters/src/storage/session-store/sqlite-session-store.ts)、[resume.ts](../apps/zcode-cli/packages/core/src/runtime/methods/resume.ts) | 会话连续性、过程回溯 | SQLite 会话恢复不能自动撤销或去重 ERP/CRM 写入 |
| 动态工作流 | [run service](../apps/zcode-cli/packages/bootstrap/src/app/dynamic-workflow-run-service.ts)、[journal](../apps/zcode-cli/packages/bootstrap/src/app/dynamic-workflow-run-journal.ts)、[replay](../apps/zcode-cli/packages/bootstrap/src/app/dynamic-workflow-run-replay.ts) | 角色分工、结构化提交、run 观察和恢复 | 已有 journal/replay，不应重复造通用引擎；不证明任意业务副作用具有 exactly-once |
| Memory | [extraction.ts](../apps/zcode-cli/packages/core/src/memory/extraction.ts)、[MemoryRuntimeConfig](../apps/zcode-cli/packages/core/src/runtime/types.ts) | 长期偏好、工作方式与复用经验 | 已有 extraction/scope，不能说完全没有记忆；行业事实仍应由知识/业务系统提供 |
| 多端投影 | [V4 transport](../packages/ui/src/v4/agentConversationTransport.ts)、[projection store](../packages/ui/src/v4/conversationProjectionStore.ts) | 保留桌面/Web/手机工作台 | ACK 是接纳；continuous/replayable、owner/lease 和 remote identity 必须保留 |

以上均为源码已确认，未声称它们已通过行业场景实测。详细控制流见 [Archify 分析](../archify/README.md)。

## 2. 适合和不适合直接承接的任务

| 目标 | 适配判断 | 前提 |
|---|---|---|
| 企业内部知识问答、材料整理、调查报告、研发/运维助手 | 适合作为首个试点 | 授权检索、来源引用、结构化结果与任务集评测 |
| 制造质量调查、售后工单分析、销售资料准备 | 适合做有人参与的助手 | 业务系统只读工具，规则校验，事实与推断分开 |
| 受控创建工单、提交业务申请、更新客户资料 | 可改造，但先建设操作与审批边界 | 对象级授权、预览、绑定批准、版本检查、业务幂等和结果对账 |
| 多客户共享的云端 Agent 平台 | 需要明显额外工程 | tenant/principal、隔离 worker、任务调度、数据/凭据隔离、容量与审计 |
| 无人监督地执行资金转移、设备控制或其他高后果动作 | 当前评估不支持直接交付 | 必须另做领域安全设计与实测；模型计划不充当最终控制规则 |

这里讨论系统适配范围，不提供具体行业的专业决策规则。领域尚未确定，因此不选数据库、向量库或模型品牌，也不估算未经测量的成本/工期。

## 3. 项目最值得改进的地方

优先级分为“所有路线都需要”与“达到相应部署目标才需要”，避免为了本地试点提前建设整套云平台。

| 顺序 | 改进 | 源码依据与影响 | 建议验收 |
|---|---|---|---|
| P0：所有路线 | 建立 Runtime/Provider/Tool 回归与行业 Eval | 当前提交仅四个 node:test，主要覆盖迁移/退役；没有确认完整 loop/stream/tool/E2E/Eval 套件 | 同一任务集能复现输入、工具结果、版本、错误、成本；恢复/取消边界有自动断言 |
| P0：行业接入 | 将领域规则放入确定性业务校验和工具边界 | 现有 executor 校验 schema/permission，profile/Skill 提供指令；这些不等于组织/对象级授权 | 伪造 tenant/object、提示注入和越权读写均被服务端拒绝，拒绝不依赖模型自律 |
| P0：存在写操作时 | 外部操作幂等、审批绑定和不确定结果对账 | file rewind 只覆盖有限文件修改，通用 handler 不保证外部副作用 rollback | 超时后查询操作结果；相同业务操作不重复提交；对象/参数变化使旧批准失效 |
| P0：共享云部署时 | 将 workspace 隔离补成身份/租户/资源授权与强执行隔离 | workspaceIdentity 是路由/隔离 key；默认 Node shell spawn 没有强 OS sandbox | 两租户相同 path 也不能读到对方数据/缓存/artifact/凭据；worker 越界请求失败 |
| P1 | 固定行业包及执行版本，建立受控发布/回滚 | 插件组件 startup 装配，内部 packages private；未证明独立 SDK 稳定性 | 每次 run pin prompt/skill/schema/policy/model 版本；配置升级不修改已开始的任务 |
| P1 | 稳定最小嵌入 facade，逐步降低 Bootstrap 与产品耦合 | createZCodeApp 依赖 Provider Registry；AppOptions 有 IO/Storage/MCP 注入，但 modelAdapter 是具体类型；CoreDeps 才有 registry/executor 注入 | 最小宿主仅通过公开入口完成 submit/resume/cancel/events/close；借用资源不重复 close |
| P1 | 建设授权知识检索、证据与数据生命周期 | 当前仓库搜索主要为文本/on-demand，不是行业知识治理；已有 memory 不能替代文档权限与版本 | 检索前 ACL、生效版本、出处、撤回/删除、权限变更后 cache 失效、证据不被 compact 丢失 |
| P1 | 统一任务成本、失败与业务效果的观测 | 已有 event/trace/usage、model admission 和套餐 quota；尚未确认租户/业务任务硬预算闭环 | 区分物理 attempt、Core recovery、工具、业务操作；预算达到时停止新动作并解释状态 |
| P2：压测后 | 优化持久化与 orchestration 复杂度 | DatabaseSync、庞大 Gateway/Host facade、双层恢复特例；是否造成实际瓶颈待测 | event-loop 延迟/锁等待/恢复时长的负载证据；按 owner/use case 拆分，保留公共契约 |
| P2：文件写入是核心时 | 加强文件 revision 与失败写入保证 | mtime/size revision，check 到 rename 有竞态，atomicWrite 有直接 truncate fallback | 并发修改/rename 失败/中断恢复用例明确“拒绝/成功/失败后文件状态”，不承诺不存在的 ACID |

**不建议把“更换 SQLite”“加向量库”“增加更多 Agent”当成第一步。** 应先确认目标场景的失败原因：检索质量、规则错误、工具可靠性、上下文还是模型能力；有指标之后再扩展。

## 4. 三种改造方式

| 路线 | 怎么做 | 收益 | 代价与适用范围 |
|---|---|---|---|
| A：行业扩展包，推荐起步 | profiles + Skills + MCP + 受控任务模板，保留现有 App/UI/运行时 | 改动面小，容易复用上游，不先改 loop | 主 Agent 行业入口和能力曝光仍需核对；高保证业务策略不能只写在 Skill；适合内部试点 |
| B：嵌入式行业运行时 | 定义宿主 facade，通过现有公开 Core/Bootstrap exports/ports 组合行业宿主 | 界面、凭据、业务数据和执行核可分工 | 当前不是已发布稳定 SDK；需要契约测试、配置/资源生命周期和行业 Tool 注册的显式接缝 |
| C：多租户服务平台 | 在 B 上增加控制面、执行池、tenant-aware storage/connector/policy/预算/审计 | 服务不同客户和多个行业 | 是平台建设；不能直接将 Desktop Host 或手机 attachment 当云 job scheduler |

**建议路线为 A → 场景验收 → 按需要 B → 有明确多客户需求时 C。** 若目标已明确就是多租户 SaaS，身份、授权、worker 和数据隔离需要从试点首日纳入，不能待平台阶段才补。

不建议为每个行业长期维护一份深度 fork，也不建议新增一层通用 Agent Loop 套在现有 Loop 外。行业包与宿主边界稳定后，再判断哪些产品能力可以按配置关闭、哪些可以拆出；拆包前须证明依赖闭包和兼容性，不能按“删除 80%”字面操作。

## 5. 推荐的首个验证场景

采用“制造质量调查与报告助手”作为**示例场景，不是已选定的产品需求**：读取授权的批次/检验记录和作业规程，按规则检查缺项，输出带出处的调查摘要与建议处理工单草稿；第一版不直接变更生产参数或提交工单。

这能同时验证知识检索、数据权限、结构化结果和人工交接，且把业务副作用限制在可审查草稿。后续才增加“经批准创建工单”，验证审批/版本/幂等/超时对账。没有证据时应明确缺失而非补造结论。

其他行业可以沿同一结构替换知识源、规则与工具；行业能力应由任务契约和评测体现，而不是 Agent 名称或 Prompt 长度。

## 6. 决策与下一步

建议采用 ZCode 作为候选执行基座，先批准一个有界行业试点，不提前宣称完成基座 SDK 或平台。下一步所需的产品决策是：具体业务任务、用户/部署边界、可访问数据、是否允许写操作、结果交付形式及验收任务集。

目标分层和关键状态规则见 [行业 Agent 设计](industry-agent-blueprint.md)，分阶段退出条件见 [实施与验收](implementation-roadmap.md)。本任务只交付评估与设计，没有启动改造。
