const {node:n,sequence:s,dataflow:d,workflow:w,architecture:a}=require('./author-diagrams.cjs');
w('06a-repository-workflow','repository-workflow','图 6A · Repository Understanding Workflow', [['model','模型决策与历史'],['io','按需检索与读取']], [
 [n('task','任务与已有上下文','不预装全仓库','C/runtime/methods/turn-loop.ts:109'),'model',0],
 [n('choose','模型选择工具','Bash / direct 分支','C/runtime/methods/turn-model-step.ts:1'),'model',1],
 [n('permit','执行前检查','schema / hooks / permission','C/tool/executor/call-runner.ts:65','security'),'io',1],
 [n('search','搜索范围','find / grep / rg 或 FS','A/exec/embedded-search-prelude.ts:34'),'io',2],
 [n('read','定向 Read','路径 / offset / limit','C/tool/handlers/read.ts:141'),'io',3],
 [n('result','工具结果预算','preview / artifact','C/tool/executor/result-serialization.ts:46'),'io',4],
 [n('context','下一步请求','paired tool entries','C/runtime/helpers/provider-request-messages.ts:48'),'model',4],
 [n('decide','继续或回答','模型判断是否足够','C/runtime/methods/turn-loop.ts:205'),'model',5]
 ],[['task','choose','请求'],['choose','permit','tool call'],['permit','search','允许'],['search','result','匹配结果'],['choose','read','选择 Read'],['read','result','文件内容'],['result','context','提交'],['context','decide','再次模型']],['task','choose','permit','search','result','context','decide'],[['按需探索','默认 embedded Bash 搜索；direct Grep/Glob 是配置分支','Read 是独立的下一次工具选择，搜索不自动读取全文'],['可用能力边界','未确认普通 Agent 使用语义索引、LSP 或全仓库 Repo Map','大结果预算约束模型输入，不保证限制所有遍历成本']]);
d('06b-repository-context','repository-context','图 6B · Repository Context Data Flow',['仓库事实','工具视图','预算与归属','模型输入'],[
 [n('files','文件内容','由 FS 或子进程读取','A/fs/index.ts:115','database'),0,0],
 [n('instructions','指令与 memory','有限 snapshot / index','A/context/index.ts:102','database'),0,1],
 [n('read','Read / 搜索输出','匹配与定向内容','C/tool/handlers/read.ts:200'),1,0],
 [n('prefix','Context prefix','system + meta-user','C/context/builder.ts:87'),1,1],
 [n('budget','序列化结果','截断 / artifact preview','C/tool/executor/result-serialization.ts:46'),2,0],
 [n('history','History entries','保留来源与 toolCallId','C/runtime/methods/turn-tools.ts:359','database'),2,1],
 [n('request','Provider 请求视图','投影，不回写原 history','C/runtime/helpers/provider-request-messages.ts:48'),3,1]
 ],[['files','read','按需读取'],['instructions','prefix','初始化'],['read','budget','output'],['budget','history','tool entry'],['prefix','history','prefix'],['history','request','投影']], [['不同输入来源','AGENTS / memory 不等于全仓库源码','匹配路径、文件全文和模型可见 preview 必须区分']]);
s('07a-code-modification','code-modification','图 7A · Code Modification Sequence',[
 n('model','模型','选择 Read / Edit','C/runtime/methods/turn-loop.ts:205'),n('exec','Executor','权限与 lifecycle','C/tool/executor/call-runner.ts:65'),n('handler','Read / Edit','freshness / matcher','C/tool/handlers/edit.ts:156'),n('fs','FS Adapter','revision + 实际 IO','A/fs/index.ts:291'),n('history','History','配对后 checkpoint','C/runtime/methods/turn-tools.ts:359','database')
 ],[['model','exec','Read call'],['exec','handler','允许后调用'],['handler','fs','stat / read'],['fs','handler','内容与 revision','return'],['handler','model','读取视图','return'],['model','exec','Edit call'],['exec','handler','解析与许可'],['handler','fs','重新读取'],['fs','handler','当前内容','return'],['handler','fs','匹配成功后写入'],['fs','handler','新 revision','return'],['handler','history','result / patch'],['history','model','提交后下一步','return']], [['写入条件','读前写、唯一匹配与 expectedRevision 是不同检查','Edit 是文本替换；内置 ApplyPatch 未启用'],['实际 IO','temp / sync / rename 失败时存在直接写 fallback','checkpoint 是 tool result 闭合后的附加操作']]);
w('07b-coding-workflow','coding-workflow','图 7B · Coding Task Workflow',[['decision','普通模型循环'],['tools','可组合工具路径']], [
 [n('task','修复请求','已有 context 与用户目标','C/runtime/methods/turn-loop.ts:109'),'decision',0],
 [n('model','模型选动作','没有固定 BugFix 状态机','C/runtime/methods/turn-loop.ts:205'),'decision',1],
 [n('search','搜索 / Read','按需发现与理解','C/tool/handlers/read.ts:141'),'tools',1],
 [n('edit','Edit / Write','匹配与 freshness','C/tool/handlers/edit.ts:204'),'tools',2],
 [n('test','Bash 测试','模型选择实际命令','C/tool/handlers/bash.ts:97'),'tools',3],
 [n('result','成功或错误结果','不自动重跑 handler','C/runtime/methods/turn-tools.ts:235'),'tools',4],
 [n('next','后续模型步骤','可重读、再改、再测','C/runtime/methods/turn-loop.ts:205'),'decision',4],
 [n('final','最终回答','沿用普通 Loop 结束规则','C/runtime/methods/turn-loop.ts:109'),'decision',5]
 ],[['task','model','输入'],['model','search','工具选择'],['search','result','读取结果'],['model','edit','工具选择'],['edit','result','改动结果'],['model','test','可选测试'],['test','result','exit/output'],['result','next','下一请求'],['next','final','完成判断']],['task','model','search','result','next','final'],[['能力组合','搜索、修改和测试均有实际 handler 支持','箭头不表示每个修复都必经测试'],['反馈循环','失败返回模型后可发新 call，不等于通用 Tool Retry','checkpoint 不撤销任意 shell / network 副作用']]);
d('07c-edit-data','edit-data','图 7C · Edit / Patch Data Flow',['输入事实','文本转换','写入与状态','结果视图'],[
 [n('input','old / new string','或 Write 的完整 content','C/tool/handlers/edit.ts:84'),0,0],
 [n('current','当前文件与读状态','revision / partial 标志','C/tool/handlers/edit.ts:156','database'),0,1],
 [n('match','匹配与歧义检查','exact 优先；有序回退','C/tool/edit-matchers.ts:40'),1,0],
 [n('fresh','freshness','缺读 / stale 时失败','C/tool/handlers/edit.ts:421','security'),1,1],
 [n('write','FS 写入','expectedRevision / encoding','A/fs/index.ts:291'),2,0],
 [n('state','更新 readFileState','实际写后内容与 revision','C/tool/handlers/edit.ts:523','database'),2,1],
 [n('patch','patch / 前后内容','UI、checkpoint 与 rewind','C/tool/handlers/edit.ts:470','database'),3,0],
 [n('model','模型结果','summary / budget preview','C/tool/executor/result-serialization.ts:46'),3,1]
 ],[['input','match','参数'],['current','match','content'],['current','fresh','比较'],['fresh','write','通过'],['match','write','newContent'],['write','state','revision'],['write','patch','差异数据'],['state','model','结果']], [['Patch 的含义','structured patch 是结果/恢复数据，不是启用 ApplyPatch 工具','匹配失败不写文件；写后更新内存状态']]);
s('08a-shell','shell','图 8A · Shell Execution Sequence',[
 n('core','Core Bash','解析与权限后','C/tool/handlers/bash.ts:97'),n('port','ExecutionPort','前台 / 后台 lifecycle','C/tool/handlers/bash.ts:187'),n('adapter','Node Adapter','shell/env/cwd 准备','A/exec/node-execution-adapter-process.ts:58'),n('os','OS 子进程','Agent 所在宿主','A/exec/node-execution-adapter-run.ts:197','external'),n('output','输出与返回','preview / 持久化','A/exec/node-execution-adapter-run.ts:25','database')
 ],[['core','port','ExecutionRequest'],['port','adapter','run + AbortSignal'],['adapter','adapter','snapshot / prelude / cwd'],['adapter','os','spawn'],['os','output','stdout / stderr'],['os','adapter','exit / close','return'],['adapter','os','取消或 timeout 清理'],['output','adapter','输出事实','return'],['adapter','port','status / exitCode / cwd','return'],['port','core','BashOutput','return']], [['时间与终止','timeout 从 spawn 后起算；准备期仍能取消','root shell 退出不等于后代和输出 pipe 已关闭'],['执行环境','当前 exec adapter 使用宿主进程，不启用旧 sandbox','env overlay 和网络代理配置不构成 OS 访问隔离']]);
a('08b-security','security','图 8B · Permission and Host Boundary',[
 [n('input','工具调用','schema / resolveInput','C/tool/executor/call-runner.ts:65'),35,60],
 [n('policy','Permission policy','mode / rules / capability','C/permission/service.ts:99','security'),365,60],
 [n('broker','确认 / Hook','ask 时竞速与复核','C/tool/executor/permission-flow.ts:184','security'),365,300],
 [n('handler','允许后的 Handler','FS / Bash / MCP','C/tool/executor/call-runner.ts:443'),35,300],
 [n('env','路径与环境','规范化 / env overlay','C/tool/path-policy.ts:15'),35,540],
 [n('host','宿主执行器','Node IO / spawn','A/exec/node-execution-adapter-run.ts:197','external'),365,540],
 [n('resources','宿主资源','文件 / 进程 / 网络','A/exec/node-execution-adapter-process.ts:58','external'),695,540]
 ],[['input','policy','权限判定'],['policy','broker','ask'],['policy','handler','allow'],['broker','handler','许可并复核'],['handler','env','执行事实'],['env','host','IO 请求'],['host','resources','宿主权限']], [['真实边界','permission 是业务执行 gate，deny 阻止 handler','yolo 与 alwaysAsk 的顺序以报告为准'],['没有强隔离承诺','当前路径 policy 允许 workspace 外路径','旧 sandbox 已撤除；网络 env 不是网络封锁']]);
