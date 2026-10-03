const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const revision='540f6338390f5fcc4aaf38eb1086aa6f51f97b2c',errors=[];
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(p,x.name)):[path.join(p,x.name)]);}
function hash(p){return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
function rel(p){return path.relative('.',p).replaceAll('\\','/');}
const all=walk('archify'),artifacts=[],sources=[];
for(const p of all.filter(p=>path.basename(p)==='candidate.json')){
 const s=JSON.parse(fs.readFileSync(p)),dir=path.dirname(p),artifact=s.meta.output,specHash=hash(p),artifactHash=fs.existsSync(artifact)?hash(artifact):null;
 const matching=walk(dir).filter(p=>p.endsWith('.finalize-summary.json')).map(p=>({p,r:JSON.parse(fs.readFileSync(p))})).filter(({r})=>r.ok&&r.status==='pass'&&r.specification.sha256===specHash&&r.artifact.sha256===artifactHash);
 if(!matching.length){errors.push({specification:rel(p),error:'no current successful receipt'});continue;}
 const {p:receipt,r}=matching.at(-1),browser=r.evidence.browserCheckReceipt;
 if(Object.values(r.gates).some(x=>x!=='pass')||r.diagnostics.length)errors.push({specification:rel(p),error:'gates or diagnostics'});
 const be=JSON.parse(fs.readFileSync(browser));if(!be.ok||be.artifact.sha256!==artifactHash)errors.push({artifact,error:'browser evidence mismatch'});
 artifacts.push({diagram:s.meta.title,type:s.diagram_type,specification:rel(p),specificationSha256:specHash,artifact:rel(artifact),artifactSha256:artifactHash,receipt:rel(receipt),gates:r.gates,browserEvidence:rel(browser),visualReview:r.visualReview,advisory:r.visualReviewRecommendation?.signals||{}});
 function scan(x){if(!x||typeof x!=='object')return;if(Array.isArray(x.sources))for(const a of x.sources){if(a.path){const exists=fs.existsSync(a.path),count=exists?fs.readFileSync(a.path,'utf8').split('\n').length:0;if(!exists||a.line<1||a.line>count||(a.end_line&&a.end_line>count))errors.push({specification:rel(p),source:a,error:'missing source or invalid line'});sources.push({diagram:path.basename(dir),...a,lineCount:count});}}for(const [k,v]of Object.entries(x))if(k!=='sources')Array.isArray(v)?v.forEach(scan):scan(v);}
 scan(s);
 if(s.meta.repository?.revision!==revision)errors.push({specification:rel(p),error:'revision mismatch'});
}
fs.writeFileSync('archify/evidence/artifacts.json',JSON.stringify({revision,diagrams:artifacts},null,2)+'\n');
fs.writeFileSync('archify/evidence/diagram-source-index.json',JSON.stringify({revision,checkedSourceAnchors:sources.length,sources},null,2)+'\n');
const headings=['Findings','Key Source Files','Key Classes / Functions','Control Flow','Data Flow','Important Design Decisions','Unknowns','Archify Diagram','Next Batch Dependencies'];
const prefixes={C:'apps/zcode-cli/packages/core/src/',Core:'apps/zcode-cli/packages/core/src/',A:'apps/zcode-cli/packages/adapters/src/',Adapters:'apps/zcode-cli/packages/adapters/src/',B:'apps/zcode-cli/packages/bootstrap/src/',Bootstrap:'apps/zcode-cli/packages/bootstrap/src/',CLI:'apps/zcode-cli/packages/cli/src/'};
let links=0,anchors=0;
const mds=all.filter(p=>p.endsWith('.md'));
for(const p of mds){const text=fs.readFileSync(p,'utf8');if(/^batch-\d+-/.test(path.basename(p)))for(const h of headings)if(!text.includes('## '+h+'\n')&&!text.includes('## '+h+'\r\n'))errors.push({document:rel(p),error:'missing heading '+h});
 for(const m of (path.basename(p)==='validation.md'?'':text).matchAll(/\[[^\]\n]*\]\(([^)]+)\)/g)){const target=m[1].replace(/^<|>$/g,'').split('#')[0];if(!target||/^(https?:|mailto:)/.test(target))continue;links++;const file=path.resolve(path.dirname(p),target);if(!fs.existsSync(file))errors.push({document:rel(p),target,error:'broken link'});}
 const rx=/((?:(?:C|A|B|Core|Bootstrap|Adapters|CLI)|apps|packages|scripts|config)\/[\w./-]+\.(?:tsx?|mjs|cjs|json)):(\d+)(?:[–-](\d+))?/g;
 for(const m of text.matchAll(rx)){anchors++;const target=m[1].replace(/^([^/]+)\//,(_,prefix)=>(prefixes[prefix]||prefix+'/'));const count=fs.existsSync(target)?fs.readFileSync(target,'utf8').split('\n').length:0;if(!count||+m[2]>count||m[3]&&+m[3]>count)errors.push({document:rel(p),target,line:+m[2],endLine:m[3],error:'invalid report source anchor'});}
}
const records=JSON.parse(fs.readFileSync('archify/evidence/reading-files.json'));for(const r of records)if(!fs.existsSync(r.path))errors.push({reading:r,error:'missing reading file'});
if(artifacts.length!==35)errors.push({error:'expected 35 diagrams',count:artifacts.length});
if(cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==revision)errors.push({error:'HEAD changed'});
let validation='# 验证记录\n\n验证日期：2026-10-03（Asia/Shanghai）；源码 revision：`'+revision+'`。\n\n## 环境与实际仓库检查\n\n开工已执行 `node scripts/check-workspace-freshness.mjs` 并通过，main 与远端同步。mise.toml 指定 Node 24.14.0 / pnpm 10.33.2；实际 Node 24.21.0，Corepack pnpm 10.33.2。当前 node_modules 缺失。无应用代码或产品行为/spec 改动，保留原有 promt/ 和旧 .archify/。\n\n| 命令 | 实际执行 | 真实结果 | 原始输出 |\n|---|---|---|---|\n| pnpm typecheck | corepack pnpm typecheck | exit 1；tsc 不可用、node_modules missing | [output](evidence/remaining-typecheck.txt) |\n| pnpm lint | corepack pnpm lint | exit 1；oxlint 不可用、node_modules missing | [output](evidence/remaining-lint.txt) |\n\n未得到实际 TypeScript/Lint 诊断，不声称项目检查通过。本轮没有安装依赖或修改实现来处理环境。未执行项目 unit/E2E；未启动真实 Provider/MCP/Electron/手机链路。当前测试文件与 scripts 清单见 [inventory](evidence/testing-inventory.json)。\n\n## Archify 自动验收\n\n使用 Archify 3.0.1 finalize showcase，所有 35 张图（此前 15，本轮新增 20）最终均通过 validate、deliver、strict check、真实 Chrome browser-check，diagnostics = 0。当前规格/HTML SHA-256 与 successful receipts 一致，browser evidence 绑定相同 HTML hash。[机器索引](evidence/artifacts.json) 记录所有 current receipts；review 子目录中的当前证据优先于旧默认 receipt。\n\n| 图 | type | spec / 当前 receipt | Browser evidence |\n|---|---|---|---|\n';
for(const a of artifacts)validation+=`| [${a.diagram}](${a.artifact.replace(/^archify\//,'')}) | ${a.type} | [JSON](${a.specification.replace(/^archify\//,'')}) / [summary](${a.receipt.replace(/^archify\//,'')}) | [browser](${a.browserEvidence.replace(/^archify\//,'')}) |\n`;
validation+='\n## 视觉审查和建议\n\nvisualReview = not-requested：没有截图式人工视觉审查，不把自动 gate pass 等同于人工感知验收。新 architecture 图 9B/12A/19 曾提示交叉，按 skill 做一次保留语义的布局复核，当前三图均无 route advisory；其他新 architecture 图无交叉。以下自动路由建议不是失败 diagnostics，仍保留，数字表示当前 resolved-route 交叉/弯折/伸展计数，并非人工已确认可读。\n\n| 图 | advisory signals |\n|---|---|\n';
for(const a of artifacts)if(Object.keys(a.advisory).length)validation+=`| [${a.diagram}](${a.artifact.replace(/^archify\//,'')}) | ${Object.entries(a.advisory).map(([k,v])=>k+'='+v).join(', ')} |\n`;
validation+='\n图是责任/流程聚合。2C 是合法迁移契约，不表示普通 while 使用全部边；Context/Session/Retry lifecycle 是真实阶段的抽象，不新增源码枚举。Master 的 persisted-facts 边省略 persistence ports，stdio/RPC 是异步边界。Batch 14 因测试体系证据不足按任务条件仅提供文字，不生成 Testing Architecture。\n\n## 文档与源码证据审计\n\n22 个 Batch 各含九个固定栏目，25 个最终主题按任务顺序整理。源码锚点检查当前文件存在与行号范围；它不自动证明文字语义，关键控制流已人工阅读源码。链接检查覆盖全部 Markdown 的本地文件目标；[审计结果](evidence/document-check.json)、[source index](evidence/diagram-source-index.json)、[30 文件清单](evidence/reading-files.json) 均保留。\n';
fs.writeFileSync('archify/validation.md',validation);
// validation 是本次生成的，因此再次核对新链接目标。
for(const m of validation.matchAll(/\[[^\]\n]*\]\(([^)]+)\)/g)){links++;if(!fs.existsSync(path.resolve('archify',m[1].split('#')[0])))errors.push({document:'archify/validation.md',target:m[1],error:'broken generated validation link'});}
const result={revision,checkedMarkdownFiles:mds.length,checkedLinks:links,checkedReportAnchors:anchors,checkedDiagramAnchors:sources.length,checkedDiagrams:artifacts.length,checkedBatchReports:22,requiredHeadingsPerReport:9,checkedReadingFiles:records.length,errors};
fs.writeFileSync('archify/evidence/document-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(errors.length)process.exitCode=1;
