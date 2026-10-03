const {node:n,architecture:a,dataflow:d,lifecycle:l}=require('./author-diagrams.cjs');
l('09a-session','session','图 9A · Session Lifecycle',[['main','驻留会话'],['recovery','去激活与冷恢复'],['terminal','不可恢复目标']], [
 ['create','创建 App','新建或指定 sessionId','B/app/create-app.ts:150','main',0,'start'],
 ['ready','Runtime ready','Context 按需初始化','B/app/create-app.ts:434','main',1],
 ['persist','首次 durable session','user / parts / metadata','C/runtime/methods/message-persistence.ts:1','main',2],
 ['turn','执行 turn','模型、工具与结果','C/runtime/methods/turn-loop.ts:109','main',3],
 ['idle','驻留空闲','等待下一输入或订阅','B/zcode-protocol/session-resident-pool.ts:56','main',4],
 ['closed','释放 resident App','DB 保留；不复活 OS pid','B/zcode-protocol/session-resident-pool.ts:152','recovery',4],
 ['resume','冷恢复单飞','订阅 persisted session','B/zcode-protocol-v4/cold-session-resume.ts:42','recovery',2,'waiting'],
 ['hydrate','重建历史与状态','active branch / compact / mode','C/runtime/methods/resume.ts:56','recovery',3],
 ['missing','拒绝目标','不存在或 archived','C/runtime/methods/resume.ts:70','terminal',2,'failure']
 ],[['create','ready','初始化'],['ready','persist','首输入'],['persist','turn','执行'],['turn','idle','完成'],['idle','turn','新输入'],['idle','closed','符合回收'],['closed','resume','重新订阅'],['resume','hydrate','找到'],['hydrate','idle','READY'],['resume','missing','不可用']], [['恢复含义','Runtime 与 Context 被重建；不是原 JS/OS 状态续存','任务/订阅/交互/operation lease 会阻止 resident 回收']]);
a('09b-state','state','图 9B · State Ownership',[
 [n('app','Session App','依赖、facades 与生命周期','B/app/create-app.ts:150'),30,60,210],
 [n('runtime','Agent Runtime','foreground / turn / queue owner','C/runtime/agent-runtime.ts:1'),330,60,230],
 [n('store','SessionStore Port','durable facts 写入接口','C/runtime/methods/message-persistence.ts:1'),650,60,220],
 [n('db','SQLite','messages / parts / inputs','A/storage/session-store/sqlite-session-store.ts:225','database'),960,60,210],
 [n('turn','Turn-local state','当前请求与 reservation','C/runtime/methods/turn-loop.ts:109'),30,310,210],
 [n('history','Canonical History','活跃 entries 的唯一 owner','C/agent/message-history.ts:137','database'),330,310,230],
 [n('events','Live Event Store','seq / turn-window retention','apps/zcode-cli/packages/contracts/src/events/in-memory-session-event-store.ts:32','database'),650,310,220],
 [n('task','Task Registry','child / background execution','C/subagent/runner.ts:131','database'),330,560,230]
 ],[['app','runtime','持有'],['runtime','store','保存事实'],['store','db','repository IO'],['runtime','turn','控制'],['runtime','history','维护'],['runtime','events','append'],['runtime','task','任务登记']], [['状态分层','UI snapshot 是投影；canonical history 是 runtime 事实','resident pool 控制容量，不拥有 session 消息'],['冷热差异','SQLite 恢复 messages/parts 与 selected state','live seq buffer 和运行中 turn 不原样序列化']]);
d('09c-persistence','persistence','图 9C · Persistence Data Flow',['运行事实','保存接口','durable 数据','恢复视图'],[
 [n('message','消息与工具结果','user / assistant / paired tool','C/runtime/methods/message-persistence.ts:1'),0,0],
 [n('checkpoint','Checkpoint facts','snapshot / rewind metadata','C/runtime/methods/workspace-checkpoint-persistence.ts:28'),0,1],
 [n('store','SessionStore','message / part / session_entry','A/storage/session-store/sqlite-session-store.ts:609'),1,0],
 [n('artifact','Artifact port','文件快照与大输出','C/runtime/methods/file-rewind.ts:327','database'),1,1],
 [n('db','SQLite facts','包括 inputs promotion','A/storage/session-store/repositories/session-inputs.ts:191','database'),2,0],
 [n('files','Artifact files','与 DB 是不同 IO','C/runtime/methods/file-rewind.ts:337','database'),2,1],
 [n('resume','Resume / Hydration','branch、compact、配对','C/agent/session-history-hydrator.ts:51'),3,0]
 ],[['message','store','保存'],['checkpoint','store','entry'],['checkpoint','artifact','快照'],['store','db','写入'],['artifact','files','持久化'],['db','resume','读 facts'],['files','resume','按需加载']], [['事务边界','input promotion + user/parts 可同一 SQLite 事务','artifact 与 DB 不是一个跨 IO 原子事务']]);
d('10a-events','events','图 10A · Event Flow',['事件生产','编号与顺序','事实处理','消费投影'],[
 [n('source','Runtime 事件','Model / Tool / Turn','C/runtime/methods/events.ts:68'),0,0],
 [n('queue','Stream 写队列','tail / boundary drain','C/runtime/methods/model-streaming-event-queue.ts:12'),1,1],
 [n('append','appendEvent','所有事件经过 seq owner','C/runtime/methods/events.ts:80'),1,0],
 [n('seq','EventStore seq','单调编号 / 瞬态回收','apps/zcode-cli/packages/contracts/src/events/in-memory-session-event-store.ts:60','database'),2,0],
 [n('durable','Durable / usage','选择性持久化','C/runtime/methods/events.ts:104','database'),2,1],
 [n('sink','Event sinks','append 后事实再通知','C/runtime/methods/events.ts:108','messagebus'),3,1]
 ],[['source','append','普通事件'],['source','queue','stream delta'],['queue','append','有序 drain'],['append','seq','append'],['seq','durable','storedEvent'],['durable','sink','完成后通知']], [['序号所有者','live / replay / snapshot 使用相同 seq','高频 delta 不等于每个 token 永久落库'],['背压','默认 pending 128；finish/error/tool-call 边界 drain','写失败在边界抛出，不能用静默丢弃代替成功']]);
a('10b-concurrency','concurrency','图 10B · Concurrency Owners',[
 [n('inbox','CommandInbox','同 session admission gate','B/zcode-protocol-v4/command-inbox.ts:118','security'),35,60],
 [n('queue','Runtime Queue','一个 foreground drainer','C/runtime/methods/runtime-command-queue.ts:36'),365,60],
 [n('loop','Turn Loop','模型与工具步骤','C/runtime/methods/turn-loop.ts:109'),695,60],
 [n('model','Model admission','物理 attempt ticket','A/model/request-admission.ts:38','security'),695,320],
 [n('tools','Tool groups','安全并发 / early cache','C/tool/executor/batch-runner.ts:24'),365,320],
 [n('child','Child tasks','独立 session / abort','C/subagent/runner.ts:131'),35,320],
 [n('events','Stream queue','tail / boundary drain','C/runtime/methods/model-streaming-event-queue.ts:12'),695,560],
 [n('registry','Task registry','branch/run 防旧通知','C/runtime/methods/runtime-command-queue.ts:1','database'),35,560]
 ],[['inbox','queue','已接受输入'],['queue','loop','执行'],['loop','model','request'],['loop','tools','schedule'],['tools','child','Agent 工具'],['child','registry','生命周期'],['loop','events','delta 写队列']], [['不同串行边界','admission settle、command drain 与 model ticket 不互换','多个 session/child 可并行，不意味着每个一个 OS thread'],['关键竞态防护','input/live pin、branch generation、foreground lease','工具最终按声明 ID 配对，非完成先后顺序']]);
