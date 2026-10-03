# ZCode 源码分析 · Batch 0～21

任务说明：[promt/archify-promt.md](../promt/archify-promt.md)。Batch 0～21 已完成，本轮续作完成 Batch 6～21，保留此前 Batch 0～5。分析基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`，所有图的源码链接固定该 revision。

建议从 [最终 Master Map](diagrams/19-master/master.html) → [25 主题目录](topics/README.md) → [12 条调用链](batch-20-call-chains.md) 阅读；准备二次开发时使用 [30 文件阅读路线](batch-16-reading-path.md) 和 [17 项开发地图](batch-18-development-map.md)。

| Batch | 报告 | Archify 图 |
|---|---|---|
| 0 | [Initial Repository Map](batch-0-repository-map.md) | [图 0 · ZCode Initial Repository Map](diagrams/00-repository/repository.html) |
| 1 | [Startup / Runtime](batch-1-startup-runtime.md) | [图 1A · Startup Lifecycle](diagrams/01a-startup/startup.html) · [图 1B · Runtime Architecture](diagrams/01b-runtime/runtime.html) |
| 2 | [Agent Runtime / Loop](batch-2-agent-runtime-loop.md) | [图 2A · Agent Runtime Workflow](diagrams/02a-workflow/workflow.html) · [图 2B · Agent Loop Lifecycle](diagrams/02b-loop/loop.html) · [图 2C · Agent Loop State Machine](diagrams/02c-state/state.html) |
| 3 | [Prompt / Context](batch-3-prompt-context.md) | [图 3A · Prompt Composition](diagrams/03a-prompt/prompt.html) · [图 3B · Context Lifecycle](diagrams/03b-context/context.html) · [图 3C · Model Context Data Flow](diagrams/03c-model-context/model-context.html) |
| 4 | [Model / Provider](batch-4-model-provider.md) | [图 4A · Model Provider Architecture](diagrams/04a-provider/provider.html) · [图 4B · LLM Request Sequence](diagrams/04b-request/request.html) · [图 4C · Provider Adapter Data Flow](diagrams/04c-adapter/adapter.html) |
| 5 | [Tool System](batch-5-tool-system.md) | [图 5A · Tool Architecture](diagrams/05a-tools/tools.html) · [图 5B · Tool Call Sequence](diagrams/05b-tool-call/tool-call.html) · [图 5C · Tool Result Data Flow](diagrams/05c-tool-result/tool-result.html) |
| 6 | [Repository Understanding](batch-6-repository-understanding.md) | [图 6A · Repository Understanding Workflow](diagrams/06a-repository-workflow/repository-workflow.html) · [图 6B · Repository Context Data Flow](diagrams/06b-repository-context/repository-context.html) |
| 7 | [File Editing](batch-7-file-editing.md) | [图 7A · Code Modification Sequence](diagrams/07a-code-modification/code-modification.html) · [图 7B · Coding Task Workflow](diagrams/07b-coding-workflow/coding-workflow.html) · [图 7C · Edit / Patch Data Flow](diagrams/07c-edit-data/edit-data.html) |
| 8 | [Shell / Security](batch-8-shell-security.md) | [图 8A · Shell Execution Sequence](diagrams/08a-shell/shell.html) · [图 8B · Permission and Host Boundary](diagrams/08b-security/security.html) |
| 9 | [Session / State](batch-9-session-state.md) | [图 9A · Session Lifecycle](diagrams/09a-session/session.html) · [图 9B · State Ownership](diagrams/09b-state/state.html) · [图 9C · Persistence Data Flow](diagrams/09c-persistence/persistence.html) |
| 10 | [Events / Concurrency](batch-10-events-concurrency.md) | [图 10A · Event Flow](diagrams/10a-events/events.html) · [图 10B · Concurrency Owners](diagrams/10b-concurrency/concurrency.html) |
| 11 | [MCP / Skill / Plugin](batch-11-extensions.md) | [图 11A · Extension Architecture](diagrams/11a-extension/extension.html) · [图 11B · MCP Tool Sequence](diagrams/11b-mcp/mcp.html) · [图 11C · Skill / Plugin Lifecycle](diagrams/11c-plugin-lifecycle/plugin-lifecycle.html) |
| 12 | [UI / CLI](batch-12-ui-cli.md) | [图 12A · Frontend / Runtime Architecture](diagrams/12a-front-runtime/front-runtime.html) · [图 12B · UI Request Sequence](diagrams/12b-ui-request/ui-request.html) |
| 13 | [Error / Recovery](batch-13-error-recovery.md) | [图 13A · Error Recovery Workflow](diagrams/13a-recovery/recovery.html) · [图 13B · Physical Model Retry Lifecycle](diagrams/13b-retry/retry.html) |
| 14 | [Testing / Eval](batch-14-testing-eval.md) | 条件不满足，仅文字分析 |
| 15 | [Abstractions / Debt](batch-15-abstractions-debt.md) | 复用专题图 |
| 16 | [Source Reading Path](batch-16-reading-path.md) | 复用专题图 |
| 17 | [Minimal Core](batch-17-minimal-core.md) | 复用专题图 |
| 18 | [Development Map](batch-18-development-map.md) | 复用专题图 |
| 19 | [Master Architecture Map](batch-19-master-map.md) | [图 19 · ZCode Master Architecture Map](diagrams/19-master/master.html) |
| 20 | [Critical Call Chains](batch-20-call-chains.md) | 复用专题图 |
| 21 | [Final Delivery](batch-21-delivery.md) | 复用专题图 |

每批保留九个固定栏目；Confirmed 为源码已确认，Inference 为推断，Unknown/Need Verification 为证据限制。当前普通搜索是文本 + on-demand，工具由 Core executor 执行，模型 SDK 不接管本地副作用循环；UI V4 的 ACK 与权威 projection 分离，手机复用已有 Host attachment。

共 35 张 standalone Archify HTML，本轮新增 20 张；全部通过 validate、deliver、strict check、真实浏览器 browser-check，当前规格/HTML 哈希与 receipts 匹配。未进行截图式人工视觉审查，部分非 architecture 图保留路由 advisory，详见 [validation](validation.md) 与 [证据索引](evidence/artifacts.json)。Batch 14 如实记录当前四个测试及覆盖缺口，按任务条件未生成 Testing Architecture。

已运行 typecheck/lint，两者均因 node_modules 缺失、tsc/oxlint 不可用而失败，不能称项目验证通过。未启动真实模型、MCP、Electron 或手机链路；未改应用代码，保留既有 promt/ 与旧 .archify/。
