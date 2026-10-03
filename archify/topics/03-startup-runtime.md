# 03 Startup Runtime

进程共享存储/Registry/protocol connection 先启动；session App/Runtime 按请求创建。Context 惰性初始化，资源关闭遵守 owns/shared。

[详细源码分析](../batch-1-startup-runtime.md) · [Archify 图](../diagrams/01a-startup/startup.html) · [证据与验证](../validation.md)

[25 主题目录](README.md) · [总入口](../README.md)
