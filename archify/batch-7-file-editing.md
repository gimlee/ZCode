# Batch 7 · File Editing 与 Coding Workflow

基线、C/A/B 简称沿用 [Batch 6](batch-6-repository-understanding.md)。分析实际 Read/Write/Edit、文件 checkpoint 与可执行的修复路径，不生成或运行假想 bug 案例。

## Findings

**Confirmed：Edit 是文本替换，Write 是完整写入，不是 AST 改写。** Edit 首选 exact，再尝试引号、行号前缀、转义、空白/缩进和 block-anchor 匹配；候选歧义或非 replace_all 的多处匹配会失败。内置 ApplyPatch 当前没有启用，structured patch 是差异/恢复数据，不等于一个可调用 Patch tool。

**Confirmed：已有文件的读前写、stale 检测与 adapter revision check 是不同层。** Write 要有可用的非 partial read；Edit 在存在 readFileState 时检查。写入前重新读取实际文件，再将 revision 传到 FS port。revision ID 使用整数 mtime + size；返回还带 hash，但 `assertExpectedRevision()` 并不是内容 hash CAS（`A/fs/index.ts:473,775`）。

**Confirmed：atomic 是尝试策略，不能宣称全程原子事务。** adapter 先写临时文件、复制 mode、sync、rename；失败时清临时文件并直接 truncate/write/sync 目标。拒绝通过 symlink 写入。expectedRevision 检查与最终 rename 之间仍没有 OS CAS，跨文件修改也不是原子提交（`A/fs/index.ts:700–755`）。

## Key Source Files

| 文件 | 职责 |
|---|---|
| `C/tool/handlers/read.ts:141,182,200` | stat、fresh-cache、range read、read-state |
| `C/tool/handlers/write.ts:66,105,125,278` | 旧内容、写前读状态、写回与结构化差异 |
| `C/tool/handlers/edit.ts:84,156,200,204,470,508` | 匹配/歧义/写入与 freshness |
| `C/tool/edit-matchers.ts:40` | 有序文本匹配策略 |
| `C/tool/read-file-state.ts:1` | 读取范围、内容与 revision 的内存事实 |
| `C/tool/diff.ts:1` | structured patch，不是 AST |
| `A/fs/index.ts:291,473,700,775` | encoding/line endings/revision/实际 IO |
| `C/runtime/methods/turn-tools.ts:359,370` | 工具闭合后 emitFileMutationCheckpoint |
| `C/runtime/methods/file-rewind.ts:78,93,141` | preview/apply/journal 的文件恢复 |
| `C/runtime/methods/workspace-checkpoints.ts:133` | workspace fork 与目标选择 |

## Key Classes / Functions

- **Confirmed：** `readHandler()` 使用 path + offset/limit 的 read-state key，stat 未变化可返回 file_unchanged；不是每次都发送原文。文本、PDF、图像/视频分别处理。range read 及 partial 标志不能当成完整内容证明。
- **Confirmed：** `assertWritableExistingFileIsFresh()` 检查最近读状态；完整读内容一致时允许 metadata 改变。不存在文件可新建，不要求先读一个不存在文件。
- **Confirmed：** `getEditableReadStateFailure()` 缺 state map 时允许宿主自定义执行；正常 runtime 注入 map。不要把这一可选分支写成全局无条件保护。
- **Confirmed：** `findEditMatch()` 有序回退；replace_all 不用 line_trimmed/indentation_flexible/block_anchor 等 broad matchers。最终替换使用 callback，避免 `$&` 等 replacement token 改变用户文本。
- **Confirmed：** `applyWorkspaceFileRewind()` 先生成 canApply 计划、检查文件是否安全，保存实际当前状态 journal，再恢复 beforeContent 或删除新建文件。不是任意 shell 副作用的撤销器。

## Control Flow

### Code Modification Sequence

```text
模型选文件 → Read → FileSystemPort.stat/read → readFileState
模型产生 Edit/Write → executor schema/resolve/hook/permission
  → resolveWorkspacePath → 重新读取 → read-before-write/stale
  → Edit 的唯一匹配/replace_all 或 Write 的整体 content
  → writeTextFile(expectedRevision, encoding, lineEndings, atomic)
  → adapter check → temp write/sync/rename（异常时直接写 fallback）
  → 更新 readFileState → structured patch / 原始前后内容
  → serializer → 配对 history commit → emitFileMutationCheckpoint
```

### “修复 bug”的实际可用路径

**Confirmed：** 普通 `runRegularTurnLoop()` 可以执行搜索 → Read → Edit/Write → Bash 测试 → tool error/result → 再次模型请求 → 再读/修改 → 最终文本。每个动作都有 handler，循环不限制只运行一次工具。

**Inference：** 这是能力可组合出的修复路径，不是有名为 BugFixWorkflow 的固定必经状态机。是否运行测试、使用什么命令、是否重读由模型和指令决定；没有证据保证“修改后自动跑测试”或“测试通过才结束”。Bash exit code 返回给模型，普通非零退出不等于 Agent 必定 retry。

### Undo / Rollback

**Confirmed：** file rewind 根据 checkpoint 的前后内容/patch 与当前文件事实预览 unsafeFiles；不安全时整体拒绝。apply 记录 journal，并在失败时尝试恢复已改文件；不能据此证明崩溃时 ACID。message fork 的目标保留与 checkpoint rewind 的“修改前”语义不同，代码明确区分。

## Data Flow

Read 的模型文本（含行号/裁剪）与 readFileState 的原始内容不是同一视图。Edit 输入 old_string/new_string 经匹配得到 actualOldString/actualNewString；最终写入保持原 encoding/line endings，memory 文件还可 stamp origin-session。模型拿到成功摘要/预算结果，UI 与 checkpoint 可用 structuredPatch/前后内容，不向模型重复投递全部 diff envelope。

## Important Design Decisions

- **Confirmed：** 权限确认针对解析后的执行事实，文件 freshness 则由 handler + FS revision 维护；两者不能相互替代。
- **Confirmed：** tool result 先按 ID 闭合，再做附加 checkpoint，避免 checkpoint 期间 stop 产生未配对历史。
- **Inference：** tolerant matching 提高可用性，也扩大误匹配评估面；歧义拒绝和 broad replace_all 限制是关键边界。
- **Confirmed：** adapter 的 revision ID 不等于校验全部文件内容，atomic fallback 不等于 OS 隔离。这里只记录设计限制，没有修改代码。

## Unknowns

- **Need Verification：** 未故障注入 rename/direct-write/rewind journal，未测跨平台 mode/encoding，也未运行实际 bug 修复任务。
- **Unknown：** 没有启用的通用 ApplyPatch/AST edit 自动入口；不将 unused/commented 名称作为当前功能。
- **Need Verification：** Shell 修改的任意文件不保证获得与 Edit/Write 相同的前后内容 checkpoint。

## Archify Diagram

- [图 7A · Code Modification Sequence](diagrams/07a-code-modification/code-modification.html)
- [图 7B · Coding Task Workflow](diagrams/07b-coding-workflow/coding-workflow.html)
- [图 7C · Edit / Patch Data Flow](diagrams/07c-edit-data/edit-data.html)

## Next Batch Dependencies

Batch 8 追 Bash 到进程/OS 的边界，区分 permission、路径 policy、网络环境与已撤除的 sandbox。
