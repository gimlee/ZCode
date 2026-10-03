# Batch 8 · Shell / Permission / Security

基线与源码简称沿用 [Batch 6](batch-6-repository-understanding.md)。本批描述仓库当前执行链的能力边界，不将类型里的 sandbox 字段当成已生效的隔离机制。

## Findings

**Confirmed：Bash 经 ExecutionPort 在 Agent 所在宿主启动子进程。** `NodeExecutionAdapterRun.run()` 调用 Node spawn；POSIX shell、Windows Git Bash/cmd 与 argv 模式有分支。没有这条默认执行链必经的 Docker、VM、远端 worker 或 OS sandbox launcher。远程 workspace 的命令在其 Agent 宿主运行，不等于本地 adapter 自动把每次 shell 迁移到云端。

**Confirmed：旧 protected-resource sandbox 已撤除。** Bash request 仍带 sandbox/dangerouslyDisableSandbox 声明与遥测，contracts 仍有 sandbox_violation 类型，但当前 exec adapter 的 spawn 链未执行对应隔离政策；源码注释直接说明撤除。权限 allow/ask/deny 是执行前策略，不是 OS 强制文件/网络隔离（`A/exec/node-execution-adapter-run.ts:276`）。

**Confirmed：路径 policy 不硬阻止 workspaceRoot 外访问。** `resolveWorkspacePath()` 要求绝对 cwd/root，将相对输入 resolve 后返回，源码明确保留外部路径访问。不能把 workspace identity 当成文件系统 jail（`C/tool/path-policy.ts:15–37`）。

## Key Source Files

| 文件 | 职责 |
|---|---|
| `C/tool/handlers/bash.ts:97,187,428` | command request、foreground/background、sandbox 声明 |
| `C/tool/handlers/bash-command-permission-policy.ts:87` | Bash 解析后规则 subject 与风险前缀 |
| `C/tool/handlers/bash-command-parser.ts:1` | 结构化命令分析，不按字符串前缀盲放行 |
| `C/permission/service.ts:83,99` | mode/capability/project rules 的真实顺序 |
| `C/permission/broker.ts:24,34,39` | deny 默认与异步人工确认 |
| `C/tool/executor/permission-flow.ts:41,184,240` | hook/broker race、input 改写后的复核 |
| `C/tool/path-policy.ts:15` | 路径规范化，不是目录隔离 |
| `A/exec/execution-command.ts:28,71` | env overlay、command/shell 选择 |
| `A/exec/bash-shell-provider.ts:33` | POSIX/Git Bash/cmd 选择 |
| `A/exec/node-execution-adapter-process.ts:58` | startup snapshot、cwd capture、spawn options |
| `A/exec/node-execution-adapter-run.ts:25,197,276` | spawn、计时、输出、abort/close |
| `A/exec/process-tree.ts:1` | POSIX process-group/Windows 清理 |

## Key Classes / Functions

- **Confirmed：** `buildExecutionEnv()` 默认继承 processEnv，清理 ZCode runtime/network 变量后应用网络策略、unset/set；base=empty 可不继承。它不是对所有用户 secrets 的统一过滤器。
- **Confirmed：** `resolveExecutionCommand()` 区分 argv 与 shell，处理 Windows cmd/bat shim；有效 shell selection 可冻结。`prepareChildSpawn()` 注入 shell init snapshot、embedded search、cwd capture。
- **Confirmed：** `PermissionService.checkPermission()` 先处理 plan transition、用户交互与 alwaysAsk；非 plan 的 yolo 放行位于普通 disallowed/project rules 前；auto 明确未实现并 deny。不能简化成“所有模式都 deny 优先”。随后普通顺序为 disallowed → project deny/ask → plan policy → project allow → preapproved → allowedTools → edit/build。
- **Confirmed：** `ManualPermissionBroker` 以 requestId 维护 pending，重复拒绝，abort/timeout 清理并单次 settle；没有交互客户端的 DenyPermissionBroker 拒绝。

## Control Flow

```text
Model Bash call → lookup/schema/resolveInput → PreToolUse
  → PermissionService + Bash parsed rule policy
  → allow / deny / ask（broker 与 PermissionRequest hook）
  → 改写 input 后重校验/复核 → bashHandler
  → create ExecutionRequest(cwd, env, command, timeout, output budget)
  → background lifecycle 或 NodeExecutionAdapter.run
  → prepareChildSpawn → spawn → output/progress → exit/close
  → result status/exitCode/resolvedCwd → BashOutput → tool message
```

**Confirmed：** timeout 在 spawn 后开始，不包含异步 shell snapshot 准备期；准备期仍监听用户取消和 adapter shutdown。取消/超时调用 process-tree 清理；root shell exit 不代表继承 pipe 的后代已退出，代码保留清理与读端释放。stdout/stderr 可 collector 分开收集，Bash 模式可合并持久化到文件；有 preview/持久化预算，不能承诺模型收到无限完整输出。

**Confirmed：** 主线程 Bash 成功后可更新项目内 cwd，离开项目边界时 reset；subagent/runtimeScope 有独立语义。cwd 是文件/命令事实，workspaceIdentity 是路由与隔离 key，二者用途不同。

## Data Flow

用户/模型 command → parser 的规则 subject → permission decision；执行 request → effective shell + env + cwd → OS child → output files/preview + progress → execution result → UI/模型各自视图。网络代理/TLS 环境影响 egress 配置，不自动禁止任意网络调用；Git credentials 由实际子进程环境/用户工具链决定，本批没有可证明的独立凭据 vault 隔离。

## Important Design Decisions

- **Confirmed：** approval 是执行前的业务 gate，abort 是生命周期控制；两者均不是副作用事务回滚。
- **Confirmed：** Bash 风险分析处理 wrapper、复合命令与 stable action subjects；动态/高风险命令不能只按首个词“看起来安全”放行。
- **Confirmed：** 官方 CUA capability 的可信 authority、普通 MCP hints 与人工确认边界沿用 Batch 5，不能按工具名称授予可信权限。
- **Inference：** 当前安全能力主要来自 permission 与宿主权限；若要引入强隔离，需要先明确 OS 执行器/平台策略，而非仅切换现存 sandbox boolean。

## Unknowns

- **Need Verification：** 未执行危险命令、进程树故障、代理/TLS 与真实权限竞速；不同 OS 的清理能力不作实测承诺。
- **Unknown：** 本执行链不存在可确认的容器/VM 强制隔离；外部部署可以额外隔离 Agent，但这不是本仓库默认 adapter 保证。
- **Need Verification：** 网络/凭据配置与 workspace hook 的信任审查将在 Batch 11 继续，不能由 env 处理推出完全防泄漏。

## Archify Diagram

- [图 8A · Shell Execution Sequence](diagrams/08a-shell/shell.html)
- [图 8B · Permission and Host Boundary](diagrams/08b-security/security.html)

## Next Batch Dependencies

Batch 9 追 session、history、checkpoint 和队列持久化；shell output artifact 不能被误当作可恢复运行中的 OS process。
