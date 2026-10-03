# ZCode 深度源码分析与 Archify 可视化任务

你现在要对当前 ZCode 代码仓库进行一次系统性的源码级逆向分析。

目标不是生成一张简单的架构图，也不是总结 README，而是让我最终能够真正理解：

- ZCode 本质是什么
- 整个程序如何启动
- Agent Runtime 如何运转
- Agent Loop 在哪里
- Prompt 如何构造
- Context 如何管理
- LLM Provider 如何接入
- Tool 如何注册、调度和执行
- Agent 如何理解代码仓库
- Agent 如何修改文件
- Shell 如何执行
- Session / State 如何保存
- MCP / Skill / Plugin 如何扩展
- Coding Task 如何从用户请求运行到完成
- 出错后如何 Retry / Recover
- 如何测试
- 哪些代码是项目真正核心
- 如果我要二次开发，应从哪里修改

---

# 一、基本原则

整个分析必须遵循以下原则。

## 1. 源码优先

不要根据：

- README
- 项目宣传文档
- 文件名
- 目录名

直接推断系统行为。

README 可以作为线索，但最终结论必须尽量由实际源码验证。

优先依据：

- Entry Point
- Class
- Function
- Method
- Interface
- Type
- Import
- Factory
- Registry
- Dependency Injection
- Runtime Registration
- Event Handler
- Actual Call Site

---

## 2. 所有重要结论尽量提供源码定位

格式：

`path/to/file.ts`

`ClassName.methodName()`

或者：

`module → class → function`

重要调用链必须尽量追踪到实际函数。

---

## 3. 区分事实与推测

如果源码已经确认：

标记：

`Confirmed`

如果只是根据代码结构推测：

标记：

`Inference`

如果无法确认：

标记：

`Unknown / Need Verification`

禁止把推测包装成事实。

---

## 4. Archify 用于绘图，不代替源码分析

Codex 负责：

- 搜索源码
- 追调用链
- 理解 Runtime
- 理解数据结构
- 分析设计

Archify 负责将已经确认的结构生成：

- Architecture
- Workflow
- Sequence
- Data Flow
- Lifecycle

不要为了画图而猜测不存在的关系。

---

## 5. 不要生成一张巨型架构图

每个主题独立生成一张图。

最终形成：

- Master Map
- Runtime 图
- Agent Loop 图
- Context 图
- LLM 调用图
- Provider 图
- Tool 图
- Repository Understanding 图
- File Editing 图
- Session / State 图
- MCP / Plugin 图
- Coding Workflow 图

---

# 二、工作方式

整个任务分为多个 Batch。

必须按照顺序执行。

每个 Batch 完成后：

1. 输出分析结论
2. 输出关键源码位置
3. 输出调用链
4. 使用 Archify 生成对应技术图
5. 保存当前结论，供后续 Batch 使用
6. 不要重新分析已经确认过的内容，除非发现冲突

---

# Batch 0：项目侦察与分析计划

这一阶段不要立即深入所有代码。

首先快速建立整个项目的基本认识。

分析：

- Repository 根目录
- package / workspace
- src
- apps
- packages
- core
- runtime
- cli
- ui
- server
- provider
- tools
- agent
- session
- storage
- plugin
- mcp
- tests

实际存在什么就分析什么。

---

## 找出项目入口

寻找：

- CLI entry
- main()
- bootstrap
- server entry
- desktop entry
- IDE entry
- web entry

---

## 找出核心模块候选

初步判断：

- Agent
- Runtime
- Session
- Model
- Provider
- Context
- Prompt
- Tool
- Repository
- Workspace
- Storage
- Event
- MCP
- Plugin

分别可能位于哪里。

---

## 输出

生成：

# ZCode Initial Repository Map

包含：

### 项目语言与技术栈

### Monorepo / Single Repo

### Entry Points

### Core Modules

### External Dependencies

### 疑似核心源码目录

### 后续分析路线

---

## Archify

生成：

### 图 0：Repository High-Level Architecture

注意：

这一张只是初始导航图。

不要画过多细节。

只展示：

10～20 个一级核心模块。

---

# Batch 1：启动流程与 Runtime

这一阶段只研究：

程序如何启动。

---

## 1. 找到真实入口

从：

CLI

Desktop

Server

IDE

中选主要运行入口。

如果有多个入口分别说明。

---

## 2. 从入口追踪初始化

完整追踪：

Entry Point

→ CLI Args

→ Config

→ Dependency Initialization

→ Runtime

→ Model Provider

→ Tool Registry

→ MCP

→ Plugin

→ Session

→ Agent

→ Ready

---

## 3. 找 Runtime

重点寻找：

Runtime

Application

App

Engine

Core

Service Container

Dependency Injection Container

类似核心对象。

回答：

谁拥有整个应用生命周期？

---

## 4. 找依赖初始化顺序

例如：

Config

→ Logger

→ Storage

→ Model

→ Tools

→ Agent

实际顺序是什么？

---

## 输出

### Startup Call Chain

要求精确到函数：

A()

↓

B()

↓

C()

---

### Runtime Object Map

说明：

谁创建谁。

谁持有谁。

---

## Archify

生成两张图。

### 图 1A：Startup Lifecycle

展示程序启动全过程。

### 图 1B：Runtime Architecture

展示 Runtime 核心对象关系。

---

# Batch 2：Agent Runtime 与 Agent Loop

这是整个项目最重要的一阶段。

必须优先深入源码。

---

## 1. 找到 Agent 类型

搜索：

Agent

AgentRunner

AgentExecutor

Loop

Run

Step

Turn

Task

Conversation

等对象。

---

## 2. 找到真正控制 Agent 循环的地方

必须回答：

- 谁调用 LLM
- 谁处理 LLM Response
- 谁检测 Tool Call
- 谁执行 Tool
- 谁把 Tool Result 放回 Context
- 谁再次调用 LLM
- 谁决定任务完成

---

## 3. Agent Loop

找出：

while

for

recursive call

state machine

event loop

实际使用的机制。

---

## 4. Stop Conditions

分析：

- final answer
- max turns
- max tokens
- cancellation
- error
- explicit finish
- timeout

---

## 5. Retry

分析：

- Model Retry
- Tool Retry
- Parse Retry
- Recover
- Resume

---

## 6. Planning

判断是否存在：

- ReAct
- Plan and Execute
- Planner
- Executor
- Reviewer
- Reflection
- Critic
- Todo
- Task Graph

如果不存在，不要强行套。

---

## 输出

### Agent Core Classes

### Agent Runtime Call Chain

### Agent Loop Pseudocode

注意：

这里的 pseudocode 只用于描述逻辑，不是修改代码。

### Stop Conditions

### Retry Logic

### Planning Model

---

## Archify

生成：

### 图 2A：Agent Runtime Workflow

用户任务：

User

→ Agent

→ Model

→ Tool

→ Model

→ Final

---

### 图 2B：Agent Loop Lifecycle

重点展示：

Receive Task

→ Build Context

→ Call Model

→ Tool?

→ Execute Tool

→ Add Tool Result

→ Call Model

→ Finished?

---

### 图 2C：Agent Loop State Machine

如果源码存在明确状态。

---

# Batch 3：Prompt 与 Context

这一阶段只分析：

模型到底看到了什么。

---

# Prompt

找到：

System Prompt

Developer Prompt

Agent Prompt

User Prompt

Tool Prompt

Project Instructions

Repository Instructions

Skill Instructions

Rules

---

## 1. Prompt 来源

分析：

每一部分从哪里来。

---

## 2. Prompt 拼装

找到最终构建 Model Request 的地方。

追踪：

System

+

Rules

+

Context

+

Conversation

+

Tools

+

User Message

实际是什么顺序。

---

# Context

重点分析：

Conversation History

Repository Content

Tool Result

Memory

Summary

Token Limit

---

## 3. Context Window 管理

找：

ContextManager

ContextBuilder

MessageManager

History

Compression

Pruning

Truncate

Summary

---

## 4. Context 超限

分析：

- truncate
- summarize
- drop old messages
- tool result compression
- repository context reduction

---

## 5. Tool Result

Tool Result 是否全部进入下一轮？

大型输出如何处理？

---

## 6. Repository Context

代码文件如何进入 Context？

---

## 输出

### Final Model Context Composition

必须回答：

“一次 LLM 请求真正发送了哪些内容？”

---

### Context Management Strategy

判断属于：

- Full History
- Sliding Window
- Token Pruning
- Summary
- Hybrid

---

## Archify

生成：

### 图 3A：Prompt Composition Data Flow

### 图 3B：Context Lifecycle

### 图 3C：Model Context Data Flow

---

# Batch 4：Model / Provider

这一阶段完整研究 LLM 层。

---

## 1. Model Abstraction

找到：

Model

LLM

Provider

Client

Adapter

Inference

---

## 2. Provider Interface

分析：

统一接口是什么？

---

## 3. Provider Implementations

实际支持哪些 Provider：

例如：

OpenAI

Anthropic

Gemini

OpenRouter

Ollama

Custom OpenAI Compatible

以源码为准。

---

## 4. Message Conversion

项目内部 Message 如何转成 Provider API Message？

---

## 5. Tool Calling Conversion

Tool Schema 如何转成：

OpenAI Tool

Anthropic Tool

Gemini Function

---

## 6. Streaming

如何处理：

delta

stream

partial response

tool delta

reasoning delta

---

## 7. Reasoning

检查是否支持：

reasoning effort

thinking budget

reasoning content

thinking blocks

---

## 8. Model Capability

寻找：

Capabilities

Features

Model Metadata

Context Length

Tool Support

Vision

Reasoning

JSON

---

## 9. Retry

Provider API 出错如何处理？

Rate Limit 如何处理？

---

## 10. 新 Provider

回答：

我要增加一个 Provider，需要修改哪些位置？

---

## Archify

生成：

### 图 4A：Model Provider Architecture

### 图 4B：LLM Request Sequence

### 图 4C：Provider Adapter Data Flow

---

# Batch 5：Tool System

这是第二核心模块。

---

## 1. Tool Abstraction

找到：

Tool

ToolDefinition

ToolSchema

ToolRegistry

ToolExecutor

ToolDispatcher

---

## 2. Tool 注册

工具在哪里注册？

启动时注册？

动态发现？

Plugin 提供？

MCP 提供？

---

## 3. Tool Schema

Tool Schema 如何转换成模型可理解格式？

---

## 4. Tool Call

完整追踪：

Model Response

→ Tool Call Parse

→ Tool Lookup

→ Permission

→ Execute

→ Result

→ Model

---

## 5. 核心 Tool

实际找出：

Read

Write

Edit

Patch

Search

Grep

Glob

Shell

Git

Browser

Web

MCP

如果存在。

---

## 6. Parallel Tool

是否允许一个 Model Response 同时执行多个 Tool？

是否并发？

---

## 7. Error

Tool 失败之后：

如何返回模型？

是否 Retry？

---

## 输出

### Tool Registry

### Tool Execution Chain

### Tool Result Format

### Native vs MCP Tool

---

## Archify

生成：

### 图 5A：Tool Architecture

### 图 5B：Tool Call Sequence

### 图 5C：Tool Result Data Flow

---

# Batch 6：Repository Understanding

这一阶段重点回答：

ZCode 到底怎么理解大型代码仓库。

---

## 1. 文件发现

是否使用：

walk

glob

git ls-files

ripgrep

---

## 2. Search

寻找：

grep

ripgrep

search

symbol search

semantic search

---

## 3. Code Intelligence

检查：

LSP

Tree-sitter

AST

Symbol Index

Call Graph

Dependency Graph

Embedding

Vector DB

Repo Map

---

## 4. Repository Index

判断：

是启动时构建索引，

还是完全按需搜索。

---

## 5. File Selection

Agent 如何决定读哪些文件？

---

## 6. Large Repository

大型仓库有什么优化？

---

## 7. Repository Context

搜索结果如何进入 Context？

---

## 最终判断

把 ZCode 归类为：

A. Full Repository Index

B. Text Search Driven

C. LSP / Symbol Driven

D. Semantic Search Driven

E. Agent On-demand Exploration

F. Hybrid

允许多个。

但必须说明源码依据。

---

## Archify

生成：

### 图 6A：Repository Understanding Workflow

### 图 6B：Repository Context Data Flow

---

# Batch 7：文件修改与 Coding Workflow

这一阶段研究 Coding Agent 真正怎么改代码。

---

## 1. Read

Agent 如何读取文件？

---

## 2. Edit

采用：

- replace
- overwrite
- patch
- diff
- AST
- structured edit

哪种机制？

---

## 3. Patch

如果支持 Patch：

分析 Patch 构造与应用。

---

## 4. Validation

有没有：

- original content check
- line match
- conflict detection
- checksum
- diff check

---

## 5. Diff

修改后如何生成 Diff？

---

## 6. Undo / Rollback

是否支持？

---

## 7. Test

修改后如何运行测试？

---

## 8. Coding Workflow

追踪一个完整案例：

用户：

“修复某个 bug”

然后：

Understand Task

→ Search Repository

→ Read Code

→ Modify

→ Test

→ Error

→ Re-read

→ Fix

→ Test

→ Final

必须找到真实代码支持的路径。

---

## Archify

生成：

### 图 7A：Code Modification Sequence

### 图 7B：Coding Task Workflow

### 图 7C：Edit / Patch Data Flow

---

# Batch 8：Shell / Sandbox / Permission / Security

---

## Shell

分析：

- process spawning
- command runner
- cwd
- env
- stdout
- stderr
- exit code
- timeout
- cancellation

---

## Runtime Environment

判断命令运行在：

- host
- subprocess
- Docker
- container
- sandbox
- VM
- remote worker

---

## 权限

分析：

- file access
- shell permission
- network access
- environment variables
- secrets
- git credentials

---

## Dangerous Command

搜索：

allow

deny

approval

permission

policy

sandbox

---

## Human Approval

是否存在执行前确认？

---

## Archify

生成：

### 图 8A：Shell Execution Sequence

### 图 8B：Security Boundary Architecture

如果源码没有明确安全边界，不要虚构。

---

# Batch 9：Session / State / Persistence

---

## Session

分析：

Session 创建

Session ID

Conversation

Agent

Workspace

Model

Tools

---

## State

区分：

Application State

Session State

Agent State

Conversation State

Task State

Tool State

UI State

---

## Persistence

检查：

SQLite

JSON

Filesystem

Database

KV

Local Storage

---

## Resume

任务关闭以后是否能恢复？

---

## Checkpoint

是否存在 Checkpoint？

---

## Multiple Sessions

是否允许多个 Session？

是否并发？

---

## Archify

生成：

### 图 9A：Session Lifecycle

### 图 9B：State Architecture

### 图 9C：Persistence Data Flow

---

# Batch 10：Event / Async / Concurrency

---

## Event System

搜索：

EventBus

Emitter

PubSub

Observer

Message

Stream

WebSocket

---

## 找出重要 Event

例如：

AgentStarted

ModelStarted

ModelFinished

ToolStarted

ToolFinished

MessageAdded

SessionUpdated

TaskFinished

---

## Async

分析：

async / await

thread

worker

queue

process

---

## 并发

判断：

多个 Agent

多个 Tool

多个 Session

是否能并发。

---

## Race Condition

找共享状态。

---

## Archify

生成：

### 图 10A：Event Flow

### 图 10B：Concurrency Architecture

---

# Batch 11：MCP / Skill / Plugin / Extension

---

## MCP

分析：

Client

Server

Discovery

Transport

Tool Registration

Tool Execution

---

## MCP Tool

回答：

MCP Tool 是否最终进入统一 Tool Registry？

---

## Skill

如果存在 Skill：

分析：

加载

解析

什么时候加入 Context

什么时候触发

---

## Plugin

如果存在 Plugin：

分析生命周期。

---

## Hook

搜索：

before

after

middleware

hook

interceptor

---

## Extension Points

总结项目的主要扩展点。

---

## Archify

生成：

### 图 11A：Extension Architecture

### 图 11B：MCP Tool Sequence

### 图 11C：Skill / Plugin Lifecycle

---

# Batch 12：CLI / UI / IDE 通信

---

## CLI

分析：

CLI 是否只是 presentation layer，

还是直接承担 Runtime 逻辑。

---

## UI

如果有 Web / Desktop UI：

分析：

UI

→ Backend

→ Runtime

的通信。

---

## IPC

检查：

HTTP

WebSocket

RPC

IPC

stdio

---

## Runtime Separation

回答：

核心 Agent Runtime 是否可以脱离 UI 独立运行？

---

## Archify

生成：

### 图 12A：Frontend / Runtime Architecture

### 图 12B：UI Request Sequence

---

# Batch 13：Error / Retry / Recovery

---

分析以下错误：

Model API Error

Rate Limit

Timeout

Invalid Model Response

Invalid Tool Call

Tool Error

Shell Error

File Error

Context Overflow

User Cancellation

Internal Runtime Error

---

## Retry

分别找到：

Model Retry

Tool Retry

Request Retry

Provider Retry

---

## Recovery

是否支持：

Resume

Checkpoint

Rollback

Fallback Model

Provider Failover

---

## Archify

生成：

### 图 13A：Error Recovery Workflow

### 图 13B：Retry Lifecycle

---

# Batch 14：Testing / Eval

---

## Test Architecture

寻找：

Unit Test

Integration Test

E2E

Mock LLM

Mock Provider

Tool Test

Agent Test

---

## Agent Behaviour Test

项目如何测试 Agent 行为？

---

## Provider Test

不同 Provider 如何测试？

---

## Tool Test

Tool 有没有独立测试？

---

## Eval

是否存在：

benchmark

eval

SWE-bench

coding task benchmark

golden test

---

## Archify

如果测试体系较完整：

生成：

### 图 14：Testing Architecture

否则只输出文字。

---

# Batch 15：设计模式、技术债、扩展性

这一阶段主要做文字分析。

---

## 核心抽象

找出最重要的 10～20 个对象：

例如：

Agent

Runtime

Session

Model

Provider

Context

Message

Tool

Workspace

Task

Event

---

## 设计模式

实际判断：

Strategy

Factory

Adapter

Registry

Observer

Command

State

Dependency Injection

Plugin

---

不要强行套模式。

---

## 技术债

检查：

God Object

Provider 特殊判断

循环依赖

过多全局状态

重复 Tool 逻辑

Prompt 与业务耦合

UI 与 Runtime 耦合

异常吞掉

测试覆盖不足

---

## 扩展难度

分别回答：

增加 Provider

增加 Tool

增加 Agent

增加 MCP

增加 Skill

修改 Agent Loop

增加 Memory

增加 Repository Search

---

# Batch 16：核心源码阅读路线

这是非常重要的最终文字成果。

---

## 找出 30 个最重要文件

按重要程度排序。

不要按文件大小排序。

---

每个文件输出：

### 文件路径

### 核心作用

### 为什么重要

### 主要 Class / Function

### 应该在什么时候读

---

## 再给阅读路线

### 30 分钟

只了解整体。

### 2 小时

理解核心 Runtime。

### 1 天

理解整个 Agent。

### 3 天

达到可以二次开发的程度。

---

# Batch 17：Minimal Core

回答：

如果删除 ZCode 80% 的代码，

只保留它最核心的 20%，

应该保留什么？

---

例如：

Runtime

+

Agent Loop

+

Context

+

Provider

+

Tool

+

Workspace

但必须基于 ZCode 实际源码判断。

---

输出：

# ZCode Minimal Core

并列出对应源码路径。

---

# Batch 18：二次开发地图

假设我要开始修改 ZCode。

回答：

修改 System Prompt 去哪里？

修改 Agent Loop 去哪里？

增加 Provider 去哪里？

增加 Tool 去哪里？

修改 Tool Dispatcher 去哪里？

修改 Context 管理去哪里？

修改 Context Compression 去哪里？

修改 Repository Search 去哪里？

修改 File Edit 去哪里？

修改 Shell 去哪里？

修改 Session 去哪里？

修改 MCP 去哪里？

修改 Skill 去哪里？

修改 Plugin 去哪里？

增加 Logging 去哪里？

修改 Retry 去哪里？

修改 Model Capability 去哪里？

---

形成：

# ZCode Development Map

---

# Batch 19：最终 Archify Master Map

完成所有前置分析后，

重新生成最终的：

# ZCode Master Architecture Map

这张图不是普通架构图。

它应该作为整个源码研究的入口。

只保留 15～25 个最核心组件。

---

建议按层组织：

User Interface

↓

Session / Task

↓

Agent Runtime

↓

Context / Prompt

↓

Model Abstraction

↓

Provider

和：

Agent Runtime

↓

Tool System

↓

File / Shell / Search / MCP

以及：

Repository

Workspace

Storage

Events

Plugin

---

所有核心节点尽量关联真实源码。

---

# Batch 20：最终完整调用链

最后整理以下 12 条链：

## 1. Startup

Entry

→ Runtime

→ Agent

## 2. User Message

User

→ Agent

## 3. Context Build

Message

→ Context

## 4. Prompt Build

Instructions

→ Model Request

## 5. LLM

Agent

→ Provider

→ Model

## 6. Model Streaming

Model

→ Agent

## 7. Tool Call

Model

→ Tool Executor

## 8. Shell

Tool

→ OS

## 9. File Read

Agent

→ File

## 10. File Edit

Agent

→ Patch

## 11. Repository Search

Agent

→ Search

→ Context

## 12. Task Completion

Agent Loop

→ Final Answer

每条调用链：

必须尽量精确到：

`Class.method()`

并附源码位置。

---

# Batch 21：最终交付目录

最终将所有分析整理为：

# 01 Project Overview

# 02 Master Architecture

# 03 Startup Runtime

# 04 Agent Runtime

# 05 Agent Loop

# 06 Prompt

# 07 Context

# 08 Model Provider

# 09 Tool System

# 10 Repository Understanding

# 11 File Editing

# 12 Shell Sandbox Security

# 13 Session State

# 14 Event Concurrency

# 15 MCP Skill Plugin

# 16 UI CLI

# 17 Error Recovery

# 18 Testing Eval

# 19 Core Abstractions

# 20 Technical Debt

# 21 Extension Guide

# 22 Minimal Core

# 23 Source Code Reading Path

# 24 Development Map

# 25 Critical Call Chains

---

# 最终 Archify 图清单

最终至少应该存在：

1. Repository High-Level Architecture
2. Startup Lifecycle
3. Runtime Architecture
4. Agent Runtime Workflow
5. Agent Loop Lifecycle
6. Agent Loop State Machine
7. Prompt Composition Data Flow
8. Context Lifecycle
9. Model Context Data Flow
10. Model Provider Architecture
11. LLM Request Sequence
12. Tool Architecture
13. Tool Call Sequence
14. Repository Understanding Workflow
15. Repository Context Data Flow
16. Code Modification Sequence
17. Coding Task Workflow
18. Shell Execution Sequence
19. Session Lifecycle
20. State Architecture
21. Event Flow
22. MCP / Extension Architecture
23. Error Recovery Workflow
24. Testing Architecture
25. ZCode Master Architecture Map

如果某一种机制源码中不存在，

不要为了凑图而生成。

---

# 非常重要：分析质量要求

禁止输出这种低价值分析：

“src 保存源代码。”

“utils 保存工具函数。”

“config 保存配置。”

“agent 模块负责 Agent。”

这种描述没有意义。

我要的是：

## Control Flow

谁调用谁。

## Data Flow

数据怎么走。

## Runtime

系统怎么跑。

## State

状态存在哪里。

## Abstraction

核心抽象是什么。

## Extension Point

从哪里扩展。

---

# 调研优先级

如果分析过程中上下文压力变大，

优先保证以下内容分析完整：

1. Agent Loop
2. Context Management
3. Model / Provider
4. Tool System
5. Repository Understanding
6. File Editing
7. Shell Execution
8. Session / State
9. Prompt
10. MCP / Skill / Plugin
11. Error / Retry
12. UI

UI 可以最后。

---

# 每个 Batch 的固定输出格式

每完成一个 Batch，统一输出：

## Findings

核心结论。

## Key Source Files

关键文件。

## Key Classes / Functions

核心类和函数。

## Control Flow

调用关系。

## Data Flow

如果存在。

## Important Design Decisions

关键设计。

## Unknowns

仍无法确认的问题。

## Archify Diagram

生成对应 Archify 图。

## Next Batch Dependencies

下一阶段需要继续验证什么。

---

# 最终目标

完成全部工作后，我应该能够回答：

“ZCode 是如何工作的？”

而不是只能回答：

“ZCode 有哪些模块。”

最终结果需要达到：

一个新的高级开发者，只依靠这份分析，就能够在较短时间内定位 ZCode 的核心实现，并开始二次开发。