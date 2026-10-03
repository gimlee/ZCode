# Batch 13 · Error / Retry / Recovery

基线同 [README](README.md)；路径缩写同 [Batch 6](batch-6-repository-understanding.md)。详细主循环见 [Batch 2](batch-2-agent-runtime-loop.md)，模型分类见 [Batch 4](batch-4-model-provider.md)。

## Findings

**Confirmed**：至少存在四种不同恢复域：adapter 对物理 LLM attempt 的重试、Core 对已开始输出的模型步骤恢复、工具失败作为配对结果回注、UI 对连接/投影/命令的对账。不存在“所有错误统一重跑整个 turn”的通用机制。

| 错误 | 当前处理 | 不能推导的承诺 |
|---|---|---|
| Model API / Rate Limit | 分类器按 status、业务码和响应 headers 判定；预算允许时 adapter retry | 401/403 不是普通网络抖动；不会自动换品牌 Provider |
| Timeout / network / SSE stall | 未跨 stream boundary 可 adapter retry；跨界后 Core 检查安全锚点和 recovery budget | 不等于从任意流字节位置续接 |
| Invalid Model Response | 非法请求、解析失败、空 completion、异常 finish 分支分别处理 | 所有 invalid response 都同一 retry 策略 |
| Invalid Tool Call | lookup/schema/JSON 参数失败生成工具失败，回模型纠正 | 未通过参数校验也能执行 handler |
| Tool Error | catch/serialize 为 paired tool result；后续 loop 可让模型改方案 | executor 自动重复有副作用 handler |
| Shell Error | exit code/stdout/stderr 或 execution 异常进入工具结果；timeout/cancel 终止进程树 | 非零 exit 自动触发 rollback |
| File Error | Read 错误、Edit match/freshness、Write revision/IO 校验拒绝 | 所有写入具有跨文件事务 |
| Context Overflow | reactive compact 后重新构造请求；rapid-refill/失败终止 | adapter 原样请求无限 retry |
| User Cancellation | AbortSignal 传播；turn cancelled outcome、finally 释放；已提交工具配对仍须闭合 | 清除后续已 accepted 队列或自动撤销所有 shell effects |
| Internal Runtime Error | turn error outcome、日志与 cleanup；由上层展示/恢复 | 任意异常都被吞掉或自动 self-heal |

## Key Source Files

| 文件 | 证据 |
|---|---|
| `A/model/failure-classifier.ts:81,183,247` | API、overflow、取消、业务失败分类 |
| `A/model/runner-retry.ts:39` / `retry-policy.ts:1` | Retry-After、指数退避、jitter、预算 |
| `A/model/runner-stream.ts:123,1455` | physical attempt loop 与可见输出 boundary |
| `A/model/workflow-model-failure-policy.ts:79,114` | workflow unbounded 的确定性 stop 策略 |
| `C/runtime/methods/streaming-recovery.ts:14,47,103,207` | 10 次 Core recovery；Start Plan 特定 admission delay |
| `C/runtime/methods/streaming-tool-coordinator.ts:54,339` | 工具安全提交与流恢复 |
| `C/runtime/methods/turn-model-step.ts:742` | reactive compact |
| `C/runtime/methods/turn.ts:715,823` | error/cancel outcome 与 finally |
| `C/tool/executor/call-runner.ts:99,443,560` | 工具校验、handler、失败归一化 |
| `C/runtime/methods/resume.ts:56` | 从持久化恢复 |
| `C/runtime/methods/file-rewind.ts:93` | 受保护 restore 与失败 journal rollback |
| `packages/ui/src/v4/conversationProjectionStore.ts:1` | subscription recovery 与 pending overlay |

## Key Classes / Functions

`classifyModelFailure()` 的类别由 adapter 消费；`calculateRetryDelay()` 处理 cap/jitter 与合理 Retry-After；`canRetryStreamFailure()` 限制已经输出后的原样重放。`hasStreamRecoveryBudget()` 与 `recoverPartialAssistantOutputFailure()` 属于 Core，记录 discarded assistant tail，再从 provider-safe anchor 发**新的**请求。`executeToolCall()` 捕获 handler 失败并归一化；`applyWorkspaceFileRewind()` 处理文件 checkpoint 域，不是数据库/OS 全局事务。

## Control Flow

```text
physical attempt fail
 → classify + bounded/unbounded policy + stream-boundary check
 → eligible: release admission ticket → cancellable backoff → refresh attempt auth → retry
 → ineligible: raise to Core
Core model step
 → safe stream recovery? commit/discard by anchor → new model step
 → context exceeded? reactive compact → rebuild messages → new step
 → otherwise persist failure/cancelled partial → turn error/cancel outcome → finally
tool handler fail
 → structured error → persist paired tool result → loop → model decides next action
```

普通 adapter 默认 10 retries / 11 attempts，2 秒起、factor 2、cap 60 秒、jitter（可配置）。Core stream recovery 另有默认最多 10 次；不要把两层计数混为单一请求数。后续主 turn 的特定 Start Plan busy admission 使用 1s/2s delay，受 providerId/业务码/turnNumber 限制，并非全部 API 的公共默认。workflow 子流量的 unbounded 预算仍由策略表停止取消、确定性非法请求等错误。

## Data Flow

失败携带 reason/code/retryable/providerCode/response headers，经归一化保留 Retry-After 诊断。stream recovery 给失败 assistant message 标记 discarded finish/error，清空 turn-local modelResponse，推进锚点；不会把新输出接到失败消息尾部。已经执行的工具按 ID 配对提交，未执行调用与文本尾部的处置不能互换。

恢复能力矩阵：Resume **存在**；file checkpoint/rewind **存在但范围有限**；undo 对 tracked file mutation 可用；shell、外部 MCP 及网络副作用 **无通用自动 rollback**。**本次限定检索未确认自动 fallback model / 跨 Provider failover**；Registry 支持选择其他模型，per-attempt auth refresh 也不等同于改变 frozen endpoint/provider/model。MCP 断连的局部一次 reconnect 见 Batch 11，不能移植成所有 tools 的自动 retry。

## Important Design Decisions

**Confirmed**：retry 不持有 admission 槽；取消可打断等待。输出后的恢复与工具提交一起考虑，避免副作用重放。context compact 是重新构造请求的业务动作。**Inference**：错误策略分层提高了副作用安全性，也要求日志能关联 turn/model request/attempt/tool ID；仅有“重试成功”的 UI 提示不足以定位是哪一层恢复。

## Unknowns

没有在线触发 429/529、SSE 故障、MCP auth refresh 或真实 IO 错误；具体组合的可靠性尚未运行验收。未发现 fallback/failover 只针对当前检索的 Core/model 执行范围，不证明未来或外部服务不存在调度。file rewind 的 rollback 自身仍可能失败，不能称绝对恢复。

## Archify Diagram

- [图 13A · Error Recovery Workflow](diagrams/13a-recovery/recovery.html)
- [图 13B · Retry Lifecycle](diagrams/13b-retry/retry.html)

## Next Batch Dependencies

Batch 14 核对当前测试文件与入口，判断上述复杂边界有没有随仓库提交的回归证据；静态分析不代替运行验收。
