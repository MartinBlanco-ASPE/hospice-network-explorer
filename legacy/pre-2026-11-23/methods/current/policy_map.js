/* Existing policy anchors, arranged for local exploration. No case-to-law adjudication. */
(() => {
 const titles={
  '418.22':'Certification of terminal illness','418.24':'Election of hospice care',
  '418.52':'Patient rights','418.54':'Initial and comprehensive assessment',
  '418.56':'Care planning and coordination','418.58':'Quality assessment and performance improvement',
  '418.60':'Infection control','418.64':'Core services','418.76':'Hospice aide services',
  '418.78':'Volunteers','418.100':'Organization and administration of services',
  '418.102':'Medical director','418.104':'Clinical records','418.106':'Drugs, supplies and equipment',
  '418.110':'Inpatient care in hospice facilities','418.114':'Personnel qualifications',
  '489.3':'Immediate jeopardy definition · general context'
 };
 const sectionOf=ref=>ref.label.match(/\d+\.\d+/)[0];
 const root=elem('main');root.id='policyMap';root.hidden=true;root.setAttribute('aria-label','Hospice issue and policy map');
 $('workspace').before(root);
 const state={query:'',kind:'care',section:'all',sort:'coverage',metric:'coverage',selected:'care plan'};
 const base=DATA.views.all.nodes.filter(n=>n.id<64).map(n=>({...n,isSeverity:false}));
 const nodes=base.concat(SEVERITY.families.map(f=>({...f,isSeverity:true,examples:SEVERITY.examples[f.id]||[]})));
 const counts=new Map(nodes.map(n=>[n.id,{records:0,providers:new Set()}]));
 const allProviders=new Set();
 for(const r of DATA.filterRows.rows){
  const provider=r[1]>=0?DATA.filterRows.providers[r[1]].toUpperCase():null;
  if(provider)allProviders.add(provider);
  const ids=new Set();for(let k=0;k<r[10].length;k+=2)ids.add(r[10][k]);
  for(const family of (SEVERITY.records[String(r[0])]||[0,0,0,0,[],[]])[4])ids.add(64+family[0]);
  for(const id of ids){const c=counts.get(id);if(!c)continue;c.records++;if(provider)c.providers.add(provider);}
 }
 for(const n of nodes){n.policy=NODE_POLICIES[n.label];n.sections=[...new Set(n.policy.links.map(sectionOf))];n.coverage=counts.get(n.id).providers.size;n.recordCount=counts.get(n.id).records;}
 const sections=[...new Set(nodes.flatMap(n=>n.sections))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const make=(tag,cls,text)=>elem(tag,cls||'',text||'');
 function link(label,url,cls){const a=make('a',cls,label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
 function button(text,fn,cls='pm-button'){const b=make('button',cls,text);b.type='button';b.onclick=fn;return b;}
 function sectionURL(s){return 'https://www.ecfr.gov/current/title-42/section-'+s;}

 const layout=make('div','pm-layout'),panel=make('section','pm-panel'),heading=make('div','pm-panel-head');heading.append(make('h2','','42 CFR Part 418 — Hospice Care'));heading.querySelector('h2').append(link('eCFR','https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-418','pm-cfr-link'));
 const caption=make('div','pm-caption'),results=make('span'),key=make('span','pm-dot-key','Length = distinct agencies · darker = more matching records');results.id='pmResults';results.setAttribute('role','status');caption.append(results,key);
 const chartHost=make('div','pm-chart-host');
 panel.append(heading,caption,chartHost);const detail=make('aside','pm-panel pm-detail');detail.id='pmDetail';detail.setAttribute('aria-label','Selected issue and policy evidence');layout.append(panel,detail);root.append(layout);
 const sunburst=createPolicySunburst({host:chartHost,make,button,sections,titles,state,nodes,onSection:s=>{state.section=s;draw();},onIssue:n=>selectIssue(n,true)});
 root.addEventListener('keydown',e=>{if(e.key==='Escape')sunburst.clear();});
 const foot=make('section','pm-foot'),guide=make('article'),sources=make('article');
 guide.append(make('h3','','What the sunburst measures'),make('p','','The chart shows care wording only. Every ray has the same minimum space for its full label. Additional length shows distinct agencies (assigned hospice CCNs) on a linear scale fixed across all 64 care phrases. Equal angular widths count policy mappings; hues distinguish regulations. Within each regulation, lighter rays mean fewer matching records and darker rays mean more. Each category uses its own minimum-to-maximum record scale; shades are not comparable across categories. A care phrase repeats its corpus-wide frequency under each linked policy; these are not policy-specific citation counts. Length does not measure harm or policy importance.'),make('p','','Coverage in the issue details counts distinct assigned hospice CCNs with matching wording in 67,594 candidate care records, using evidence-oriented text. The same hospice can appear under many issues. Coverage describes text in this corpus; it is not a patient-harm count or a noncompliance rate.'),make('p','','This view uses the full candidate corpus. Network surveyor, year, survey-context and severity filters do not carry over. Issue search and regulation filters change the displayed branches, not the underlying coverage denominator.'));
 const methods=make('details');methods.append(make('summary','','Mapping and review status'),make('p','','Mappings reuse the 64 care-feature and nine severity-family policy anchors checked November 5, 2026. They are research reference relationships, not source-reported regulatory citations or adjudicated violations. A word can describe requirements, negation, allegations or another subject. Inpatient-only provisions and general harm context require particular care. Exact survey-date applicability, independent semantic validation and Phase 4 policy-result synthesis remain pending.'));
 guide.append(methods);
 sources.append(make('h3','','Read the policy in context'),make('p','','Federal regulations supply the linked requirements. CMS survey guidance helps interpret them; manual guidance and final-rule changes should be checked for the version applicable to each survey date. This map makes the existing reference links visible without assessing policy gaps or effectiveness.'));
 const library=make('div','pm-library');library.append(link('42 CFR Part 418','https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-418'),link('CMS Appendix M','https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/som107ap_m_hospice.pdf'),link('Methods & limits','METHODS_AND_LIMITATIONS.html'),link('Pilot codebook','CODEBOOK.html'));
 sources.append(library,make('p','','Policy anchors last checked: November 5, 2026. Links open current references online; the dashboard and embedded evidence work locally.'),button('Open original 48-record coding view',()=>setMode('pilot')));foot.append(guide,sources);root.append(foot);
 function filtered(){const q=state.query.trim().toLowerCase();return nodes.filter(n=>!n.isSeverity&&(state.section==='all'||n.sections.includes(state.section))).sort((a,b)=>state.sort==='alpha'?a.label.localeCompare(b.label):b.coverage-a.coverage||a.label.localeCompare(b.label));}
 function selectIssue(n,focusDetail=false){state.selected=n.label;sunburst.select(n);drawDetail(n);if(focusDetail&&innerWidth<=1100)detail.scrollIntoView({behavior:'smooth',block:'start'});}
 function draw(){
  const visible=filtered(),relationships=visible.reduce((sum,n)=>sum+(state.section==='all'?n.sections.length:1),0);results.textContent=visible.length+' unique issues · '+relationships+' issue–section connections';
  chartHost.replaceChildren();
  if(!visible.length){chartHost.append(make('p','pm-empty','No issues match these filters. Try another term or Reset.'));detail.replaceChildren(make('h2','','No matching issues'),make('p','','Reset the filters to browse the full policy map.'));return;}
  if(!visible.some(n=>n.label===state.selected))state.selected=visible[0].label;
  sunburst.render(visible);selectIssue(visible.find(n=>n.label===state.selected));
 }
 function drawDetail(n){
  detail.replaceChildren(make('div','pm-eyebrow','Selected issue'),make('h2','',n.label),make('span','pm-type'+(n.isSeverity?' severity':''),n.isSeverity?'Provisional severity family':'Research-defined wording feature'));
  detail.querySelector('h2').id='pmIssueHeading';detail.querySelector('h2').tabIndex=-1;
  detail.append(make('p','',n.policy.explanation));
  const coverage=make('div','pm-source-count');coverage.append(make('strong','',count(n.coverage)+' distinct hospices'),make('div','',count(n.recordCount)+' matching candidate records · '+(100*n.coverage/allProviders.size).toFixed(1)+'% of '+count(allProviders.size)+' identified corpus hospices'));detail.append(coverage);
  detail.append(make('h3','','Federal policy anchors'));
  for(const ref of n.policy.links){const s=sectionOf(ref);detail.append(link(ref.label+' ↗',ref.url,'pm-ref'));}
  if(n.policy.note)detail.append(make('p','pm-status-note',n.policy.note));
  const nearby=nodes.filter(other=>!other.isSeverity&&other.id!==n.id&&other.sections.some(s=>n.sections.includes(s))).sort((a,b)=>b.coverage-a.coverage).slice(0,6);
  if(nearby.length){detail.append(make('h3','','Other issues sharing these sections'));const related=make('div','pm-related');for(const other of nearby)related.append(button(other.label,()=>{state.selected=other.label;state.section='all';draw();},''));detail.append(related);}
  const examples=make('details');examples.append(make('summary','','Read illustrative source evidence ('+(n.examples||[]).length+')'));const exampleBox=make('div','pm-source-examples');renderExampleList(n,'',exampleBox);examples.append(make('p','','Saved examples show wording and source-row provenance. They are not an exhaustive or representative sample, and their source tags may differ from the policy anchors above.'),exampleBox);detail.append(examples);
 }
 function exportMap(){const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';const rows=[['issue','vocabulary','regulation','policy_url','relationship_explanation','scope_note','distinct_hospices','matching_records','corpus_hospices','text_handling','reference_checked','applicability']];for(const n of filtered())for(const ref of n.policy.links)if(state.section==='all'||sectionOf(ref)===state.section)rows.push([n.label,n.isSeverity?'provisional severity family':'care wording feature',ref.label,ref.url,n.policy.explanation,n.policy.note,n.coverage,n.recordCount,allProviders.size,'evidence-oriented; full candidate corpus','2026-11-05','current reference; survey-date applicability pending']);download('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n'),'hospice_issue_policy_mapping.csv','text/csv;charset=utf-8');}
 const previousMode=setMode;
 setMode=function(next){
  if(next==='policy'){if(root.hidden&&mode==='phrase')guidedState.phraseState=guidedSettings();$('workspace').style.display='none';$('methods').style.display='none';root.hidden=false;for(const id of ['phraseTab','pilotTab','methodsTab'])$(id).classList.toggle('active',id==='pilotTab');draw();return;}
  root.hidden=true;previousMode(next);
 };
 $('pilotTab').textContent='Issues & policy';$('pilotTab').onclick=()=>setMode('policy');
 window.POLICY_MAP={open:()=>setMode('policy'),nodes,sections,counts,filtered,exportMap,state};
})();
