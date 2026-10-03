# 14 Event Concurrency

event seq、durable facts 和 live sinks 有顺序；model streaming queue、Inbox 和 Runtime command queue 是不同串行点。background task 与 model attempt 各有 lifecycle/admission。

[详细源码分析](../batch-10-events-concurrency.md) · [Archify 图](../diagrams/10b-concurrency/concurrency.html) · [证据与验证](../validation.md)

[25 主题目录](README.md) · [总入口](../README.md)
