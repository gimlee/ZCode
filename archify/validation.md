# 验证记录

验证日期：2026-10-03（Asia/Shanghai）；源码 revision：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。

## 环境与实际仓库检查

开工已执行 `node scripts/check-workspace-freshness.mjs` 并通过，main 与远端同步。mise.toml 指定 Node 24.14.0 / pnpm 10.33.2；实际 Node 24.21.0，Corepack pnpm 10.33.2。当前 node_modules 缺失。无应用代码或产品行为/spec 改动，保留原有 promt/ 和旧 .archify/。

| 命令 | 实际执行 | 真实结果 | 原始输出 |
|---|---|---|---|
| pnpm typecheck | corepack pnpm typecheck | exit 1；tsc 不可用、node_modules missing | [output](evidence/remaining-typecheck.txt) |
| pnpm lint | corepack pnpm lint | exit 1；oxlint 不可用、node_modules missing | [output](evidence/remaining-lint.txt) |

未得到实际 TypeScript/Lint 诊断，不声称项目检查通过。本轮没有安装依赖或修改实现来处理环境。未执行项目 unit/E2E；未启动真实 Provider/MCP/Electron/手机链路。当前测试文件与 scripts 清单见 [inventory](evidence/testing-inventory.json)。

## Archify 自动验收

使用 Archify 3.0.1 finalize showcase，所有 35 张图（此前 15，本轮新增 20）最终均通过 validate、deliver、strict check、真实 Chrome browser-check，diagnostics = 0。当前规格/HTML SHA-256 与 successful receipts 一致，browser evidence 绑定相同 HTML hash。[机器索引](evidence/artifacts.json) 记录所有 current receipts；review 子目录中的当前证据优先于旧默认 receipt。

| 图 | type | spec / 当前 receipt | Browser evidence |
|---|---|---|---|
| [图 0 · ZCode Initial Repository Map](diagrams/00-repository/repository.html) | architecture | [JSON](diagrams/00-repository/candidate.json) / [summary](diagrams/00-repository/repository.finalize-summary.json) | [browser](diagrams/00-repository/repository.browser-check.json) |
| [图 1A · Startup Lifecycle](diagrams/01a-startup/startup.html) | lifecycle | [JSON](diagrams/01a-startup/candidate.json) / [summary](diagrams/01a-startup/startup.finalize-summary.json) | [browser](diagrams/01a-startup/startup.browser-check.json) |
| [图 1B · Runtime Architecture](diagrams/01b-runtime/runtime.html) | architecture | [JSON](diagrams/01b-runtime/candidate.json) / [summary](diagrams/01b-runtime/runtime.finalize-summary.json) | [browser](diagrams/01b-runtime/runtime.browser-check.json) |
| [图 2A · Agent Runtime Workflow](diagrams/02a-workflow/workflow.html) | workflow | [JSON](diagrams/02a-workflow/candidate.json) / [summary](diagrams/02a-workflow/workflow.finalize-summary.json) | [browser](diagrams/02a-workflow/workflow.browser-check.json) |
| [图 2B · Agent Loop Lifecycle](diagrams/02b-loop/loop.html) | lifecycle | [JSON](diagrams/02b-loop/candidate.json) / [summary](diagrams/02b-loop/loop.finalize-summary.json) | [browser](diagrams/02b-loop/loop.browser-check.json) |
| [图 2C · Agent Loop State Machine](diagrams/02c-state/state.html) | lifecycle | [JSON](diagrams/02c-state/candidate.json) / [summary](diagrams/02c-state/state.finalize-summary.json) | [browser](diagrams/02c-state/state.browser-check.json) |
| [图 3A · Prompt Composition](diagrams/03a-prompt/prompt.html) | dataflow | [JSON](diagrams/03a-prompt/candidate.json) / [summary](diagrams/03a-prompt/prompt.finalize-summary.json) | [browser](diagrams/03a-prompt/prompt.browser-check.json) |
| [图 3B · Context Lifecycle](diagrams/03b-context/context.html) | lifecycle | [JSON](diagrams/03b-context/candidate.json) / [summary](diagrams/03b-context/context.finalize-summary.json) | [browser](diagrams/03b-context/context.browser-check.json) |
| [图 3C · Model Context Data Flow](diagrams/03c-model-context/model-context.html) | dataflow | [JSON](diagrams/03c-model-context/candidate.json) / [summary](diagrams/03c-model-context/model-context.finalize-summary.json) | [browser](diagrams/03c-model-context/model-context.browser-check.json) |
| [图 4A · Model Provider Architecture](diagrams/04a-provider/provider.html) | architecture | [JSON](diagrams/04a-provider/candidate.json) / [summary](diagrams/04a-provider/provider.finalize-summary.json) | [browser](diagrams/04a-provider/provider.browser-check.json) |
| [图 4B · LLM Request Sequence](diagrams/04b-request/request.html) | sequence | [JSON](diagrams/04b-request/candidate.json) / [summary](diagrams/04b-request/request.finalize-summary.json) | [browser](diagrams/04b-request/request.browser-check.json) |
| [图 4C · Provider Adapter Data Flow](diagrams/04c-adapter/adapter.html) | dataflow | [JSON](diagrams/04c-adapter/candidate.json) / [summary](diagrams/04c-adapter/adapter.finalize-summary.json) | [browser](diagrams/04c-adapter/adapter.browser-check.json) |
| [图 5A · Tool Architecture](diagrams/05a-tools/tools.html) | architecture | [JSON](diagrams/05a-tools/candidate.json) / [summary](diagrams/05a-tools/tools.finalize-summary.json) | [browser](diagrams/05a-tools/tools.browser-check.json) |
| [图 5B · Tool Call Sequence](diagrams/05b-tool-call/tool-call.html) | sequence | [JSON](diagrams/05b-tool-call/candidate.json) / [summary](diagrams/05b-tool-call/tool-call.finalize-summary.json) | [browser](diagrams/05b-tool-call/tool-call.browser-check.json) |
| [图 5C · Tool Result Data Flow](diagrams/05c-tool-result/tool-result.html) | dataflow | [JSON](diagrams/05c-tool-result/candidate.json) / [summary](diagrams/05c-tool-result/tool-result.finalize-summary.json) | [browser](diagrams/05c-tool-result/tool-result.browser-check.json) |
| [图 6A · Repository Understanding Workflow](diagrams/06a-repository-workflow/repository-workflow.html) | workflow | [JSON](diagrams/06a-repository-workflow/candidate.json) / [summary](diagrams/06a-repository-workflow/repository-workflow.finalize-summary.json) | [browser](diagrams/06a-repository-workflow/repository-workflow.browser-check.json) |
| [图 6B · Repository Context Data Flow](diagrams/06b-repository-context/repository-context.html) | dataflow | [JSON](diagrams/06b-repository-context/candidate.json) / [summary](diagrams/06b-repository-context/repository-context.finalize-summary.json) | [browser](diagrams/06b-repository-context/repository-context.browser-check.json) |
| [图 7A · Code Modification Sequence](diagrams/07a-code-modification/code-modification.html) | sequence | [JSON](diagrams/07a-code-modification/candidate.json) / [summary](diagrams/07a-code-modification/code-modification.finalize-summary.json) | [browser](diagrams/07a-code-modification/code-modification.browser-check.json) |
| [图 7B · Coding Task Workflow](diagrams/07b-coding-workflow/coding-workflow.html) | workflow | [JSON](diagrams/07b-coding-workflow/candidate.json) / [summary](diagrams/07b-coding-workflow/coding-workflow.finalize-summary.json) | [browser](diagrams/07b-coding-workflow/coding-workflow.browser-check.json) |
| [图 7C · Edit / Patch Data Flow](diagrams/07c-edit-data/edit-data.html) | dataflow | [JSON](diagrams/07c-edit-data/candidate.json) / [summary](diagrams/07c-edit-data/edit-data.finalize-summary.json) | [browser](diagrams/07c-edit-data/edit-data.browser-check.json) |
| [图 8A · Shell Execution Sequence](diagrams/08a-shell/shell.html) | sequence | [JSON](diagrams/08a-shell/candidate.json) / [summary](diagrams/08a-shell/shell.finalize-summary.json) | [browser](diagrams/08a-shell/shell.browser-check.json) |
| [图 8B · Permission and Host Boundary](diagrams/08b-security/security.html) | architecture | [JSON](diagrams/08b-security/candidate.json) / [summary](diagrams/08b-security/security.finalize-summary.json) | [browser](diagrams/08b-security/security.browser-check.json) |
| [图 9A · Session Lifecycle](diagrams/09a-session/session.html) | lifecycle | [JSON](diagrams/09a-session/candidate.json) / [summary](diagrams/09a-session/session.finalize-summary.json) | [browser](diagrams/09a-session/session.browser-check.json) |
| [图 9B · State Ownership](diagrams/09b-state/state.html) | architecture | [JSON](diagrams/09b-state/candidate.json) / [summary](diagrams/09b-state/review-2/state.finalize-summary.json) | [browser](diagrams/09b-state/review-2/state.browser-check.json) |
| [图 9C · Persistence Data Flow](diagrams/09c-persistence/persistence.html) | dataflow | [JSON](diagrams/09c-persistence/candidate.json) / [summary](diagrams/09c-persistence/persistence.finalize-summary.json) | [browser](diagrams/09c-persistence/persistence.browser-check.json) |
| [图 10A · Event Flow](diagrams/10a-events/events.html) | dataflow | [JSON](diagrams/10a-events/candidate.json) / [summary](diagrams/10a-events/events.finalize-summary.json) | [browser](diagrams/10a-events/events.browser-check.json) |
| [图 10B · Concurrency Owners](diagrams/10b-concurrency/concurrency.html) | architecture | [JSON](diagrams/10b-concurrency/candidate.json) / [summary](diagrams/10b-concurrency/concurrency.finalize-summary.json) | [browser](diagrams/10b-concurrency/concurrency.browser-check.json) |
| [图 11A · Extension Architecture](diagrams/11a-extension/extension.html) | architecture | [JSON](diagrams/11a-extension/candidate.json) / [summary](diagrams/11a-extension/extension.finalize-summary.json) | [browser](diagrams/11a-extension/extension.browser-check.json) |
| [图 11B · MCP Tool Sequence](diagrams/11b-mcp/mcp.html) | sequence | [JSON](diagrams/11b-mcp/candidate.json) / [summary](diagrams/11b-mcp/review-2/mcp.finalize-summary.json) | [browser](diagrams/11b-mcp/review-2/mcp.browser-check.json) |
| [图 11C · Skill / Plugin Lifecycle](diagrams/11c-plugin-lifecycle/plugin-lifecycle.html) | lifecycle | [JSON](diagrams/11c-plugin-lifecycle/candidate.json) / [summary](diagrams/11c-plugin-lifecycle/plugin-lifecycle.finalize-summary.json) | [browser](diagrams/11c-plugin-lifecycle/plugin-lifecycle.browser-check.json) |
| [图 12A · Frontend / Runtime Architecture](diagrams/12a-front-runtime/front-runtime.html) | architecture | [JSON](diagrams/12a-front-runtime/candidate.json) / [summary](diagrams/12a-front-runtime/review-2/front-runtime.finalize-summary.json) | [browser](diagrams/12a-front-runtime/review-2/front-runtime.browser-check.json) |
| [图 12B · UI Request Sequence](diagrams/12b-ui-request/ui-request.html) | sequence | [JSON](diagrams/12b-ui-request/candidate.json) / [summary](diagrams/12b-ui-request/ui-request.finalize-summary.json) | [browser](diagrams/12b-ui-request/ui-request.browser-check.json) |
| [图 13A · Error Recovery Workflow](diagrams/13a-recovery/recovery.html) | workflow | [JSON](diagrams/13a-recovery/candidate.json) / [summary](diagrams/13a-recovery/recovery.finalize-summary.json) | [browser](diagrams/13a-recovery/recovery.browser-check.json) |
| [图 13B · Physical Model Retry Lifecycle](diagrams/13b-retry/retry.html) | lifecycle | [JSON](diagrams/13b-retry/candidate.json) / [summary](diagrams/13b-retry/retry.finalize-summary.json) | [browser](diagrams/13b-retry/retry.browser-check.json) |
| [图 19 · ZCode Master Architecture Map](diagrams/19-master/master.html) | architecture | [JSON](diagrams/19-master/candidate.json) / [summary](diagrams/19-master/review-2/master.finalize-summary.json) | [browser](diagrams/19-master/review-2/master.browser-check.json) |

## 视觉审查和建议

visualReview = not-requested：没有截图式人工视觉审查，不把自动 gate pass 等同于人工感知验收。新 architecture 图 9B/12A/19 曾提示交叉，按 skill 做一次保留语义的布局复核，当前三图均无 route advisory；其他新 architecture 图无交叉。以下自动路由建议不是失败 diagnostics，仍保留，数字表示当前 resolved-route 交叉/弯折/伸展计数，并非人工已确认可读。

| 图 | advisory signals |
|---|---|
| [图 1A · Startup Lifecycle](diagrams/01a-startup/startup.html) | resolvedCrossovers=1, routesOverSuggestedBends=1, routesOverSuggestedStretch=1 |
| [图 1B · Runtime Architecture](diagrams/01b-runtime/runtime.html) | routesOverSuggestedBends=1 |
| [图 2A · Agent Runtime Workflow](diagrams/02a-workflow/workflow.html) | routesOverSuggestedBends=2, routesOverSuggestedStretch=4 |
| [图 2B · Agent Loop Lifecycle](diagrams/02b-loop/loop.html) | resolvedCrossovers=3 |
| [图 2C · Agent Loop State Machine](diagrams/02c-state/state.html) | resolvedCrossovers=22, routesOverSuggestedBends=4 |
| [图 3B · Context Lifecycle](diagrams/03b-context/context.html) | resolvedCrossovers=4 |
| [图 6A · Repository Understanding Workflow](diagrams/06a-repository-workflow/repository-workflow.html) | routesOverSuggestedStretch=1 |
| [图 7B · Coding Task Workflow](diagrams/07b-coding-workflow/coding-workflow.html) | routesOverSuggestedBends=2, routesOverSuggestedStretch=1 |
| [图 8B · Permission and Host Boundary](diagrams/08b-security/security.html) | routesOverSuggestedBends=1 |
| [图 9A · Session Lifecycle](diagrams/09a-session/session.html) | resolvedCrossovers=1 |
| [图 10B · Concurrency Owners](diagrams/10b-concurrency/concurrency.html) | routesOverSuggestedBends=1 |
| [图 11C · Skill / Plugin Lifecycle](diagrams/11c-plugin-lifecycle/plugin-lifecycle.html) | resolvedCrossovers=1, routesOverSuggestedBends=1, routesOverSuggestedStretch=1 |
| [图 13A · Error Recovery Workflow](diagrams/13a-recovery/recovery.html) | routesOverSuggestedBends=4, routesOverSuggestedStretch=3 |
| [图 13B · Physical Model Retry Lifecycle](diagrams/13b-retry/retry.html) | resolvedCrossovers=1, routesOverSuggestedBends=2, routesOverSuggestedStretch=2 |

图是责任/流程聚合。2C 是合法迁移契约，不表示普通 while 使用全部边；Context/Session/Retry lifecycle 是真实阶段的抽象，不新增源码枚举。Master 的 persisted-facts 边省略 persistence ports，stdio/RPC 是异步边界。Batch 14 因测试体系证据不足按任务条件仅提供文字，不生成 Testing Architecture。

## 文档与源码证据审计

22 个 Batch 各含九个固定栏目，25 个最终主题按任务顺序整理。源码锚点检查当前文件存在与行号范围；它不自动证明文字语义，关键控制流已人工阅读源码。链接检查覆盖全部 Markdown 的本地文件目标；[审计结果](evidence/document-check.json)、[source index](evidence/diagram-source-index.json)、[30 文件清单](evidence/reading-files.json) 均保留。
