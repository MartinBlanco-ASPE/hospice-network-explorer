/* Study-specific year partitions of existing measures. Authoritative data stay intact. */
(()=>{'use strict';
 const Y=window.QCOR_YEAR_DATA,control=document.querySelector('.year-toolbar'),$=id=>control.querySelector('#'+id)||document.getElementById(id),prefix=Y.study==='homehealth'?'HOME_HEALTH':'HOSPICE';
 const api=window.QCOR_PRIMARY_CLASSIFICATION||window[prefix+'_SANKEY'],D=api.data,S=api.core.studies[Y.study],fmt=n=>Number(n).toLocaleString('en-US');
 const clone=x=>JSON.parse(JSON.stringify(x)),parse=(page,marker)=>{const start=page.indexOf(marker)+marker.length;let at=start,depth=0,string=false,escape=false;for(;at<page.length;at++){const c=page[at];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;}else if(c==='"')string=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth)return {value:JSON.parse(page.slice(start,at+1)),start,end:at+1};}throw Error('Missing year payload');};
 const original={network:window[prefix+'_CARE_AREA_NETWORK_PAGE'],word:window[prefix+'_CLASSIFICATION_WORD_PAGE']||window[prefix+'_CLASSIFICATION_PAGE'],sun:window[prefix+'_REGULATION_PAGE']};
 const markers={network:'window.CN_DATA = ',word:'window.CW_DATA = ',sun:'const ORIGINAL_FORMAT_DATA='};
 const payloads=Object.fromEntries(Object.keys(original).map(k=>[k,parse(original[k],markers[k])]));
 const N=payloads.network.value.studies[Y.study],W=payloads.word.value.studies[Y.study],T=payloads.sun.value;
 const sections=Uint8Array.from(atob(Y.section_column),c=>c.charCodeAt(0)),ci=new Map(Y.care_codes.map((c,i)=>[c,i]));
 let selected=Y.years.slice();
 const methodNote=document.createElement('p');methodNote.className='year-scope-note';if($('methodsScope'))$('methodsScope').append(methodNote);else $('methodsPage').prepend(methodNote);
 function aggregate(years){
  const out={n:0,named:0,multi:0,flagged:0,main_total:0,actor:0,with_statement:0,other:0,quoted:[0,0],nodes:N.nodes.map(()=>[0,0,0,0,0,0]),pairs:new Map(),words:new Map()};
  for(const year of years){const y=Y.by_year[year];for(const k of ['n','named','multi','flagged','main_total','actor','with_statement','other'])out[k]+=y[k];for(let k=0;k<2;k++)out.quoted[k]+=y.quoted[k];y.nodes.forEach((row,i)=>row.forEach((v,j)=>out.nodes[i][j]+=v));for(const [a,b,n,ab,ba]of y.pairs){const key=a+'|'+b,p=out.pairs.get(key)||[a,b,0,0,0];p[2]+=n;p[3]+=ab;p[4]+=ba;out.pairs.set(key,p);}for(const[c,w,n]of y.words){const key=c+'|'+w,v=out.words.get(key)||[c,w,0];v[2]+=n;out.words.set(key,v);}}
  return out;
 }
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 function graphPayload(a){
  const n=clone(N);n.citations=a.n;n.rows_named=a.named;n.rows_multi=a.multi;n.arrows_left_out=a.flagged;n.main_total=a.main_total;n.idg_actor_only=a.actor;
  if(n.quoted_rule){n.quoted_rule.citations=a.quoted[0];n.quoted_rule.quoting_rule=a.quoted[1];}
  n.nodes.forEach((node,i)=>['citations','main','main_multi','out','in'].forEach((key,j)=>node[key]=a.nodes[i][j]));
  const p=[...a.pairs.values()].map(([i,j,v,ab,ba])=>{const lift=v*a.n/(a.nodes[i][0]*a.nodes[j][0]),ppmi=Math.max(0,Math.log2(lift));return {i,j,v,ab,ba,lift,ppmi,key:[Y.care_codes[i],Y.care_codes[j]].sort().join('|')};});
  const eligible=p.filter(p=>p.v>=n.defaults.minimum&&p.lift>=n.defaults.lift),keep=new Set();
  for(let i=0;i<n.nodes.length;i++)eligible.filter(p=>p.i===i||p.j===i).sort((a,b)=>b.ppmi-a.ppmi||b.v-a.v||cmp(a.key,b.key)).slice(0,n.defaults.neighbors).forEach(p=>keep.add(p.key));
  const rounded=p=>[p.i,p.j,p.v,+p.lift.toFixed(3),+p.ppmi.toFixed(3),p.ab,p.ba];
  p.sort((a,b)=>b.v-a.v||cmp(a.key,b.key));n.pairs=p.map(rounded);n.links=p.filter(p=>keep.has(p.key)).map(rounded);return n;
 }
 function wordPayload(a,n){
  const w=clone(W),wi=new Map(w.care.map((c,i)=>[c.code,i]));w.citations=a.n;w.with_statement=a.with_statement;w.no_care_area=a.other;w.idg_actor_only=a.actor;
  for(const c of w.care){const i=ci.get(c.code);c.citations=a.nodes[i][0];c.primary=a.nodes[i][5];c.words=[];}
  for(const [i,word,n]of a.words.values())w.care[wi.get(Y.care_codes[i])].words.push([word,n]);
  w.care.forEach(c=>c.words.sort((a,b)=>b[1]-a[1]||cmp(a[0],b[0])));
  const wr=p=>[wi.get(Y.care_codes[p[0]]),wi.get(Y.care_codes[p[1]]),p[2],p[4]];
  w.links=n.links.map(wr);const have=new Set(w.links.map(p=>[p[0],p[1]].sort((a,b)=>a-b).join('|')));w.layout_links=[];
  for(const c of w.care){const i=ci.get(c.code),mine=n.pairs.filter(p=>p[4]>0&&(p[0]===i||p[1]===i)).sort((a,b)=>b[4]-a[4]||cmp([Y.care_codes[a[0]],Y.care_codes[a[1]]].sort().join('|'),[Y.care_codes[b[0]],Y.care_codes[b[1]]].sort().join('|'))).slice(0,2);for(const p of mine){const row=wr(p),ab=[row[0],row[1]].sort((a,b)=>a-b),key=ab.join('|');if(!have.has(key)){have.add(key);w.layout_links.push([...ab,row[2],row[3]]);}}}return w;
 }
 function sunPayload(indices){
  const t=clone(T),root=t.tree,bySection=new Map(),byPair=new Map(),members=new Set(indices);
  const make=()=>({n:0,ag:new Set(),issues:new Set()});const profile=(p,i)=>{p.n++;p.ag.add(S.agy[i]);p.issues.add(((S.flg[i]&4)?S.uncertain:S.car[i])+'|'+S.fai[i]);};
  const all=make();for(const i of indices){const s=sections[i],family=D.labels.family[S.families[S.fam[i]]].short,key=s+'|'+family;let a=bySection.get(s),b=byPair.get(key);if(!a)bySection.set(s,a=make());if(!b)byPair.set(key,b=make());profile(a,i);profile(b,i);profile(all,i);}
  const examples=D.context.examples.filter(e=>members.has(e.row_index));
  function update(node,p,sec,family){node.count=p.n;node.agencies=p.ag.size;if('issues'in node)node.issues=p.issues.size;for(const k of ['example','example_path','example_path_count','example_is_top'])delete node[k];const e=examples.find(e=>(sec===undefined||e.section===sec)&&(family===undefined||D.labels.family[S.families[e.f]].short===family));if(e){node.example=e;node.example_path={family:D.labels.family[S.families[e.f]],care:D.labels.care[S.care[e.c]],failure:D.labels.failure[S.failures[e.x]]};}}
  update(root,all);delete root.example;delete root.example_path;root.children=root.children.filter(parent=>bySection.has(Y.sections.indexOf(parent.name.replace('§ ',''))));
  for(const parent of root.children){const sec=parent.name.replace('§ ',''),s=Y.sections.indexOf(sec);update(parent,bySection.get(s),sec);parent.children=parent.children.filter(c=>byPair.has(s+'|'+c.name));for(const c of parent.children)update(c,byPair.get(s+'|'+c.name),sec,c.name);}
  t.N=all.n;t.agencies=all.ag.size;return t;
 }
 function replaceData(kind,value){const p=payloads[kind];return original[kind].slice(0,p.start)+JSON.stringify(value).replaceAll('<','\\u003c')+original[kind].slice(p.end);}
 function setPage(kind,value){if(kind==='word'&&window[prefix+'_CLASSIFICATION_WORD_PAGE']){window[prefix+'_CLASSIFICATION_WORD_PAGE']=value;return;}const names={sun:'REGULATION_PAGE',network:'CARE_AREA_NETWORK_PAGE',word:'CLASSIFICATION_PAGE'},frames={sun:'regulationsFrame',network:'careAreaNetworkFrame',word:'classificationFrame'};window[prefix+'_'+names[kind]]=value;const f=$(frames[kind]);if(f.srcdoc){if(control.ownerDocument===f.contentDocument)$('yearControlDock').append(control);f.srcdoc=value;}}
 function apply(years){
  selected=Y.years.filter(y=>years.includes(y));if(!selected.length)return false;
  window.QCOR_SELECTED_YEARS=selected.slice();const all=selected.length===Y.years.length,allowed=new Set(selected.map(y=>S.years.indexOf(y))),indices=[];
  for(let i=0;i<S.n;i++)if(allowed.has(S.yr[i]))indices.push(i);
  const agencies=new Set(indices.map(i=>S.agy[i])).size;
  if(all){for(const kind of ['sun','network','word'])setPage(kind,original[kind]);}
  else{const a=aggregate(selected),n=graphPayload(a),w=wordPayload(a,n),t=sunPayload(indices);const nd=clone(payloads.network.value),wd=clone(payloads.word.value);nd.studies[Y.study]=n;wd.studies[Y.study]=w;setPage('network',replaceData('network',nd));setPage('word',replaceData('word',wd));let sun=replaceData('sun',t);sun=sun.replace("sections=parents.map(p=>p.name.replace('§ ',''))",'sections='+JSON.stringify(Y.sections));const pairs=t.tree.children.reduce((n,p)=>n+p.children.length,0),families=new Set(t.tree.children.flatMap(p=>p.children.map(c=>c.name))).size;sun=sun.replace(/\d+ source-cited regulation sections and \d+ section-category connections spanning \d+ requirement categories\./,`${t.tree.children.length} source-cited regulation sections and ${pairs} section-category connections spanning ${families} requirement categories.`);setPage('sun',sun);}
  api.render();window[prefix+'_SANKEY_DETAIL']?.render();
  window.QCOR_RENDER_CLASSIFICATION_TREES?.();
  const text=all?'All years':selected.join(', ');$('yearPickerLabel').textContent='Year: '+(all?text:selected.length>2?selected.length+' years selected':text);$('yearPickerLabel').title=text;$('yearStatus').textContent=fmt(indices.length)+' citation rows · '+fmt(agencies)+' distinct source agencies';
  methodNote.textContent='Selected years: '+text+'. The year filter applies to every chart and source example. Fixed full-corpus reference totals in these methods describe All years; selected-year counts appear with the charts.';
  for(const c of $('yearOptions').querySelectorAll('input'))c.checked=selected.includes(c.value);
  $('yearError').hidden=true;$('yearPicker').open=false;return true;
 }
 for(const year of Y.years){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=year;input.checked=true;input.id='year-'+year;label.append(input,document.createTextNode(year));$('yearOptions').append(label);}
 $('yearApply').onclick=()=>{const years=[...$('yearOptions').querySelectorAll('input:checked')].map(c=>c.value);if(!years.length){$('yearError').hidden=false;return;}apply(years);};
 $('yearAll').onclick=()=>apply(Y.years);
 $('yearPicker').addEventListener('toggle',()=>{if($('yearPicker').open){for(const c of $('yearOptions').querySelectorAll('input'))c.checked=selected.includes(c.value);$('yearError').hidden=true;const menu=control.querySelector('.year-menu');menu.style.left='auto';menu.style.right='0';const box=menu.getBoundingClientRect();if(box.left<8){menu.style.left=(8-$('yearPicker').getBoundingClientRect().left)+'px';menu.style.right='auto';}}});
 $('yearPicker').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();$('yearPicker').open=false;$('yearPickerLabel').focus();}});
 const boundDocuments=new WeakSet();
 function bindDocument(doc){if(boundDocuments.has(doc))return;boundDocuments.add(doc);doc.addEventListener('click',e=>{if(!$('yearPicker').contains(e.target))$('yearPicker').open=false;});}
 function mount(){
  const page=window.ISSUE_GRAPH.state.page;let target=null;
  if(page==='policy')target=$('careIssueHeatmapFrame').contentDocument?.querySelector('.filters');
  if(page==='classification')target=document.querySelector('#classificationPage .claude-network-heading');
  if(page==='regulations'||page==='network'){const frame=$(page==='regulations'?'regulationsFrame':'careAreaNetworkFrame');target=frame.contentDocument?.querySelector(page==='regulations'?'.heading':'.card-head .chart-actions');}
  if(!target){$('yearControlDock').append(control);return;}
  const doc=target.ownerDocument;bindDocument(doc);
  if(doc!==document&&!doc.getElementById('qcorYearControlStyle')){const style=doc.createElement('style');style.id='qcorYearControlStyle';style.textContent=window.QCOR_YEAR_CSS;doc.head.append(style);}
  if(page==='regulations')target.classList.add('year-title-card');
  if(control.parentNode!==target){$('yearPicker').open=false;target.append(control);}
 }
 bindDocument(document);window.addEventListener('qcor-dashboard-page',mount);
 for(const id of ['regulationsFrame','careAreaNetworkFrame','careIssueHeatmapFrame'])$(id).addEventListener('load',mount);
 // Initial all-years render stays byte-for-byte on its adopted datasets.
 window.QCOR_SELECTED_YEARS=selected.slice();$('yearStatus').textContent=fmt(S.n)+' citation rows · '+fmt(S.nAgency)+' distinct source agencies';methodNote.textContent='Year selection applies to every visualization. All years is the default; the reference totals below describe the complete corpus.';
 window.QCOR_YEARS={apply,aggregate,graphPayload,wordPayload,sunPayload,get selected(){return selected.slice();},get rowIndices(){const s=new Set(selected.map(y=>S.years.indexOf(y)));return Array.from({length:S.n},(_,i)=>i).filter(i=>s.has(S.yr[i]));}};
 mount();
})();
