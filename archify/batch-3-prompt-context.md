# Batch 3 · Prompt 与 Context

基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。沿用 Batch 1 的依赖注入和 Batch 2 的普通 Agent Loop；本批只追模型输入，不修改实现。源码简称 C/A/B 分别为 `apps/zcode-cli/packages/core/src/`、`apps/zcode-cli/packages/adapters/src/`、`apps/zcode-cli/packages/bootstrap/src/`；其他路径相对仓库根，行号固定于该提交。

## Findings

**Confirmed：一次请求由 context prefix、活跃对话、运行时提醒和独立 tools 参数组成。** `ContextBuilder.build()` 生成 system messages 和 meta-user attachments；`runRegularTurnLoop()` 每步从 turn-local entries 投影 messages，并取得本步工具；`runModelTextRequest()` 再处理媒体后，构造 `{ messages, tools, abortSignal, options?: { maxOutputTokens } }`。工具说明不是整段复制到 system prompt，`setToolRegistry()` 是兼容性 no-op。证据：`C/context/builder.ts:51,87,234`、`C/runtime/methods/turn-loop.ts:109,172,205`、`C/runtime/methods/model.ts:49–125`。

**Confirmed：内部没有单独 developer role。** `ModelInputMessage` 的角色是 `system | user | assistant | tool`；仓库指令、技能清单、日期等通过有来源标记的 attachment 进入历史，provider 投影时包装为 user reminder，部分中途提醒可按模型能力变成合法位置的 system。不能把 meta-user 误认为真实用户，也不能据此推断最终 API 没有 provider 自己的 system 字段。证据：`C/agent/message-history.ts:27`、`C/runtime/helpers/provider-request-messages.ts:48,184`、`C/runtime/helpers/provider-mid-conversation-system.ts:41`。

**Confirmed：Context 管理属于 Hybrid。** 普通步骤保留当前活跃历史；可选 microcompact 清理旧工具内容；auto/manual/reactive compact 用模型摘要替换历史主体，Auto/Reactive 可保留最近完整 assistant-started round；摘要请求过大还有按轮次删减重试。它不是固定长度的全局 sliding window，也不是每步重读全仓库。证据：`C/compact/microcompact.ts:83`、`C/compact/policy.ts:100`、`C/runtime/helpers/compact-selection.ts:30,167,209`、`C/runtime/methods/compact-active.ts:484–625`。

## Key Source Files

源码简称沿用文首定义：

| 文件与定位 | 实际职责 |
|---|---|
| `A/context/index.ts:36,102,225` | Node 环境探测、用户与工作区 AGENTS.md 读取、snapshot |
| `C/runtime/methods/context.ts:31,96,147,168` | 延迟初始化 Context，技能 discovery、项目 memory root/index |
| `C/context/builder.ts:87,230,279,310` | system/meta-user 分组、排序与拼装 |
| `C/context/sections/request-user-context.ts:37,62` | instructions 与 MEMORY.md 的 meta-user 内容 |
| `C/context/sections/skills.ts:43` | 技能 metadata 清单；不加载所有技能正文 |
| `C/subagent/context-builder.ts:46,106` | 子 Agent 独立 prompt 组装 |
| `C/memory/index-content.ts:8,13` | memory index 清洗和限长 |
| `C/runtime/helpers/provider-request-messages.ts:48` | reminder 重排、MCS 投影、cache marker、剥离 metadata |
| `C/runtime/methods/model.ts:36` | 最后媒体投影与 ModelRequest |
| `C/runtime/helpers/media-budget.ts:75` | 请求媒体预算与真实用户附件保护 |
| `C/compact/policy.ts:74,82,92,100` | compact 阈值、usage/estimate 决策、失败熔断 |
| `C/runtime/methods/compact-active.ts:75,251,484,617` | 摘要模型请求、持久化 boundary、替换活跃历史 |
| `C/runtime/helpers/compact.ts:72` | prefix + summary + preserved tail + reminders |
| `C/tool/executor/result-serialization.ts:46` | 工具内容的模型预算、artifact 与截断 |

## Key Classes / Functions

- **Confirmed：** `NodeContextSourceAdapter.resolveContextSources()` 返回 snapshot，而非直接修改 history。`ensureContextInitialized()` 在首次使用时读取 snapshot、技能和 memory，再 `initializeMessageHistoryFromContext()`；已有初始化会短路。
- **Confirmed：** `ContextBuilder` 是输入构建器；`MessageHistoryImpl` 是 canonical entries 的所有者；当前 turn 的 request state 由 Loop 持有。投影和媒体裁剪产生请求视图，不把 provider 的序列化形态回写 canonical history。
- **Confirmed：** `buildRuntimeProviderRequestMessages()` 按当前模型的 `supportsMidConversationSystem` 或 force 配置选择 MCS；`buildProviderRequestMessages()` 同时返回仅供内部归属追踪的 `sourceEntries`，它们不是 API payload。
- **Confirmed：** `autoCompactIfNeeded()` 从 provider usage 加新增输入估计得到 token override；缺可用 usage 时使用估算。`compactActiveConversation()` 调用同一 Model 抽象完成摘要并提交新历史。

## Control Flow

### Prompt 构造调用链

```text
executeTurnInternal() / ensureContextInitialized()
  → ContextSourcePort.resolveContextSources()
  → discoverSkillsForContext() / loadProjectMemoryRoot() / loadProjectMemoryIndexContent()
  → createContextBuilderFromSnapshot() → ContextBuilder.build()
  → buildContextHistoryEntries() → MessageHistory.initialize()
runRegularTurnLoop()
  → drain commands / microcompact / autoCompact / initializeMcp
  → getTools(currentModel) / mode、plan、todo、output-style reminders
  → buildRuntimeProviderRequestMessages(turnRequestState.entries)
  → runRegularTurnModelStep() → runModelTextRequest()
  → media attachment paths → input capability → media budget
  → Model.generateText() 或 Model.streamText()
```

**Confirmed：** 普通 Loop 每步的 reminder 和 compact 顺序沿用 Batch 2；不要将全部输入描述为启动时一次性静态 system。冻结的本轮 model selection 也控制 capabilities 与输出预算。

### 默认主 Agent 的 Prompt 顺序

`ContextBuilder.build():87–214` 与 `orderSectionsForInjection():310`：

1. CLI prefix 单独 system block。
2. 稳定 system body：显式 custom system prompt、workflow actor identity、默认 identity 三选一。
3. 动态 system body：默认非 custom 情况下的 desktop surface、行为规则、实际工具可用性的 session guidance、memory 使用指导、env/model 信息、output style、context management 和 Git snapshot；workflow 路径跳过前几项普通 Agent 指导。
4. `skills_listing` meta-user attachment（存在技能且 Skill tool 可用时）。
5. `context_prefix` meta-user attachment：用户/工作区指令、memory index、日期以及其他 meta-user sections。
6. 后续真实 user、assistant、tool 和按因果位置加入的运行时提醒。

**Confirmed：** custom system prompt 会抑制上述默认动态 system 段，但代码后续仍可生成技能、指令和日期的 meta-user 段；不能把 custom 解释为“替换整个请求”。custom 与 workflow actor 同时设置会报错。自定义 sections 仍通过 stable/dynamic + system/meta-user 排序进入请求。

**Confirmed：** 子 Agent 走 `SubagentContextBuilder.build()`：CLI prefix → 非空 agentPrompt → common notes → environment 的独立 system 段，再 instructions/date/skills meta-user。其 persona 不是把主 Agent 的全部 system prompt 原样复制。

## Data Flow

### Final Model Context Composition

**Confirmed：一个普通模型请求真正包含：**

| 来源 | 进入内部上下文的形态 | 请求时的实际处理 |
|---|---|---|
| 内置 identity、行为规则、env/model/output-style | system message blocks | 保留 system，并携带内部 cacheControl 意图；adapter 后续映射到具体 API |
| 用户默认与工作区 AGENTS.md | `context_prefix` attachment | 转为 `<system-reminder>` 包装的 user 内容 |
| 技能目录 | `skills_listing` attachment | 名称、描述、路径；执行 Skill 工具后正文才作为工具结果进入后续请求 |
| 项目 memory | guidance + MEMORY.md index | 默认不读取全部 topic files；更多内容通过文件工具访问 |
| 当前及历史真实用户输入 | user text/media blocks | incoming presentation、媒体路径解析、能力降级与媒体预算 |
| 历史模型输出 | assistant content / reasoning blocks / toolCalls | 由统一 Model 消息结构承载，provider adapter 再转换 |
| 工具执行输出 | 与 toolCallId 对应的 tool message | 已经过 output serializer、预算或 artifact preview，随后可能 microcompact |
| plan/todo/mode/hooks/goal 等动态提醒 | 有 source metadata 的 attachment | 因果位置重排；符合条件才投影为 MCS，避免插在同一组 tool results 中间 |
| compact summary | legacy-synthetic user entry | prefix + summary + 最近保留轮次 + plan/read-state reminders |
| 本步工具定义 | 独立 `tools` 参数 | schema、description；不是复制整个实现代码 |
| 调用控制 | abortSignal、maxOutputTokens、invocation context | tracing/admission/retry/status 属于控制面，不作为用户提示正文 |

消息投影只在请求副本上操作：incoming presentation → attachment bubbling → 可选 MCS → legacy reminder 位置修正 → 包装/clone → cache marker。`ENABLE_MCS_ADJACENT_USER_MERGE = false`，相邻 user 合并交给需要它的 provider adapter；不要误读尚保留的 helper 为启用行为。

### 指令、仓库内容与 memory 的边界

**Confirmed：** Node adapter 默认 priority file 只有 `AGENTS.md`，每份默认最多 `100 * 1024` 字节；先读取 `~/.zcode/AGENTS.md`，再从 cwd 向上找至 project root 的**第一个**工作区指令文件，去重后合并为 user scope + workspace scope。这里不是把所有祖先 AGENTS.md 累加，也没有默认 `.cursorrules` 等任意规则文件扫描。调用必须提供 userInstructions options 才启用该读取分支。

**Confirmed：** snapshot 可探测 package scripts/project type，但当前 `ContextBuilder.build()` 没有消费传入的 `projectContext` 字段，不能声称它自动注入项目源码或脚本清单。env 的 Git 信息来自 snapshot，不是完整 repo map。文件内容主要经 Read/Grep/Glob/Shell 等工具结果进入对话；附件经 input facade 和媒体消息进入。仓库理解的具体算法留 Batch 6。

**Confirmed：** memory index 去除开头 frontmatter 和 Markdown lexer 识别的顶层 HTML comments，正文最多 200 行、25,000 JS 字符并附部分加载提示。技能 metadata 默认预算为 20,000 **字符**，不是 token；超预算退化成名称/路径清单，并非绝对硬上限（`C/memory/index-content.ts:3–35`、`C/context/sections/skills.ts:8–66`）。

### Context Management Strategy 与超限

**Confirmed：** microcompact 在 runtime 仅 `compact.microcompact.enabled === true` 时启用；默认保留最近 5 个可压缩工具结果**组**，按 assistant tool-call 轮次分组。触发是 token pressure 或超过 60 分钟 idle；默认最少节省 256 estimated tokens。旧内容换为 `[Old tool result content cleared]`，保留 toolCallId；默认不清错误结果和 image/video/file 媒体结果。阈值为 `min(0.9 * fullThreshold, fullThreshold - 2000)`，下界 0。

**Confirmed：** auto compact 默认阈值：`contextWindow - min(model maxOutputTokens 或 32000, 21000) - 13000`，下界 0；未知窗口 fallback 200,000。实际代码统一此公式，未使用配置中的旧 `thresholdPercentOverride` 改变阈值，不能照字段名推断。需要至少两轮且含 assistant；默认连续失败 3 次熔断，另有 rapid-refill 防护。token 估算包括 assistant.toolCalls 的名称与入参，而非只估文本（`C/compact/manual.ts:69,102`）。

**Confirmed：** 正常请求 output budget 使用模型声明的最大输出，未知时 fallback 32,000；当窗口和使用量可估时再限制到 `contextWindow - estimatedUsage - 1000`，可用值非正时保留 baseline 让 provider/overflow 路径处理。32K 不是所有模型的全局硬 cap（`C/runtime/methods/model-token-limits.ts:7,18`）。

**Confirmed：** full compact 生成摘要而非简单截断原文；Auto/Reactive 默认保留最近一组完整 round（有多组时），Manual 不走同一默认 tail 保留规则。摘要请求若太长，调整 summary/tail 分配或删减更老完整轮次，重试边界为 3。summary output 上限 `min(model effective max, 20000)`；工具数 >100 时摘要请求 tools 为空。成功后持久化 summary/boundary，再替换 canonical history、同步 turn entries、清 readFileState，重建必要提醒；持久化边界不等于物理删除所有会话历史。

**Confirmed：** 工具结果不会保证全文全部进入模型。通用 output serializer 默认 `maxInlineBytes = maxModelBytes = 100000`，可由工具覆盖，超量截断或持久化 artifact 并返回预览/路径。CUA 的结构化图像/引用原子对有专门保护，不应套用纯文本截断结论。模型请求另有默认 40 MiB 媒体预算：保护最新真实 user 附件，历史媒体从新到旧选择；受保护附件单独超过预算直接返回可恢复 InvalidInput，不静默删当前附件（`C/tool/executor/result-serialization.ts:33–215`、`C/runtime/helpers/media-budget.ts:75–149`）。

## Important Design Decisions

- **Confirmed：** Context 的来源标记与真实 user 身份由结构承载，不能按文本里是否出现 `<system-reminder>` 识别；literal 标签经过统一转义。
- **Confirmed：** 缓存意图与历史归属分开。prefix 的 stable/dynamic 分块避免一次动态变化破坏所有稳定内容；provider-specific cache 行为必须继续由 adapter 验证。
- **Confirmed：** tools、messages、输出预算相互配合，但摘要不是任意工具执行轮次；大规模工具 schema 在摘要链路可以省略。
- **Inference：** 活跃 history、持久化 history 与 provider payload 分离，有利于恢复、UI 展示和 provider 兼容，但也要求 compact/媒体投影持续维护 source 与 tool pairing；这是从调用边界得出的设计解释。

## Unknowns

- **Need Verification：** 没有调用真实模型，无法证明某 provider 实际缓存命中、真实 tokenizer 误差、摘要质量或各媒体模型的服务端接受度。
- **Need Verification：** compact 的故障注入、恢复后 UI replay 等执行语义复用源码证据，端到端状态保存留 Batch 9/13 深入。
- **Unknown：** 不存在据本批证据可宣称的“自动全仓库语义检索并注入所有相关源码”；Batch 6 需独立查实际检索能力。

## Archify Diagram

- [图 3A · Prompt Composition Data Flow](diagrams/03a-prompt/prompt.html)：指令/技能/memory 与 system body 的两条注入路径。
- [图 3B · Context Lifecycle](diagrams/03b-context/context.html)：活跃历史、预算决策、可选清理、摘要、替换和再次请求；这是源码流程抽象，并非新增状态枚举。
- [图 3C · Model Context Data Flow](diagrams/03c-model-context/model-context.html)：canonical/turn-local entries 到 provider-neutral request 的投影边界。

规格和四道自动验收 receipts 保存在各图目录；验收与视觉审查的区别见 [validation.md](validation.md)。

## Next Batch Dependencies

Batch 4 接续 `ModelRequest.messages/tools/options`：确认统一 Model 接口、实际 provider factories、schema/message 转换、reasoning/streaming 与 retry/admission。Batch 5 接续已确认的工具结果预算，追 registry 注册、权限与 handler、MCP 和 native 的统一执行边界。
