# Batch 6 · Repository Understanding

基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`。C/A/B 分别为 `apps/zcode-cli/packages/core/src/`、`apps/zcode-cli/packages/adapters/src/`、`apps/zcode-cli/packages/bootstrap/src/`；其他路径相对仓库根。承接 Batch 3 的输入投影与 Batch 5 的实际注册集合。

## Findings

**Confirmed：普通 Agent 的仓库理解主要是文本搜索驱动 + 按需探索（B + E）。** 默认 Bash embedded-search 替换/增强 shell 中的 find/grep，并在需要时提供 rg fallback；模型选择命令和文件，Read/搜索结果经工具消息回到下一步模型。不是启动时把整个仓库预索引后一次性注入。direct Glob/Grep 是另一个可配置分支，不能把它与默认曝光集合合并描述。

**Confirmed：存在两种不同 ripgrep 路径。** direct `NodeFileSystemAdapter.searchText()` 默认使用 `ripgrep` 包的 WASM Worker；Bash 的 embedded-search 则可用 native-binaries、argv0-dispatch、internal-cli backend。原生 rg 与 WASM Worker 的分发、stdin、取消边界不同。证据：`A/fs/index.ts:452,1029,1047`、`A/exec/embedded-search-prelude.ts:34,96,119,142`。

**Inference：大型仓库效果依赖模型的搜索策略与结果预算。** 已确认的机制是路径/glob/type/输出模式、offset/headLimit、取消/超时与工具结果预算，不是可证明的语义相关性排名或全仓库知识图谱。

## Key Source Files

| 文件 | 实际作用 |
|---|---|
| `C/embedded-search/capability.ts:4` | 默认 embedded-search 能力开关 |
| `C/runtime/methods/embedded-search-branch.ts:11` | 搜索分支刷新、隐藏 direct 工具 |
| `C/tool/handlers/grep.ts:32` / `C/tool/handlers/glob.ts:25` | direct handler → FileSystemPort |
| `A/fs/index.ts:393,452,924,1029,1242,1708` | 文件发现、WASM 搜索、参数计划、分页与递归 |
| `A/exec/embedded-search-prelude.ts:34,119,142` | native/dispatch backend 与 shell function |
| `C/tool/handlers/read.ts:141,182` | 定向读取、读取状态与缓存 |
| `C/tool/executor/result-serialization.ts:46` | 模型结果的预算与 artifact |
| `C/runtime/helpers/provider-request-messages.ts:48` | 工具/提醒进入下一步请求 |

## Key Classes / Functions

- **Confirmed：** `NodeFileSystemAdapter.searchFiles()` 递归 readdir/stat、glob matcher，收集匹配后按 mtime 降序与路径排序，再 offset/maxResults 切片；不是维护增量索引。`walkFiles()` 跳过 VCS 目录，忽略非普通文件，逐层检查 abort。
- **Confirmed：** `searchText()` 可显式选 JavaScript；默认 `searchTextWithRipgrep()`。仅 `RipgrepRuntimeFailure` 回退 JS；取消与 `RipgrepTimeoutFailure` 不偷偷重跑。
- **Confirmed：** `runBundledRipgrepWorker()` 将 WASI 工作放 Worker，主线程可处理 stop 并 terminate。不能把这个 Worker 误称为远端检索服务。
- **Confirmed：** `buildEmbeddedSearchPreludeContent()` 不为 cmd/legacy-shell 安装 POSIX functions；Git Bash 保留系统 find。grep 对 null-data 等不兼容参数绕回系统 grep。已有可执行 rg 时不覆盖它。

## Control Flow

### 默认搜索链

```text
runRegularTurnLoop() → getTools(model)（默认 Bash，不曝光 direct Glob/Grep）
  → 模型产生 Bash call → executor 权限/hook → bashHandler
  → ExecutionPort → shell startup + embedded-search prelude
  → find / grep / rg 的实际 backend → stdout/stderr
  → output budget → paired tool entry → 下一次模型决定 Read 或继续搜索
```

### direct 分支

```text
globHandler → FileSystemPort.searchFiles → walkFiles → glob matcher → 排序/分页
grepHandler → FileSystemPort.searchText → normalize request → WASM Worker
  → --json 或 -c 输出解析 → files/content/count 与 headLimit/offset
  → 仅 runtime failure 时 JavaScript 搜索 fallback
```

**Confirmed：** direct ripgrep 参数含 `--no-config --hidden --color never --max-columns 500`，排除 VCS，按请求添加 multiline、ignoreCase、glob、type、context；没有 `--no-ignore` 的统一强制。direct walk 的过滤规则不同，不能承诺所有后端与 shell 自带 grep 完全相同的 ignore 语义。

## Data Flow

Repository files → scoped command / search request → 匹配路径、行/上下文或计数 → 工具 serializer → canonical/turn-local tool message → provider request projection。文件发现返回文件名不等于返回文件全文；Read 的 offset/limit 决定后续内容。

AGENTS.md、Git snapshot、memory index 沿用 Batch 3 的有限初始化；`projectContext` 未被 ContextBuilder 自动渲染。源代码主要是被模型主动请求后才进入 history，工具大输出可能只保留 preview/artifact。

## Important Design Decisions

- **Confirmed：** 模型决策与搜索执行分离；FS/Exec ports 提供实际算法，Core 保留权限、结果和历史 owner。
- **Confirmed：** Worker 搜索避免阻塞 Agent 主事件循环；取消不伪装为成功或自动 fallback。
- **Confirmed：** direct Glob 仍收集全部匹配后排序，分页只约束返回量，不能宣称限制了全目录遍历成本。
- **Inference：** 搜索文本足够通用，但复杂符号关系需要模型多步查证；因此“文件存在”“被搜索到”“被模型读到”是三个不同事实。

## Unknowns

- **Unknown：** 在当前普通 Agent 的 core/adapters/bootstrap 执行链未找到 LSP、Tree-sitter AST 索引、embedding/vector DB、持久化 symbol index 或 Repo Map 注入。该结论限定到本批追踪的链；仓库开发工具中的依赖图不是 Agent 的运行时检索能力。
- **Need Verification：** 未对大型仓库做性能/召回基准；native assets 是否在目标平台正确分发、JS 与 WASM 边界语义仍需实际集成测试。
- **Need Verification：** `git ls-files` 可由 Bash 调用，但没有证据将它归为普通 Agent 启动的必需 repo-index 步骤。

## Archify Diagram

- [图 6A · Repository Understanding Workflow](diagrams/06a-repository-workflow/repository-workflow.html)
- [图 6B · Repository Context Data Flow](diagrams/06b-repository-context/repository-context.html)

## Next Batch Dependencies

Batch 7 深入 Read → Edit/Write 的 freshness、匹配、写入及 checkpoint；复用本批“模型选择文件，工具读取内容”的边界。
