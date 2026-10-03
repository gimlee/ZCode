# Batch 14 · Testing / Eval

基线同 [README](README.md)。结论限定当前 `git ls-files`、package scripts 与已读源码，不把缓存目录或历史说明当成当前测试套件。

## Findings

**Confirmed**：当前提交有四个测试文件，全部使用 `node:test`/`node:assert`：三个 Services、一个 UI。没有根 `test` script；CLI `check` 是 registry freshness + turbo typecheck，`dev:desktop:test` 是测试环境开发启动，不是 E2E runner。

| 文件 | 当前覆盖 | 测试类型与边界 |
|---|---|---|
| `packages/services/test/providerConfigMigration.test.ts:1` | legacy Provider migration、personal 配置恢复 | 临时文件 + 实际 config runtime；未调用在线 LLM |
| `packages/services/test/importedClaudeRecovery.test.ts:1` | 导入历史转真实 session，两种 clientMode | 临时目录/TaskIndexRepo 与手写 agent-service stub；不是手机网络 E2E |
| `packages/services/test/nonCliAcpRetirement.test.ts:1` | 移除旧 ACP/Agent 配置后的当前服务行为 | schema/服务兼容与退役回归 |
| `packages/ui/test/nonCliAcpRetirement.test.ts:1` | metadata/settings 与工具呈现纯函数 | UI helper 测试，不渲染完整交互 |

**Unknown / Need Verification**：当前未找到已提交 Agent Loop、Model adapter、Read/Edit/Bash 独立测试、Mock LLM suite、Playwright/Vitest runner 配置、SWE-bench、golden trajectory 或 coding benchmark。`c8` devDependency、Playwright 产品工具、`eval-workflow-snippet` Runtime tool、material-icons 的 benchmark 图标不构成 Eval 体系证据。

## Key Source Files

上述四个测试；`package.json:1`（命令）；`apps/zcode-cli/package.json:1`（check/typecheck/trajectory scripts）；`packages/services/package.json:1`、`packages/ui/package.json:1`（包依赖/入口）。检索记录将在 `evidence/testing-inventory.json` 保存。

## Key Classes / Functions

`test()` 定义用例，`assert` 检查结果；migration 的 `setup()` 建临时 config runtime；recovery 以手写 `resumeSession/createSession` stub 捕获输入并构造 validated snapshot。它们验证的不是模型智能质量。`createZCodeTaskServiceAdapter()`、`createProviderConfigRuntime()` 和 TaskIndexRepo 是被测实际边界，不能将 stub 误称生产实现。

## Control Flow

已提交测试的共同路径为准备临时资源/配置 → 调用被测函数或 stub 组合的 adapter → 断言输入/持久化/返回值 → 清理。Agent 完整“prompt → 模型 → 工具 → 最终回答”运行不在当前四个文件中。

根 `pnpm typecheck` 针对产品 workspace project references；CLI workspace 的 `typecheck/check` 另有入口。Lint/架构检查属于静态检查，不是行为测试。Node 原生 runner + TS loader 原理上可用于这些 `.ts` 文件，但本次依赖缺失，未验证 loader、别名与各包 build 是否满足，因此不提供未经执行的“一条统一测试命令”。

## Data Flow

fixtures 使用示例 workspace/identity 和临时文件；预期结果包括 schema stripping、迁移后 personal 配置、真实 session snapshot 等。没有实测 token usage、tool success rate、任务 pass@k、模型成本/延迟或 SWE-bench 分数。prompt trajectory 脚本可记录调试资料，不自动证明 golden diff 或评测判分。

## Important Design Decisions

**Inference**：已有测试集中于兼容迁移和功能退役，能为这些边界提供回归保护；相比本分析发现的 queue/retry/checkpoint/stream 双语义，提交内行为测试证据明显不足。这是覆盖证据缺口，不是声称已测出故障。

建议后续优先在真实所有者边界补充：CommandInbox 幂等/队列、两种 delivery profile 断线恢复、部分 stream + 已执行工具、Edit freshness/replaceAll、checkpoint restore 失败、MCP connect waiter、workspace hook trust revoke。涉及 UI 发送/重连的变更再补 Desktop/Web E2E；这些是建议，本任务没有新增测试或应用行为。

## Unknowns

未读取 CI 私有任务、外部评测平台或未提交测试。没有 node_modules，四个测试本轮未执行；typecheck/lint 的真实失败记录见最终 validation。不能声明“测试通过”或“项目没有任何外部测试”。

## Archify Diagram

按任务“如果测试体系较完整，否则只输出文字”的要求，本批不生成 Testing Architecture：四个兼容测试不足以画出完整 Agent/Provider/Tool/E2E/Eval 层级。最终图清单明确标记这一缺项原因，不虚构不存在的测试设施。

## Next Batch Dependencies

Batch 15 的技术债评价以本批测试缺口作为证据；Batch 18 的验证建议与已运行结果分开标记。
