# Batch 11 · MCP / Skill / Plugin / Hook

基线与 C/A/B 简称沿用 [Batch 6](batch-6-repository-understanding.md)。工具统一 executor/registry 复用 Batch 5；本批追装配、发现、外部调用和信任。

## Findings

**Confirmed：Plugin 提供 components，不是任意代码自动注入 Core。** startup 同步 discovery 合成 enabled plugins 的 skillRoots、commandRoots、hooks、mcpServers、agent profiles 与官方 runtime features。插件文件存在、UI 可检查与当前会话执行启用是不同事实。Browser/CUA 的实际宿主 node_repl MCP 已在 Batch 5 确认。

**Confirmed：MCP tools 最终进入统一 Registry。** NodeMcpAdapter 管理连接、SDK transport、tools/list 与 callTool；Core 将 descriptors 包装为 ToolEntry，并经普通 schema/permission/hooks/serializer。stdio、Streamable HTTP 与 legacy SSE 是不同 transport，不把 MCP 等同 HTTP API。

**Confirmed：Skill 清单与正文加载分离。** Context 初始化 discover metadata；调用 Skill 才按 name 选择、限制字节读取、剥 frontmatter、展开变量，正文回成工具结果。不是一次性把所有技能正文塞 system，也不是 Skill 自己启动另一套 Agent loop。

## Key Source Files

| 文件 | 实际作用 |
|---|---|
| `B/app/startup-marks.ts:11` | resolveStartupPlugins 的真实装配 |
| `A/plugins/index.ts:124,127,180,193,336` | discovery、enabled components 与结果聚合 |
| `A/plugins/marketplace.ts:587,648` | install/uninstall 与来源记录 |
| `B/app/plugin-facade.ts:28,42` | 启用/抑制配置的会话镜像 |
| `A/skills/roots.ts:19,58,96` | 用户/工作区/extra roots |
| `A/skills/index.ts:42,58,94,134` | 路径身份、disabled、正文限长、symlink policy |
| `C/runtime/methods/context.ts:213` | context 中 skill discovery |
| `C/tool/handlers/skill.ts:16,35` | SkillPort.loadSkill 与结果 |
| `A/mcp/index.ts:157,246,304,438,1449` | MCP adapter、连接/调用/transport |
| `C/mcp/index.ts:60,105,214` | descriptor → ToolEntry → McpPort |
| `C/hooks/configured-runner.ts:15,75` | config/project hooks 的 registration |
| `C/hooks/configured-runner-callback.ts:18,30` | hook command/process → ExecutionPort |
| `C/hooks/runner.ts:34,51,88` | matcher、顺序运行、dispatch 再授权 |
| `C/hooks/workspace-hook-runtime-admission.ts:116` | snapshot digest/security revision gate |

## Key Classes / Functions

### MCP

`connectConfiguredServers()` 并行收敛 server records，移除旧配置；返回 statuses + tool descriptors，并不表示所有 servers 都 connected。connection generation 防迟到回调污染新连接。`callTool()` 在自己的 deadline 内等待共享 connecting，caller abort 不直接关闭其他 caller 共享 OAuth 流程。

**Confirmed：** MCP adapter 有局部恢复：disconnected record 调用前重连一次；确切 SDK “Not connected” 可重连并 retry once；HTTP/SSE 的认证 challenge 可进入授权恢复。普通执行错误不会因此无限重跑。stdio 重启后 REPL 变量等进程内状态不能恢复。这个局部机制补充 Batch 5 的“通用 executor 不自动 retry handler”，二者不冲突。

### Skill / Plugin

**Confirmed：** 默认 roots 包含用户与从 cwd 到 worktree root 的 `.zcode/skills`、`.agents/skills`，同级合并不是 fallback；extra/插件 roots 也可注入。discovery 以 path 去重而非 name，按 priority 处理；load 的同名解析依据已发现列表匹配，不能声称同名内容都被加载。disabled path 同时覆盖 canonical path。

**Confirmed：** plugin-scope 扫描不跟随目录/文件 symlink，用户 roots 保留 symlink 导入；scan 检查根自身 SKILL.md 与一层子目录。load 默认 100,000 bytes，并返回 truncated/bytesRead；目录发现不代表文件全文无上限。

**Confirmed：** plugin facade 改 enabled/suppressed config 与自身镜像；startup 的 runtime components 有单次装配边界。不能把 list/set 成功自动解释成当前每个既有 Model/MCP/Hook 对象都即时热替换。

### Hook

配置形成 HookRegistration → event/matcher 选择 → 每条实际 dispatch 前 evaluate admission → callback → output merge。command hook 用 shell，process hook 用 argv；都走 ExecutionPort、stdin cleanup、timeout/output budgets。同步输出可影响 additionalContexts/permission/input；async command 的生命周期独立，输出不能反向改变已经继续的动作。

## Control Flow

```text
createApp → resolveStartupPlugins → enabled components
  → Skill roots / command roots / Hook registrations / MCP configs / profiles
Context init → discoverSkills → metadata attachments
Model Skill call → executor → loadSkill → skill_content → tool result
MCP startup → connect/listTools → descriptors → registerMcpTools → cache invalidation
Model MCP call → Core executor → handler → adapter.callTool → SDK transport
  → server result → media normalization → serializer → paired history
Hook event → matcher → dispatch trust recheck → ExecutionPort → result/context
```

## Data Flow

Manifest/config/installed source identity → enabled component roots/configs → immutable/current session runtime assembly。MCP server descriptor hints 形成工具 metadata，但不是官方 authority；官方 auth 与 trusted-origin registry 另外验证，缺必要来源 fail closed。Skill 文件 path 是安装项身份；正文才是模型输入。

Workspace hooks 用 workspaceIdentity、bundle/declaration digests、reviewItemId 与 security revision 管控。pending trust、feature disabled、snapshot mismatch、corrupt trust store 均可阻止执行；每条 dispatch 再授权，使前序 hook 运行期间的 revoke 生效。普通文件权限不能替代这层执行信任。

## Important Design Decisions

- **Confirmed：** Registry/executor 统一，但外部 server 生命周期与本地 tool lifecycle 仍分层。
- **Confirmed：** 共享 MCP connecting 的 waiter deadline 与连接 owner 分开，不让单 caller 取消摧毁其他授权等待者。
- **Confirmed：** 插件启用态、检查展示态、实际 runnable hooks 分离；不按目录或名称推断能力。
- **Inference：** 主要扩展接缝是 Model/Tool/FS/Exec/MCP/Skill ports、profiles、command roots 与可信 Hook registration；新增插件不等于无需权限/结果预算/平台验收。

## Unknowns

- **Need Verification：** 未连接实际 MCP/OAuth、安装外部插件或执行 workspace hooks；不宣称外部服务权限或协议兼容实测通过。
- **Need Verification：** 插件更新后各运行中会话的刷新应追具体 lifecycle API，不能由 marketplace 安装原子 rename 推出全运行时热更新。

## Archify Diagram

- [图 11A · Extension Architecture](diagrams/11a-extension/extension.html)
- [图 11B · MCP Tool Sequence](diagrams/11b-mcp/mcp.html)
- [图 11C · Skill / Plugin Lifecycle](diagrams/11c-plugin-lifecycle/plugin-lifecycle.html)

## Next Batch Dependencies

Batch 12 将上述会话 runtime 与 Desktop/Web/CLI presentation 连接，检查 stdio、RPC、手机 attachment 和两种 stream delivery。
