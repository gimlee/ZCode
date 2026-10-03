const {node:n,architecture:a,sequence:s,lifecycle:l}=require('./author-diagrams.cjs');
a('11a-extension','extension','图 11A · Extension Architecture',[
 [n('sources','插件来源与配置','installed / official / enabled','A/plugins/index.ts:127'),35,60],
 [n('assembly','Startup assembly','enabled components 注入','B/app/startup-marks.ts:11'),365,60],
 [n('runtime','Session Runtime','组件在会话边界装配','B/app/create-app.ts:212'),695,60],
 [n('hooks','Hook registration','matcher / dispatch trust','C/hooks/configured-runner.ts:15','security'),35,310],
 [n('skills','Skill roots / profiles','发现 metadata / 按需正文','A/skills/index.ts:58'),365,310],
 [n('mcp','MCP adapter','stdio / HTTP / SSE','A/mcp/index.ts:157','external'),695,310],
 [n('execution','Hook execution','ExecutionPort / timeout','C/hooks/configured-runner-callback.ts:18'),35,560],
 [n('context','Context attachments','清单与 Skill tool result','C/runtime/methods/context.ts:213'),365,560],
 [n('registry','Unified Tool Registry','descriptor → ToolEntry','C/mcp/index.ts:60'),695,560]
 ],[['sources','assembly','discovery'],['assembly','runtime','注入'],['assembly','hooks','events config'],['assembly','skills','roots'],['runtime','mcp','MCP configs'],['hooks','execution','许可 dispatch'],['skills','context','发现与加载'],['mcp','registry','descriptors']], [['扩展接缝','Skill/command roots、profiles、hooks、MCP configs 与官方 features','插件不是任意 Core handler 的自动动态注入'],['信任与生命周期','workspace hook 逐次复核 digest / security revision','MCP hints 不是官方 authority；配置变更不等于所有旧对象热替换']]);
s('11b-mcp','mcp','图 11B · MCP Tool Sequence',[
 n('core','Core Executor','schema / permission / hooks','C/tool/executor/call-runner.ts:65'),n('wrapper','MCP ToolEntry','真实 server/tool 路由','C/mcp/index.ts:214'),n('adapter','Node MCP','deadline / connection','A/mcp/index.ts:438'),n('server','外部 Server','stdio / HTTP / SSE','A/mcp/index.ts:1449','external'),n('result','结果与 History','media / budget / 配对','C/runtime/methods/turn-tools.ts:359','database')
 ],[['core','wrapper','许可后 handler'],['wrapper','adapter','callTool + identity + signal'],['adapter','server','按需连接（已有连接跳过）'],['server','adapter','ready / descriptors','return'],['adapter','server','SDK callTool'],['server','adapter','content / isError','return'],['adapter','wrapper','规范化外部结果','return'],['wrapper','core','handler output','return'],['core','result','serialize / commit']], [['局部恢复','共享 connecting 只限制当前 waiter 的 deadline','断连可重连一次；REPL 进程内变量不恢复'],['权限边界','普通 MCP 仍走本地 executor approval','server hints 不授予官方 CUA 信任']]);
l('11c-plugin-lifecycle','plugin-lifecycle','图 11C · Skill / Plugin Lifecycle',[['main','装配与使用'],['configuration','配置变化'],['terminal','完成或未启用']], [
 ['discover','发现插件','来源 / manifest / config','A/plugins/index.ts:127','main',0,'start'],
 ['enable','启用判断','enabled components','A/plugins/index.ts:180','main',1,'decision'],
 ['assemble','App 装配','roots / hooks / MCP / profiles','B/app/startup-marks.ts:11','main',2],
 ['metadata','Context 技能清单','路径身份 / disabled filter','A/skills/index.ts:58','main',3],
 ['load','Skill tool 按需加载','100000 bytes / 正文','A/skills/index.ts:94','main',4],
 ['change','设置或卸载','config 镜像 / suppressed','B/app/plugin-facade.ts:42','configuration',1],
 ['excluded','不注入组件','检查展示不等于执行','A/plugins/index.ts:193','terminal',1,'failure'],
 ['result','正文回注','skill_content → tool result','C/tool/handlers/skill.ts:35','terminal',4,'success']
 ],[['discover','enable','解析'],['enable','assemble','enabled'],['enable','excluded','disabled'],['assemble','metadata','初始化'],['metadata','load','模型调用'],['load','result','返回'],['change','discover','下次装配','dashed']], [['流程抽象','图表示真实调用阶段，不是源码新增枚举','set enabled 成功不证明当前所有旧实例即时替换']]);
