# Batch 4 · Model / Provider

基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。承接 Batch 3 已确认的 provider-neutral `ModelRequest`，只分析当前仓库实现。简称 C/A/B 分别为 `apps/zcode-cli/packages/core/src/`、`apps/zcode-cli/packages/adapters/src/`、`apps/zcode-cli/packages/bootstrap/src/`；下列完整相对路径可以在固定 revision 上定位。

## Findings

**Confirmed：业务 Provider Registry 与模型执行 Adapter 是两个边界。** `packages/provider` 负责配置 overlay、模型能力、选择合法性；`ApiProviderModelRuntime.modelFactory` 查一次完整 provider/model 事实后创建 Model；`AiSdkModelAdapter` 将 Model 请求接入 runner。Core 的统一接口是 `bind()`、`generateText()`、`streamText()`，不依赖具体 SDK 类。证据：`packages/provider/src/registry.ts:74`、`B/app/provider-registry-model-runtime.ts:34,45,65`、`apps/zcode-cli/packages/contracts/src/model/model.ts:31,46`。

**Confirmed：当前执行层只有三个协议 factory。** `AiSdkModelExecution.createFactory()` 实际实例化 `createOpenAI().responses`、`createAnthropic()`、`createOpenAICompatible()`。`toAiSdkProviderConfig()` 把 `openai-responses / anthropic-messages / openai-chat-completions` 映射到这三种 kind。没有独立 Gemini SDK、Ollama SDK 或 OpenRouter SDK factory。证据：`A/model/model-execution.ts:282–315,344–371`。

**Confirmed：reasoning 与 max-output 的最终请求字段由 option maps 写入。** 不是 runner 针对每个供应商硬编码 effort/budget 分支；模型配置声明档位和 map，创建 Model 时编译，每次 SDK 序列化后在 fetch 包装层应用有序 JSON merge patches。SDK 自己的 retry 被设为 0，由 ZCode runner 管理尝试、admission 与 retry boundary。证据：`packages/model-option-map/src/option-maps.ts:27`、`A/model/model-option-map-fetch.ts:13`、`A/model/runner-options.ts:92,150`。

## Key Source Files

| 文件与定位 | 职责 |
|---|---|
| `apps/zcode-cli/packages/contracts/src/model/model.ts:31,46` | ModelRequest / Model 的公共契约 |
| `packages/shared/src/model-config.ts:60,77,100` | 输入格式、context/capabilities、optionSpecs 的严格数据 schema |
| `packages/provider/src/resolver.ts:183` | builtin/personal 等配置合成为有效 Provider 与 Model |
| `packages/provider/src/registry.ts:74,129` | selection、options 的一致校验 |
| `packages/provider/src/config-service.ts:223,322,449` | 新 personal provider/model 的写入边界 |
| `config/provider/zcode-builtin.json:4,334,418,892` | 本地 builtin templates 与 model rules，不代表用户当前启用列表 |
| `B/app/provider-registry-model-runtime.ts:45,65` | 冻结模型配置的 factory；账号 auth source 注入 |
| `C/runtime/methods/runtime-model.ts:14` | invocation/retry budget/admission 绑定 |
| `A/model/model.ts:40,91,125,177` | ExecutableModel、选项校验、请求能力拒绝 |
| `A/model/runner.ts:138,155,258` | Model executor 到 generate/stream runners |
| `A/model/model-execution.ts:181,249,282,344` | 静态配置快照、请求鉴权、SDK factory |
| `A/model/transform.ts:46` | 内部 message 到 AI SDK ModelMessage |
| `A/model/tool-transform.ts:24,91,244` | ToolContract 到 SDK tools、strict/native 分支 |
| `A/model/runner-options.ts:36,102` | messages/tools/options/headers 装配 |
| `A/model/runner-generate.ts:200,218` | 完整结果归一化与重试 |
| `A/model/runner-stream.ts:123,240,289,1455` | 流读取、尝试准入、retry boundary |
| `A/model/runner-normalization.ts:17,42,62,176` | usage/reasoning/events/tool calls 的统一输出 |
| `A/model/streaming-tool-call-assembler.ts:10,24` | 按 ID 整理流事件，执行只用 final tool-call |
| `A/model/failure-classifier.ts:81,183,218,247` | rate-limit、overflow、网络与业务错误分类 |

## Key Classes / Functions

### Model Abstraction / Provider Interface

**Confirmed：** `Model` 包含 providerId/modelId、properties、optionSpecs、options；`bind(options)` 返回使用同一 executor 的新不可变句柄（无更新则返回自身）。`ExecutableModel.prepareRequest()` 合并 bound 与 per-request options，要求正整数 maxOutputTokens 不超过模型上限、reasoningLevel 在公开档位内，并验证 tools/JSON schema/媒体能力。

`ModelRequest = { messages, tools?, responseJsonSchema?, options?, abortSignal? }`。普通 Agent step 使用 messages/tools/maxOutputTokens；`responseJsonSchema` 是统一接口提供给需要结构化输出的其他调用方的能力，不能说每个普通 step 都启用 JSON 输出。runner 内部 legacy options 中仍有 temperature/toolChoice 等字段，不表示当前公共 ModelOptions 已暴露它们。

**Confirmed：** `ApiProviderModelRuntime.start()` 只是允许 factory 工作；它不是为每个 Provider 启一个后台模型进程。`modelFactory()` 校验 selection、读取有效 provider/model，再 `createModel()`。endpoint、协议、providerOptions 和能力在创建时固定，后续 registry 更新不会悄悄改已有句柄；请求鉴权允许按 attempt 刷新 API key/header，且必须保持绑定的 provider/model。

### Provider Implementations

| 当前协议 | 实际执行实现 | 仓库内配置实例 |
|---|---|---|
| `openai-responses` | `createOpenAI(...).responses` | openai、xai、部分 opencode templates |
| `anthropic-messages` | `createAnthropic(...)` + compat fetch | anthropic、zai/bigmodel API、kimi、minimax、deepseek、部分 qwen/xiaomi、当前 openrouter template |
| `openai-chat-completions` | `createOpenAICompatible(...)` | zai/bigmodel standard API、部分 qwen、opencode chat |

**Confirmed：** 上表是本地 builtin template 配置，来自 `config/provider/zcode-builtin.json` 的 `config.providerConfigRules.templateRules`（20 条），不是“所有模板都已创建、启用、鉴权可用”。账号 provider rules 另含 zai/bigmodel 的 individual/team coding plan、start plan 与 offpeak idle plan。Registry 会合成当前有效配置；具体在线目录与账号权益不能仅由静态 JSON 得出。

**Inference：** 一个服务只要兼容现有协议，可配置成 personal provider；例如本地兼容服务并不需要新增 SDK factory。**Need Verification：** 当前配置没有 Ollama/Gemini 原生协议工厂；不能由“兼容接口存在”证明任意服务或模型已经经过兼容测试。

## Control Flow

### LLM Request Call Chain

```text
createTurnModel() → createRuntimeModel()
  → ApiProviderModelRuntime.modelFactory(selection)
  → Registry.validateSelection / getProvider / getModel
  → AiSdkModelAdapter.createModel()
  → AiSdkModelExecution.bindModel()（capture snapshot + compile option maps）
runModelTextRequest()
  → runWithModelInvocationContext(...)
  → ExecutableModel.generateText()/streamText() → prepareRequest()
  → runner executor → generateTextWithResolved / streamTextWithResolved
  → 每次 attempt: admitAttempt() → resolveModelForAttempt()（可刷新 auth）
  → createGenerateTextOptions / createStreamTextOptions
  → toAiSdkMessages / toAiSdkTools
  → AI SDK generateText / streamText → configured factory
  → compat fetch → option map body patch → provider transport
  → 结果/事件归一化 → core model step
  → finally release admission；重试前也先 release
```

**Confirmed：** stream 正常顺序是先 admission，再 resolve 本次 model/auth，再构造 SDK options（`A/model/runner-stream.ts:240,279,289`）；图中展示这条主路径，非流式同样拥有独立尝试边界。SDK 不负责普通 Agent 的反复 tool loop，该循环属于 Batch 2 的 Core。

### Retry / Rate Limit

复用 Batch 2 的 retry budget 证据，补充 adapter 判定：

- **Confirmed：** 默认最多 10 retries / 11 attempts，2 秒指数退避、factor 2、最大 60 秒、有 jitter；请求/环境配置可覆盖。429、529、5xx、可识别 timeout/network/proxy 为可重试类型，并解析 Retry-After；401/403、普通 400/422、TLS 验证失败、取消通常不重试。账号/套餐业务码先分类，不能只按 HTTP status 判断。
- **Confirmed：** context-exceeded 是不可由 adapter 原样请求自动重试的错误，Core 负责 reactive compact 后生成新的模型请求。
- **Confirmed：** streaming 一旦跨越可见输出 retry boundary，adapter 不重放；交给 Core 的部分响应恢复与 tool-safe commit。`canRetryStreamFailure():1455–1498` 还限制 compact SSE response-body failure 的重放。
- **Confirmed：** workflow_child/nestedworkflow 的 unbounded retry budget 不等于永远重试：确定性模型错误和取消仍终止；普通请求使用 bounded budget。admission ticket 只覆盖物理 in-flight attempt，退避不占槽。
- **Need Verification：** 这些来自源码，没有实际触发 429、服务端中断或账号刷新。

## Data Flow

### Message Conversion

**Confirmed：** `toAiSdkMessages():46–155` 将内部角色映射为 AI SDK 的标准 `ModelMessage`，再由安装的协议 SDK 承担最终 HTTP wire 序列化。本仓库没有一套自行实现的 Gemini function-call converter。

| 内部数据 | Adapter 转换 |
|---|---|
| system content | 文本 system；OpenAI-compatible 将连续开头 system 按原顺序合为一条，不补空白 |
| user blocks | 文本/图像/文件/视频按输入能力和 provider policy 转换；不是仅字符串 |
| assistant content + toolCalls | assistant content parts + `tool-call`，保留 ID 与 input |
| reasoning block | reasoning text 与 providerOptions；按 Responses replay 条件去掉不能重放的 stored item 引用 |
| tool message | 必须有 toolCallId/toolName；转 `tool-result`，失败用 `error-text` |
| 结构化 tool media | 对需要 textify 的协议或含 video 的结果，工具文本与后置 user media 分开；CUA frame/ref 不可投递时整体错误化 |
| cacheControl | 转成 `providerOptions.anthropic.cacheControl`，不是跨所有 Provider 通用缓存承诺 |

Responses stored reasoning 的过滤是有条件的：providerKind=openai、apiFormat=openai-responses，且没有 previousResponseId/conversation、也不是 store=false（`A/model/transform.ts:335`）。不应说所有 reasoning 永久删除，也不应把 providerOptions 当成推理正文。

### Tool Calling Conversion

**Confirmed：** `toAiSdkTools()` 用 contract.name 建 ToolSet，`description + jsonSchema(inputSchema)` 组成客户端工具定义；只有提供 contract.execute 时才挂 SDK execute callback。普通 Runtime 的 Registry contracts 不借 SDK callback 绕过 Core executor。MFJS 模型需要本地 `$ref` hoist 到 `$defs`；strict 只在 contract 声明、Anthropic kind、首方模型资格和 schema 可表达都满足时启用，否则保留普通 schema。

**Confirmed：** provider-native WebSearch 是独立分支：当前仅 Anthropic 且 model capability 允许时编码为 `anthropic.tools.webSearch_20260209`，默认 maxUses=8，可带域名限制。结果带 providerExecuted，不再由本地 executor 重复执行。其他 kind 请求这个 native contract 会报 InvalidModelRequest；“SDK 支持更多内建工具”不等于本项目实例化了它们（`A/model/tool-transform.ts:244–282`）。

### Streaming / Reasoning / Capabilities

**Confirmed：** `toModelStreamEvent()` 输出 `text_start/delta/end`、`reasoning_start/delta/end`、`tool_input_start/delta/end`、`tool_call`、`finish`、`error`。reasoning 事件携带 providerMetadata；finish usage 统一 input/output/cache-read/cache-write/reasoning token 字段，并可包含 server web-search/fetch usage。`StreamingToolCallAssembler` 按 ID 去重，用 SDK **final tool-call input** 归一化；增量 tool-input 用于展示，不拼出提前执行参数。读取流中断、空 completion、SDK raw boundary 的特殊处理仍由 runner/Core 各自负责。

**Confirmed：** 统一公开选项只有 reasoningLevel、maxOutputTokens；builtins 的 maps 可生成 `reasoning.effort`、`reasoning_effort`、`thinking.type`、`output_config.effort`、`enable_thinking` 等不同形态。例如本地 JSON `3149,3160,3204,3248` 行有这些 mapping。当前没有统一 thinkingBudget/budgetTokens 选项，也未在所查 builtin maps 中发现 `budget_tokens`；不能报告一个不存在的全局 thinking token budget。

**Confirmed：** `ModelProperties` 声明 contextWindow、supportsToolCall、supportsJsonSchemaOutput、supportsNativeWebSearch、supportsMidConversationSystem、requiresMfjsToolSchema，以及 text/image/video/audio/pdf 输入格式；输出格式当前是文本支持。`optionSpecs` 声明有效 reasoning 档位、最大输出和各自 map。声明是 Registry 配置事实，ExecutableModel 会拒绝不合法请求；实际服务端支持还需运行验证。OpenAI-compatible factory 的 supportsStructuredOutputs 来自冻结能力，includeUsage=true。

## Important Design Decisions

- **Confirmed：** Registry 使用同一数据 schema 处理 UI/config 与 CLI Model 输入，减少能力定义漂移；Core 依赖 Model/ports，不直接查实时配置切换已开始的请求。
- **Confirmed：** Model 快照与 per-attempt auth 分开，允许刷新 credentials，又不静默改变 endpoint/protocol。
- **Confirmed：** Option maps 是最终 body 字段权威；遇到非 JSON 文本 body 会 fail closed，不能静默漏掉 reasoning/output 限制。
- **Confirmed：** API retry 与已输出后的 Core recovery 分开；避免在工具可能执行后原样重放导致副作用重复。
- **Inference：** 同协议 Provider 的新增成本集中在配置与 capability/rule，而新协议成本集中在 adapter 契约，反映项目以协议而非品牌划分执行实现。

### 增加 Provider 的具体入口

1. **Confirmed：复用现有协议。** 从 `packages/provider/src/config-service.ts:createPersonalProvider():223`、`addPersonalModel():322` / `savePersonalModelDraft():449` 创建 personal 配置；补齐 api type/baseURL/access、model properties 和 option maps，通过 registry selection 校验。作为内置模板则修改 `config/provider/zcode-builtin.json` 的规则和模板，不能只加品牌名。
2. **Inference：引入新 wire protocol。** 先更新 spec 和 `provider-data-schema.ts` 的 api type 契约，再扩展 `toAiSdkProviderConfig()` / `createFactory()`；增加依赖和 message/tool/media/structured-output/stream 归一化。仅 UI 新增选项不会使 runtime 支持新协议。
3. **Need Verification：** 新实现应验证 auth/headers、实际 option-map body、tool pairing、reasoning replay、usage、取消与 retry boundary，以及普通 step 和 compact 两类请求。当前未执行这些新 Provider 验收，本批没有添加 Provider。

## Unknowns

- **Need Verification：** 当前无 node_modules；最终 SDK 内部具体 wire serialization 未读取安装源码，也没有抓真实 HTTP。已确认的是本仓库调用参数、factory 和 fetch 包装，不据此伪造最终网络 payload。
- **Need Verification：** 在线 builtin 目录、用户 personal overlays、账号 entitlement 和 endpoint 可用性是运行时事实，本地默认 JSON 不足以确认。
- **Unknown：** 原生 Gemini/Ollama 专属执行 adapter 在本批实际 factory 中不存在；兼容配置可用性需另验。

## Archify Diagram

- [图 4A · Model Provider Architecture](diagrams/04a-provider/provider.html)：Registry → factory → Model/runner → 三种协议实例。
- [图 4B · LLM Request Sequence](diagrams/04b-request/request.html)：attempt admission、auth、SDK、body patch、归一化与释放。
- [图 4C · Provider Adapter Data Flow](diagrams/04c-adapter/adapter.html)：messages/tools 到 SDK 请求、option-map patch 与响应事件。

各图目录保留 candidate 和验收 receipts；见 [validation.md](validation.md)。

## Next Batch Dependencies

Batch 5 从 `ModelToolContract`、final tool_call、providerExecuted 与工具结果序列化继续；验证实际 registry 注册来源、动态 MCP 集成、permission/hooks、并发调度和失败反馈，复用 Batch 2 的 while 与 streaming tool 安全边界。
