// 仅生成 archify 文档图规格；不属于 ZCode 应用实现。
const fs = require('node:fs');
const root = 'archify/diagrams/';
const revision = '540f6338390f5fcc4aaf38eb1086aa6f51f97b2c';
const prefixes = { C: 'apps/zcode-cli/packages/core/src/', A: 'apps/zcode-cli/packages/adapters/src/', B: 'apps/zcode-cli/packages/bootstrap/src/' };
function source(ref) { const [p, line] = ref.split(':'); return [{ path: p.replace(/^([CAB])\//, (_, k) => prefixes[k]), line: Number(line) }]; }
function node(id, label, sublabel, ref, type = 'backend') { return { id, label, sublabel, type, sources: source(ref) }; }
function edges(rows) { return rows.map(([from, to, label, variant = 'default']) => ({ from, to, ...(label ? {label} : {}), variant })); }
function cards(rows) { return rows.map(([title, ...items], i) => ({dot: i ? 'amber' : 'cyan', title, items})); }
function save(folder, stem, title, type, body) {
 const directory = root + folder; fs.mkdirSync(directory, {recursive:true});
 const spec = {schema_version: ['workflow','lifecycle'].includes(type) ? 2 : 1, diagram_type:type,
 meta:{title,locale:'zh-CN',output:directory+'/'+stem+'.html',quality_profile:'showcase',repository:{url:'https://github.com/gimlee/ZCode.git',provider:'github',revision,link_mode:'web'}}, ...body};
 if (type === 'dataflow') spec.meta.viewBox=[940,570];
 if (type === 'sequence') {spec.meta.viewBox=[1080,Math.max(580,260+body.messages.length*30)];spec.meta.column_fit='spread';}
 fs.writeFileSync(directory+'/candidate.json',JSON.stringify(spec,null,2)+'\n'); return spec;
}
function sequence(folder,stem,title,participants,rows,notes) { return save(folder,stem,title,'sequence',{participants,messages:rows.map(([from,to,label,variant='default'],i)=>({id:'m'+i,from,to,label,variant,y:170+i*30})),cards:cards(notes)}); }
function dataflow(folder,stem,title,stages,rows,flows,notes) {return save(folder,stem,title,'dataflow',{stages:stages.map(label=>({label})),nodes:rows.map(([n,stage,row])=>({...n,stage,row,width:148,height:64})),flows:edges(flows),cards:cards(notes)});}
function workflow(folder,stem,title,lanes,rows,links,mainPath,notes) {return save(folder,stem,title,'workflow',{lanes:lanes.map(([id,label])=>({id,label})),nodes:rows.map(([n,lane,col])=>({...n,lane,col,width:148,height:76})),edges:edges(links),mainPath,cards:cards(notes)});}
function architecture(folder,stem,title,rows,links,notes) {return save(folder,stem,title,'architecture',{components:rows.map(([n,x,y,w=220])=>({...n,pos:[x,y],size:[w,80]})),connections:edges(links),cards:cards(notes)});}
function lifecycle(folder,stem,title,lanes,rows,links,notes){return save(folder,stem,title,'lifecycle',{lanes:lanes.map(([id,label])=>({id,label})),states:rows.map(([id,label,sub,ref,lane,col,type='active'])=>({id,label,sublabel:sub,sources:source(ref),lane,col,type,width:176,height:78})),transitions:edges(links),cards:cards(notes)});}
module.exports={node,sequence,dataflow,workflow,architecture,lifecycle};
