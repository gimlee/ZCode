const {node:n,architecture:a}=require('./author-diagrams.cjs');
a('19-master','master','图 19 · ZCode Master Architecture Map',[
 [n('ui','V4 User Interface','输入 / pending / projection','packages/ui/src/v4/SessionPane.tsx:1395','frontend'),35,60,220],
 [n('host','Window Local Host','services / workspace clients','packages/services/src/zcode-agent/zcodeAgentService.ts:5044'),365,60,220],
 [n('app','CLI Protocol / App','process resources / session facades','B/app/create-app.ts:144'),695,60,220],
 [n('runtime','Agent Runtime','command → turn → model step','C/runtime/methods/turn-loop.ts:43'),1025,60,220],
 [n('model','Model Abstraction','immutable handle / capabilities','A/model/model.ts:40'),1355,60,220],
 [n('provider','Provider Adapter','3 protocol factories / stream','A/model/model-execution.ts:344','external'),1685,60,220],
 [n('main','Desktop Main','spawn / ports / native dispatch','packages/desktop/src/main/desktopHostProcess.ts:706'),35,330,220],
 [n('workspace','Workspace / Remote','identity / connection registry','packages/desktop/src/host/windowRemoteConnectionRegistry.ts:1'),365,330,220],
 [n('inbox','V4 Gateway / Inbox','durable admission / trusted profile','B/zcode-protocol-v4/command-inbox.ts:118'),695,330,220],
 [n('context','Context / Prompt','sections / projection / compact','C/context/builder.ts:87'),1025,330,220],
 [n('tools','Tool System','registry / scheduler / executor','C/tool/executor/call-runner.ts:65'),1355,330,220],
 [n('mcp','MCP / Browser','external descriptors / transport','A/mcp/index.ts:157','external'),1685,330,220],
 [n('remote','Mobile Attachment','复用已有 Host 会话','packages/desktop/src/main/desktopRemoteSessions.ts:976','external'),35,600,220],
 [n('storage','SQLite / Artifacts','session / inputs / checkpoints','A/storage/session-store/sqlite-session-store.ts:225','database'),365,600,220],
 [n('plugins','Skill / Plugin / Hooks','startup components / trust','B/app/startup-marks.ts:11'),695,600,220],
 [n('history','History / Events','canonical pairs / event sinks','C/agent/message-history.ts:135','database'),1025,600,220],
 [n('fs','File / Search','Read/Edit/Write / text discovery','A/fs/index.ts:115'),1355,600,220],
 [n('exec','Shell / OS','cwd / env / process tree','A/exec/node-execution-adapter-run.ts:26'),1685,600,220]
 ],[['ui','host','service RPC'],['host','app','stdio V4'],['app','runtime','创建与注入'],['runtime','model','request'],['model','provider','bind / execute'],['main','host','进程与端口'],['host','workspace','identity 路由'],['workspace','remote','已有 attachment'],['app','inbox','protocol facade'],['inbox','runtime','accepted input'],['runtime','context','构造请求视图'],['runtime','tools','local tool calls'],['tools','mcp','external handler'],['context','history','prefix / active entries'],['history','storage','persisted facts'],['plugins','app','components'],['tools','fs','FS port'],['tools','exec','Execution port']], [['源码研究入口','点击节点查看固定提交的源码；组件是责任聚合，不是全部包依赖图','主线：UI → Host → CLI App → Runtime → Model → Provider'],['两条执行闭环','Context/History 决定模型看到什么；Tools → FS/Exec/MCP 改变外部世界','Tools result 规范化、配对提交后回到下一步；细节见专题图'],['所有者与范围','Main/relay 调度转发；CLI 拥有 accepted inputs 和会话执行事实','Mobile 复用 attachment；文本 on-demand search，无确认 semantic index']]);
