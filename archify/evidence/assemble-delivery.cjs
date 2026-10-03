const fs=require('node:fs'),cp=require('node:child_process');
const batches=[
 ['repository-map','Initial Repository Map'],['startup-runtime','Startup / Runtime'],['agent-runtime-loop','Agent Runtime / Loop'],['prompt-context','Prompt / Context'],['model-provider','Model / Provider'],['tool-system','Tool System'],['repository-understanding','Repository Understanding'],['file-editing','File Editing'],['shell-security','Shell / Security'],['session-state','Session / State'],['events-concurrency','Events / Concurrency'],['extensions','MCP / Skill / Plugin'],['ui-cli','UI / CLI'],['error-recovery','Error / Recovery'],['testing-eval','Testing / Eval'],['abstractions-debt','Abstractions / Debt'],['reading-path','Source Reading Path'],['minimal-core','Minimal Core'],['development-map','Development Map'],['master-map','Master Architecture Map'],['call-chains','Critical Call Chains'],['delivery','Final Delivery']
];
const topics=[
 ['Project Overview',0,'ZCode 同时提供 Desktop/Web 产品和 CLI Agent Runtime；包入口、依赖与运行形态必须依据当前 package scripts。先建立产品/进程/包三个层次，避免将开发 IDE 当产品入口。','00-repository/repository'],
 ['Master Architecture',19,'18 个责任组件将输入、Host、CLI/App、Runtime、Model、Tool 和 IO/storage 扩展边界连接起来。点击节点可查看固定提交源码，详细调用不是完整包 import graph。','19-master/master'],
 ['Startup Runtime',1,'进程共享存储/Registry/protocol connection 先启动；session App/Runtime 按请求创建。Context 惰性初始化，资源关闭遵守 owns/shared。','01a-startup/startup'],
 ['Agent Runtime',2,'AgentRuntime 是单会话 owner，Runtime command drain 串行进入 foreground turn。具体实现安装到 prototype，不能只在类文件寻找整个执行逻辑。','01b-runtime/runtime'],
 ['Agent Loop',2,'runRegularTurnLoop 的 while 才是真正 model/tool 控制循环；TurnMachine 描述合法迁移。model step、turn、command 和 goal 完成的边界分别处理。','02b-loop/loop'],
 ['Prompt',3,'ContextBuilder 依序构造 system 与 meta-user sections；AGENTS、skills 清单和 memory index 有不同来源。tools 是独立请求参数，custom prompt 不覆盖所有 attachments。','03a-prompt/prompt'],
 ['Context',3,'canonical history、turn-local entries 和 Provider request view 分离。Hybrid compact 管理摘要/近期 tail/可选清理，工具输出也先经过预算与 artifact。','03b-context/context'],
 ['Model Provider',4,'执行支持三种协议 factory，品牌配置不是 SDK 实现数量。冻结 Model 能力/endpoint 与每 attempt 的 auth refresh 分开，stream boundary 限制原样 retry。','04a-provider/provider'],
 ['Tool System',5,'Registry entry 与模型可见 contracts 分开，Core executor 负责 schema/hooks/permission/handler/结果。safe concurrency 和 streaming early execute 都必须满足 metadata 边界。','05b-tool-call/tool-call'],
 ['Repository Understanding',6,'当前普通路径属于文本搜索 + 按需读取；默认 embedded Bash 搜索与 direct FS 分支分别说明。未确认 runtime AST/LSP/vector/full-repo semantic index。','06a-repository-workflow/repository-workflow'],
 ['File Editing',7,'Read state 约束 Edit/Write freshness；Edit 采用多级文本匹配，不是已启用 ApplyPatch。revision/atomic fallback 与 file checkpoint 都有具体范围，不能称通用事务。','07a-code-modification/code-modification'],
 ['Shell Sandbox Security',8,'Bash handler 经 ExecutionPort 到 Node process，涵盖 cwd/env/output/timeout/cancel。权限规则与审批不是自动 OS sandbox，平台隔离能力以实际实现为限。','08b-security/security'],
 ['Session State',9,'SQLite 持久事实与 resident Runtime 对象分离。Resume 重建 active branch/read state/context，并将中断工具补成结果而非重跑。','09a-session/session'],
 ['Event Concurrency',10,'event seq、durable facts 和 live sinks 有顺序；model streaming queue、Inbox 和 Runtime command queue 是不同串行点。background task 与 model attempt 各有 lifecycle/admission。','10b-concurrency/concurrency'],
 ['MCP Skill Plugin',11,'插件在 assembly 注入 roots/hooks/MCP/profiles；Skill 正文按需加载。MCP 局部连接恢复与 workspace hook 逐 dispatch 信任复核是独立边界。','11a-extension/extension'],
 ['UI CLI',12,'V4 envelope/ACK 与 subscription projection 是当前共享 UI 主链。Main 负责调度转发，手机复用已有 Host attachment；continuous/replayable 不可混用。','12b-ui-request/ui-request'],
 ['Error Recovery',13,'区分 adapter retry、Core 安全锚点恢复、工具失败回注和 UI 对账。Context overflow 重新 compact/rebuild，外部副作用没有通用 rollback。','13a-recovery/recovery'],
 ['Testing Eval',14,'当前提交四个 node:test 主要覆盖迁移/退役，未发现 Agent/Provider/Tool/E2E/Eval suite。按任务条件不生成虚构完整 Testing Architecture；未执行测试。',null],
 ['Core Abstractions',15,'18 个核心对象确定 owner、接口与生命周期：App/Runtime、Inbox/Queue、History/Context、Model、Tool、IO、Store 与投影。使用实际代码判断模式，不以名词替代控制流。','19-master/master'],
 ['Technical Debt',15,'维护风险集中在 orchestration、状态机/实际流程双重表达、恢复特例、同步 SQLite、文件 CAS/atomic 边界和测试缺口。未证明依赖环或普遍吞错，不将风险评价写成已确认故障。',null],
 ['Extension Guide',15,'同协议 Provider/Skill 成本相对低；新协议、Loop 或跨 owner 状态变化成本高。扩展 Tool 应同时覆盖 contract、曝光、权限、结果预算与测试；插件配置不等于任意 handler 热注入。','11a-extension/extension'],
 ['Minimal Core',17,'最小 coding agent 保留 owner/queue、context/history、Model、受控 tools 和 FS/Exec/search。若承诺 remote/resume，就仍必须保留 durable admission/identity/lease/replay；没有实际删代码或测算 20%。','19-master/master'],
 ['Source Code Reading Path',16,'30 个文件按理解价值排序，给出作用、主要符号与阅读时机。30 分钟、2 小时、1 天、3 天路线从 loop/owner 逐步深入 adapter/storage/平台。',null],
 ['Development Map',18,'17 个修改目标都配实际源码、契约/下游和建议验收场景。先 spec 与架构上下文，再实现；建议场景未在本分析中执行。',null],
 ['Critical Call Chains',20,'12 条启动/输入/context/prompt/LLM/stream/tool/shell/read/edit/search/completion 链尽量精确到方法。协议交付用异步边界标记，不能假装一个同步堆栈。','19-master/master']
];
fs.mkdirSync('archify/topics',{recursive:true});
let topicIndex='# ZCode · Final 25 Topics\n\n[返回总入口](../README.md) · [Master Map](../diagrams/19-master/master.html) · [验证与限制](../validation.md)\n\n按任务 Batch 21 的顺序组织；每页给出结论与详细 Batch 链接，详细证据保留一份，避免复制后漂移。\n\n| 主题 | 详细分析 |\n|---|---|\n';
topics.forEach(([name,b,summary,diagram],i)=>{const num=String(i+1).padStart(2,'0'),slug=name.toLowerCase().replaceAll(' ','-'),file=`${num}-${slug}.md`,report=`batch-${b}-${batches[b][0]}.md`;fs.writeFileSync('archify/topics/'+file,`# ${num} ${name}\n\n${summary}\n\n[详细源码分析](../${report})${diagram?` · [Archify 图](../diagrams/${diagram}.html)`:''} · [证据与验证](../validation.md)\n\n[25 主题目录](README.md) · [总入口](../README.md)\n`);topicIndex+=`| [${num} ${name}](${file}) | [Batch ${b}](../${report}) |\n`;});
fs.writeFileSync('archify/topics/README.md',topicIndex);
let readme='# ZCode 源码分析 · Batch 0～21\n\n任务说明：[promt/archify-promt.md](../promt/archify-promt.md)。Batch 0～21 已完成，本轮续作完成 Batch 6～21，保留此前 Batch 0～5。分析基线：`540f6338390f5fcc4aaf38eb1086aa6f51f97b2c`，所有图的源码链接固定该 revision。\n\n建议从 [最终 Master Map](diagrams/19-master/master.html) → [25 主题目录](topics/README.md) → [12 条调用链](batch-20-call-chains.md) 阅读；准备二次开发时使用 [30 文件阅读路线](batch-16-reading-path.md) 和 [17 项开发地图](batch-18-development-map.md)。\n\n| Batch | 报告 | Archify 图 |\n|---|---|---|\n';
const dirs=fs.readdirSync('archify/diagrams').filter(d=>fs.existsSync(`archify/diagrams/${d}/candidate.json`));
batches.forEach(([slug,name],i)=>{const graphs=dirs.filter(d=>parseInt(d,10)===i).map(d=>{const s=JSON.parse(fs.readFileSync(`archify/diagrams/${d}/candidate.json`));return `[${s.meta.title}](diagrams/${d}/${s.meta.output.split('/').pop()})`;}).join(' · ');readme+=`| ${i} | [${name}](batch-${i}-${slug}.md) | ${graphs||(i===14?'条件不满足，仅文字分析':'复用专题图')} |\n`;});
readme+='\n每批保留九个固定栏目；Confirmed 为源码已确认，Inference 为推断，Unknown/Need Verification 为证据限制。当前普通搜索是文本 + on-demand，工具由 Core executor 执行，模型 SDK 不接管本地副作用循环；UI V4 的 ACK 与权威 projection 分离，手机复用已有 Host attachment。\n\n共 35 张 standalone Archify HTML，本轮新增 20 张；全部通过 validate、deliver、strict check、真实浏览器 browser-check，当前规格/HTML 哈希与 receipts 匹配。未进行截图式人工视觉审查，部分非 architecture 图保留路由 advisory，详见 [validation](validation.md) 与 [证据索引](evidence/artifacts.json)。Batch 14 如实记录当前四个测试及覆盖缺口，按任务条件未生成 Testing Architecture。\n\n已运行 typecheck/lint，两者均因 node_modules 缺失、tsc/oxlint 不可用而失败，不能称项目验证通过。未启动真实模型、MCP、Electron 或手机链路；未改应用代码，保留既有 promt/ 与旧 .archify/。\n';
fs.writeFileSync('archify/README.md',readme);
const files=cp.execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n').filter(Boolean);
let testScripts=[];for(const p of files.filter(p=>p.endsWith('package.json')&&!p.includes('vendor/'))){const j=JSON.parse(fs.readFileSync(p));for(const [name,command] of Object.entries(j.scripts||{}))if(/test|eval|benchmark/.test(name))testScripts.push({path:p,name,command});}
fs.writeFileSync('archify/evidence/testing-inventory.json',JSON.stringify({revision:'540f6338390f5fcc4aaf38eb1086aa6f51f97b2c',trackedTestFiles:files.filter(p=>/(\.test\.|\.spec\.|(^|\/)tests?\/)/.test(p)&&!p.includes('vendor/')),matchingScripts:testScripts,evalRunnerPaths:files.filter(p=>/swe-bench|(^|\/)evals?\/|vitest.config|playwright.config/i.test(p)),testExecution:'not-run; dependencies missing'},null,2)+'\n');
