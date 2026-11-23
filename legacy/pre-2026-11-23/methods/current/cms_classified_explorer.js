/* CMS source classification only: no lexical scores or passage-screen filtering. */
const CMS_DATA=__CMS_PAYLOAD__;
const CMS_VIEWS={general:'Wording patterns',standard:'Standard-level deficiency',condition:'Condition-level deficiency',ij:'IJ'};
const cmsCache=new Map(),cmsBaseGraph=currentGraph,cmsBaseEdges=sourceEdges,cmsBaseKey=filterKey;
const cmsBaseContext=renderContextCard,cmsBaseExamples=renderExampleList,cmsBaseCSV=csv,cmsBaseSync=syncEdgeControls,cmsBaseMode=setMode;
const cmsView=()=>guidedState.view in CMS_VIEWS?guidedState.view:'general';
const cmsClassified=()=>mode==='phrase'&&cmsView()!=='general';
function cmsNodeName(n){return n.isDeficiency||n.diamond?n.plain||CMS_DATA.tags[n.id-64]?.plain||n.label:n.label;}
function cmsNodeTag(n){return n.isDeficiency||n.diamond?n.tag||CMS_DATA.tags[n.id-64]?.tag:null;}

const isPPMI=()=>mode==='phrase'&&['ppmi','severity'].includes($('edgeUnit').value);
const rawSeverity=()=>$('textFilter').value==='untrimmed';
const scoreFor=()=>0;
const sourceTagIndex=r=>CMS_DATA.tagByRow[String(r[0])];
const sourceTag=r=>CMS_DATA.tags[sourceTagIndex(r)];
const SEVERITY={version:CMS_DATA.version,families:CMS_DATA.tags,contexts:[],examples:Object.fromEntries(CMS_DATA.tags.map(t=>[t.id,(CMS_DATA.examples[t.id]||[]).filter(e=>!e.raw).slice(0,4)])),
 records:new Proxy({},{get:(_,row)=>{const index=CMS_DATA.tagByRow[String(row)];return index===undefined?undefined:[0,0,0,0,[[index,0,[]]],[[index,0,[]]]];}}),
 tags:new Proxy({},{get:(_,row)=>CMS_DATA.tags[CMS_DATA.tagByRow[String(row)]]?.tag})};
const infoFor=r=>SEVERITY.records[r[0]]||[0,0,0,0,[],[]];
function selectedSeverityRows(){
 const F=DATA.filterRows,s=filterSelection(),ctx=F.contexts.indexOf(s.context),view=cmsView();
 return F.rows.filter(r=>surveyorMatches(s.org,r[3])&&(ctx<0||r[4]===ctx)&&hospiceYearMatches(s.year,r[5])&&(s.text!=='deduplicated'||r[12])&&(view==='general'||view==='standard'&&r[7]===2||view==='condition'&&r[7]===1||view==='ij'&&r[6]===1));
}
filterKey=function(){return cmsBaseKey()+'|cms='+cmsView();};
function cmsTagRanking(rows){const F=DATA.filterRows,stats=new Map();for(const r of rows){const i=sourceTagIndex(r);let s=stats.get(i);if(!s){s={node:CMS_DATA.tags[i],records:0,providers:new Set()};stats.set(i,s);}s.records++;if(r[1]>=0)s.providers.add(F.providers[r[1]].toUpperCase());}return [...stats.values()].sort((a,b)=>b.providers.size-a.providers.size||b.records-a.records||a.node.tag.localeCompare(b.node.tag));}
function familiesFor(r){if(!cmsClassified())return [];const i=sourceTagIndex(r);return currentGraph().targetIds.has(64+i)?[[i,0,[]]]:[];}
function cmsPpmi(rows,targets){const marginal=new Map(),joint=new Map(),N=rows.length;
 for(const r of rows){const ids=r[rawSeverity()?11:10].filter((v,i)=>i%2===0);const tag=64+sourceTagIndex(r);if(targets.has(tag))ids.push(tag);ids.sort((a,b)=>a-b);for(const id of ids)marginal.set(id,(marginal.get(id)||0)+1);for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const key=ids[a]+'|'+ids[b];joint.set(key,(joint.get(key)||0)+1);}}
 return [...joint].map(([key,shared])=>{const[source,target]=key.split('|').map(Number),lift=shared*N/(marginal.get(source)*marginal.get(target));return{source,target,shared,lift,weight:Math.max(0,Math.log2(lift)),metric:'record PPMI'};}).filter(e=>e.weight>0).sort((a,b)=>b.weight-a.weight||a.source-b.source||a.target-b.target);
}
currentGraph=function(){
 const key=filterKey();if(cmsCache.has(key))return cmsCache.get(key);
 const rows=selectedSeverityRows(),F=DATA.filterRows,ranking=cmsTagRanking(rows),targets=new Set(cmsClassified()?ranking.slice(0,5).map(s=>s.node.id):[]);
 const originalRows=F.rows,originalNodes=DATA.views.all.nodes,canon=new Map(),providers=F.providers.map((v,i)=>{const k=v.toUpperCase();if(!canon.has(k))canon.set(k,i);return canon.get(k);});let graph;
 F.rows=rows.map(r=>{const out=r.slice();if(out[1]>=0)out[1]=providers[out[1]];const tag=64+sourceTagIndex(r);if(targets.has(tag)){out[10]=r[10].concat(tag,1);out[11]=r[11].concat(tag,1);}return out;});
 if(cmsClassified())DATA.views.all.nodes=originalNodes.concat(CMS_DATA.tags.map(t=>({...t,isSeverity:true,isDeficiency:true,group:-1})));
 try{graph=aggregateFilteredGraph(filterSelection());}finally{F.rows=originalRows;DATA.views.all.nodes=originalNodes;}
 const rowSet=new Set(rows.map(r=>r[0])),raw=rawSeverity();
 graph={...graph,nodes:graph.nodes.map(n=>({...n,examples:(CMS_DATA.examples[n.id]||[]).filter(ex=>ex.raw===raw&&rowSet.has(ex.row)).slice(0,4).map(ex=>({...ex,excerpt:ex.text}))})),severityRows:rows,targetIds:targets,tagRanking:ranking,cmsView:cmsView(),cmsVersion:CMS_DATA.version};
 graph.ppmiEdges=cmsPpmi(rows,targets);graph.severityEdges=graph.ppmiEdges;
 cmsCache.set(key,graph);if(cmsCache.size>8)cmsCache.delete(cmsCache.keys().next().value);return graph;
};
sourceEdges=function(){return isPPMI()?currentGraph().ppmiEdges:cmsBaseEdges();};
const metricSettings={cosine:{min:'.08',max:'.70',step:'.01',value:'.12'},ppmi:{min:'0',max:'8',step:'any',value:String(Math.log2(1.5))}};
let lastMetric='cosine',savedMetrics={cosine:'.12',ppmi:String(Math.log2(1.5))};
function setSeverityMetric(){const metric=isPPMI()?'ppmi':'cosine';if(metric!==lastMetric)savedMetrics[lastMetric]=$('threshold').value;for(const k of ['min','max','step'])$('threshold')[k]=metricSettings[metric][k];if(metric!==lastMetric)$('threshold').value=savedMetrics[metric];lastMetric=metric;$('threshold').parentElement.querySelector('label').firstChild.textContent=isPPMI()?'Minimum PPMI ':'Minimum cosine similarity ';}
function severityColor(n){return n.isDeficiency?'#ff2020':'#638f9a';}
syncEdgeControls=function(){cmsBaseSync();if(isPPMI()){setText('sharedLabel','Minimum shared records');for(const o of $('shared').options)o.textContent=o.value+' records';setText('edgeNote','Each selected source record has equal weight. Care-phrase links require the selected support; deficiency-tag links require 10 shared records.');}};
function cmsPolicyLink(label,url){const a=elem('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function cmsClassificationPolicy(view=cmsView()){
 if(view==='standard')return ['42 CFR 488.1105','https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-488/subpart-M/section-488.1105'];
 if(view==='condition')return ['42 CFR 488.24','https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-488/subpart-A/section-488.24'];
 return ['42 CFR 488.1205','https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-G/part-488/subpart-N/section-488.1205'];
}
function renderSeverityDescription(){const box=$('connectionDescription');box.replaceChildren(elem('h3','',CMS_VIEWS[cmsView()]));
 box.append(elem('p','','Source Standard/Condition level and source IJ define the selected records. No severity score or passage-screen result determines inclusion or weights a link. Connections describe wording within the same record, not provider ties or confirmed causes of harm.'));
 if(cmsClassified()){const p=elem('p','','Classification basis: ');p.append(cmsPolicyLink(...cmsClassificationPolicy()),document.createTextNode('. Standard and Condition views include their IJ-associated records; IJ overlaps both levels. Diamonds show the five leading deficiency tags in the selected cohort.'));box.append(p);}
}
const cmsBeforeLegend=renderLegend;renderLegend=function(){cmsBeforeLegend();renderSeverityDescription();};
const cmsBeforeColors=renderColorDescription;renderColorDescription=function(){cmsBeforeColors();};
renderContextCard=function(n){cmsBaseContext(n);if(mode!=='phrase')return;const box=$('evidence');
 if(n.isDeficiency){const title=box.querySelector('h2');if(title)title.textContent=cmsNodeName(n);}for(const option of box.querySelectorAll('#contextNodeSelect option')){const node=displayedGraph.nodes.find(x=>String(x.id)===option.value);if(node){option.textContent=cmsNodeName(node);if(cmsNodeTag(node))option.title='Deficiency tag: '+cmsNodeTag(node);}}for(const button of box.querySelectorAll('[data-neighbor]')){const node=displayedGraph.nodes.find(x=>String(x.id)===button.dataset.neighbor);if(node?.isDeficiency){button.textContent=button.textContent.replace(node.label,cmsNodeName(node));button.title='Deficiency tag: '+cmsNodeTag(node);}}
 if(n.isDeficiency){for(const note of box.querySelectorAll('.note'))note.textContent=note.textContent.replaceAll('phrase-matching','tag-associated').replace('These are phrase mentions','These are source-tagged records');const p=elem('p','note','Source-reported deficiency category in '+CMS_VIEWS[cmsView()]+'. Classification reference: ');p.append(cmsPolicyLink(...cmsClassificationPolicy()));box.append(p);}
 for(const summary of box.querySelectorAll('.source-details summary'))summary.textContent='Read the complete displayed excerpt';
};
renderExampleList=function(n,q,target){cmsBaseExamples(n,q,target);if(mode!=='phrase')return;for(const[i,article]of [...target.querySelectorAll('article')].entries()){const ex=n.examples[i];if(!ex)continue;article.append(elem('p','note',`Source level: ${ex.level} · Source IJ: ${ex.ij||'Not recorded'} · Cited regulation: ${ex.citation}`),elem('div','meta',`${ex.source_document_id} · analysis_text characters [${ex.start}, ${ex.end}) of ${ex.source_length}. This displayed excerpt is not the complete source record.`));}};
const cmsBeforeTooltip=edgeTooltip;edgeTooltip=function(e){return isPPMI()?`PPMI: ${e.weight.toFixed(3)}\nLift: ${e.lift.toFixed(3)}\n${count(e.shared)} shared source records\nCohort: ${CMS_VIEWS[cmsView()]}\nEqual weights; wording associations, not phrase-specific severity.`:cmsBeforeTooltip(e);};
csv=function(){if(mode!=='phrase'||!isPPMI())return cmsBaseCSV();const quote=x=>'"'+String(x).replaceAll('"','""')+'"';return 'source_feature,target_feature,PPMI,lift,shared_records,CMS_view,model\n'+shownEdges.map(e=>[displayedGraph.nodes[e.source].label,displayedGraph.nodes[e.target].label,e.weight,e.lift,e.shared,cmsView(),CMS_DATA.version].map(quote).join(',')).join('\n');};
setMode=function(next){cmsBaseMode(next);for(const id of ['severityFilter','severityTerms'])$(id).disabled=next==='pilot';if(next==='phrase')setSeverityMetric();};
for(const t of CMS_DATA.tags){NODE_DESCRIPTIONS[t.label]=t.description;NODE_POLICIES[t.label]=t.policy;}
for(const examples of Object.values(CMS_DATA.examples))for(const ex of examples)SOURCE_CONTEXTS[ex.id]={text:ex.text,tag:ex.tag};
