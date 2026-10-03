const {node:n,architecture:a,sequence:s,workflow:w,lifecycle:l}=require('./author-diagrams.cjs');
a('12a-front-runtime','front-runtime','图 12A · Frontend / Runtime Architecture',[
 [n('ui','共享 V4 UI','composer / projection','packages/ui/src/v4/SessionPane.tsx:1395','frontend'),35,60],
 [n('transport','Conversation Transport','injected service / handshake','packages/ui/src/v4/agentConversationTransport.ts:89'),365,60],
 [n('host','Window Local Host','workspace / remote registry','packages/desktop/src/host/windowRemoteConnectionRegistry.ts:1'),695,60],
 [n('main','Desktop Main','utilityProcess / MessagePort','packages/desktop/src/main/desktopHostProcess.ts:706'),35,310],
 [n('remote','手机 Attachment','复用已有 logical session','packages/desktop/src/main/desktopRemoteSessions.ts:976','external'),365,310],
 [n('stdio','Agent Process + stdio','identity key / LF JSON','packages/services/src/zcode-agent/zcodeStdioTransport.ts:35'),695,310],
 [n('projection','权威投影','snapshot replace / seq gap','packages/ui/src/v4/conversationProjectionStore.ts:1','database'),35,560],
 [n('runtime','App / Session Runtime','queue / model / tools','C/runtime/methods/turn-loop.ts:43'),365,560],
 [n('gateway','CLI V4 Gateway','inbox / trusted profile','B/zcode-protocol-v4/v4-gateway.ts:2376'),695,560]
 ],[['ui','transport','command'],['transport','host','service RPC'],['main','host','启动与原生转发'],['remote','host','可信 attachment'],['host','stdio','workspace client'],['stdio','gateway','V4 frames'],['gateway','runtime','admission'],['runtime','projection','订阅事实'],['projection','ui','render']], [['通道分工','Renderer / Host：MessagePort RPC；Host / CLI：stdio','远控：可信 WebSocket attachment，不另起手机 Agent'],['状态所有者','ACK 是 admission；conversation facts 由 CLI 投影','continuous 与 replayable 必须保留不同恢复语义']]);
s('12b-ui-request','ui-request','图 12B · UI Request Sequence',[
 n('ui','SessionPane','envelope / pending','packages/ui/src/v4/SessionPane.tsx:1395','frontend'),
 n('transport','Transport','handshake / sendCommand','packages/ui/src/v4/agentConversationTransport.ts:350'),
 n('host','Host Service','trusted carrier / identity','packages/services/src/zcode-agent/zcodeAgentService.ts:5044'),
 n('cli','CLI Gateway / Inbox','durable admission','B/zcode-protocol-v4/v4-gateway.ts:2376'),
 n('runtime','Runtime / Store','执行与 committed facts','C/runtime/methods/turn.ts:93','database')
 ],[['ui','transport','上行前记录 pending ID'],['transport','host','sendConversationCommandV4'],['host','cli','request command + workspace route'],['cli','runtime','admit input / enqueue'],['cli','host','ACK accepted / duplicate','return'],['host','ui','settle pending；等待投影','return'],['runtime','cli','committed rows / queue / stream'],['cli','host','trusted-profile subscription frames'],['host','transport','snapshot / delta'],['transport','ui','replace / contiguous apply']], [['恢复边界','accepted projection 静默：重订阅，不重发 command','transport error：保留对账 ID，不能把 ACK 当 final answer']]);
w('13a-recovery','recovery','图 13A · Error Recovery Workflow',[['model','模型请求'],['core','Core 恢复'],['tool','工具执行'],['outcome','收口']], [
 [n('attempt','物理请求失败','分类 / 输出边界','A/model/runner-stream.ts:123'),'model',0],
 [n('retry','允许原样 retry','budget + retryable','A/model/runner-stream.ts:1455','security'),'model',1],
 [n('backoff','释放与退避','ticket / jitter / abort','A/model/runner-retry.ts:39'),'model',2],
 [n('recover','安全 stream anchor','commit / discard partial','C/runtime/methods/streaming-recovery.ts:207'),'core',1],
 [n('compact','Context exceeded','reactive compact / rebuild','C/runtime/methods/turn-model-step.ts:742'),'core',2],
 [n('new','新的 model step','受 recovery budget 限制','C/runtime/methods/turn-loop.ts:43'),'core',3],
 [n('handler','工具失败','lookup / validate / IO','C/tool/executor/call-runner.ts:560'),'tool',0],
 [n('paired','配对 error result','持久化后交模型判断','C/runtime/methods/turn-tools.ts:359'),'tool',1],
 [n('end','Error / cancelled','outcome + finally cleanup','C/runtime/methods/turn.ts:715'),'outcome',3]
 ],[['attempt','retry','可重试'],['retry','backoff','未越界'],['attempt','recover','已输出'],['recover','new','锚点安全'],['compact','new','压缩成功'],['handler','paired','规范化'],['paired','new','模型改方案'],['retry','end','不可重试'],['recover','end','预算或安全性失败']], ['attempt','retry','backoff'], [['并行入口','overflow 对应 Core compact 分支；不是 adapter 原样 retry','工具失败不会自动重跑 handler；副作用无通用 rollback'],['范围','图为恢复策略概览，各分支不保证覆盖全部异常','取消贯穿请求、退避和工具执行']]);
l('13b-retry','retry','图 13B · Physical Model Retry Lifecycle',[['main','物理尝试'],['wait','重试等待'],['outcome','结束']], [
 ['admit','Attempt admission','获取物理 in-flight ticket','A/model/request-admission.ts:38','main',0,'start'],
 ['request','Resolve + request','刷新 auth / frozen model','A/model/runner-stream.ts:240','main',1],
 ['classify','分类与 boundary','retryable / policy / budget','A/model/runner-stream.ts:1455','main',2,'decision'],
 ['release','Release ticket','失败后先释放槽','A/model/request-admission.ts:38','wait',2],
 ['delay','Backoff','Retry-After / cap / jitter','A/model/runner-retry.ts:39','wait',1,'waiting'],
 ['success','模型结果','归一化回 Core','A/model/runner-normalization.ts:17','outcome',1,'success'],
 ['raise','抛给 Core','recover / compact / fail','C/runtime/methods/turn-model-step.ts:742','outcome',2,'failure']
 ],[['admit','request','ticket'],['request','classify','失败'],['request','success','成功'],['classify','release','允许 retry'],['release','delay','退避'],['delay','admit','下一 attempt'],['classify','raise','停止重放']], [['预算和取消','普通默认 10 retries；配置可覆盖','workflow unbounded 仍有确定性 stop；等待可取消'],['层级','这里只画 adapter attempt 生命周期','Core recovery 发新 step；不是续接原始 SSE 字节']]);
