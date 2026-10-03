# Batch 19 · ZCode Master Architecture Map

基线同 [README](README.md)，图中全部 18 个核心节点关联当前 revision 的真实源码。

## Findings

Master Map 以产品输入 → Host → CLI/App → Session Runtime → Model/Provider 为主线，第二条分支是 Runtime → Tool Executor → FS/Shell/MCP；Context/History、Storage、extensions 与 workspace/attachment 给出执行所需的事实与生命周期边界。它是研究入口，不是完整 import dependency graph。

## Key Source Files

节点源码锚点保留在 [candidate.json](diagrams/19-master/candidate.json)，所有图的锚点合并到 [source index](evidence/diagram-source-index.json)。18 个责任对应 [Batch 16 的 30 文件](batch-16-reading-path.md) 和 [开发地图](batch-18-development-map.md)。

## Key Classes / Functions

Host facade、App、Gateway/Inbox、AgentRuntime、ContextBuilder、MessageHistoryImpl、ExecutableModel、ToolRegistry/Scheduler/Executor、Node FS/Exec/MCP、SqliteSessionStore。框名为责任聚合，未将 “History / Events” 误写成源码存在的单一类；主要精确符号见 Batch 15/20。

## Control Flow

从 UI 和 Host 输入经 trusted route/admission 到 Runtime queue，再进入 turn loop。Context/history 构造 ModelRequest；adapter 做协议请求；本地 final tools 经 executor，返回配对结果进入下次请求。Main 与 mobile attachment 在外层生命周期边界，不接管业务 queue。

## Data Flow

图用少量边展示主通路，省略每条返回线与所有事件订阅。持久化边表示事实经过 Runtime persistence ports 写入 store，并非 MessageHistory 直接依赖具体 SQLite；Host→App 的 stdio 边包含 process client/protocol，非直接 JS 函数调用。完整往返、恢复和身份字段见 Batch 9/10/12/20。

## Important Design Decisions

只保留 18 个组件满足 15～25 的限制。源码链接 pin 到分析基线；节点涵盖 Repository/Workspace/Storage/Events/Plugins 的实际责任，同时避免虚构 RepoMap/LSP/vector store 或 IDE extension。独立的 Master Map 在所有专题结论完成后编写，替代初始图作为全局入口，初始图仍保留作包导航。

## Unknowns

没有动态 tracing、真实部署拓扑或包 import graph 全量计算。图不能证明性能、隔离强度或线上可用性；自动验收与未人工视觉审查的限度见 validation。

## Archify Diagram

[打开 ZCode Master Architecture Map](diagrams/19-master/master.html)。配套规格、four-gate receipt、browser evidence 与 hash 均保留；参见 [validation](validation.md)。

## Next Batch Dependencies

Batch 20 提供 12 条精确链；Batch 21 将 Master Map 设为最终 25 主题目录的入口之一。
