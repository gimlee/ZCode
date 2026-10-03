# Batch 21 · 最终交付目录

## Findings

任务 Batch 0～21 已完成，详细报告与图均写入根 `archify/`。本轮续作覆盖 Batch 6～21，保留既有 Batch 0～5。最终按要求提供 [25 个主题入口](topics/README.md)、18 组件 Master Map、30 个重点文件、四档阅读路线、17 项开发地图与 12 条调用链。

## Key Source Files

分析基线 `540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`；真实源码位置见 [30 文件清单](batch-16-reading-path.md)、[精确调用链](batch-20-call-chains.md) 和 [图 source index](evidence/diagram-source-index.json)。任务依据 [archify-promt.md](../promt/archify-promt.md)，没有修改应用实现。

## Key Classes / Functions

最终核心对象索引见 [Batch 15](batch-15-abstractions-debt.md) 的 18 个抽象；方法追踪见 Batch 20，不新增一个仅用于文档的“万能 Agent/RepoMap/MemoryManager”来填补源码缺失。

## Control Flow

阅读入口：[Master Map](diagrams/19-master/master.html) → [25 Topics](topics/README.md) → 专题 Batch → 方法链/真实源码 → 对应图。实施入口：阅读路线 → development map → 目标 spec/架构受控上下文 → 行为测试/实现/实际检查。本轮只完成研究交付，未实施建议改造。

## Data Flow

`batch-*.md` 保存详细分析；`topics/` 按任务最终目录重组为轻量导航，避免重复事实漂移；`diagrams/` 保存 candidate、HTML 与 finalize/browser receipts；`evidence/` 保存当前哈希、源码锚点、链接检查、测试清单与命令输出。review 子目录保留布局修订证据，索引只选与当前 spec/HTML hash 匹配的成功 receipt。

## Important Design Decisions

- 图共 **35 张**，其中本轮新增 20 张。覆盖任务要求的全部已确认机制与更多专题视图。
- 唯一条件性缺图为 **Testing Architecture**：当前提交只有四个迁移/退役测试，缺少 Agent/Provider/Tool/E2E/Eval 体系证据，按 Batch 14 的明确条件只交文字，不为了清单补虚构设施。
- 初始 Repository Map 仍作包导航，最终 Master Map 作为研究入口；图节点 source links pin 当前基线。
- 九个固定栏目、源码锚点/链接及图验收证据统一检查，报告确认事实与运行验证分开。

## Unknowns

源码分析没有替代真实运行/故障注入；在线模型、MCP、平台进程与远端链路均未启动。没有人工截图视觉审查。typecheck/lint 因当前缺依赖而失败，原始证据与真实结果见 [validation](validation.md)。旧 .archify/ 不是本轮基线依据，原有 promt/ 本地内容保留。

## Archify Diagram

[完整图目录与批次链接](README.md)；[Master Map](diagrams/19-master/master.html)；[35 图哈希/验收索引](evidence/artifacts.json)。自动四道 gate 结果与 route advisory 见 [验证报告](validation.md)，不将自动通过表述成人工视觉通过。

## Next Batch Dependencies

本任务没有未完成 Batch。后续如需实际改造或补齐测试，可从 Batch 18 的具体接缝和 Batch 14 的验收缺口另立需求；本轮不扩展到安装依赖、修改代码或上线。
