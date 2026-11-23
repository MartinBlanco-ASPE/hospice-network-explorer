/* Equal mapping angles; a shared label base plus linear frequency extension. */
function createPolicySunburst({host,make,button,sections,titles,state,nodes,onSection,onIssue}){
 const NS='http://www.w3.org/2000/svg',TAU=Math.PI*2;
 // Rainbow progression adapted from the user's supplied reference image.
 const palette=['#9C27B0','#7030A0','#45399C','#2469BD','#008ACB','#00A3C7','#00A7AA','#008F78','#339B45','#77AE36','#A8C628','#D1CB16','#F0BE00','#EB9000','#F05219','#DE2555','#C91063'];
 const color=s=>palette[sections.indexOf(s)%palette.length];
 function rgb(hex){return hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16));}
 function luminance(hex){const c=rgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function textFor(background){const dark='#111111',light='#FFFFFF',best=contrast(background,dark)>=contrast(background,light)?dark:light;return contrast(background,best)>=4.5?best:'#000000';}
 function leafColor(hex,strength){return tint(hex,.78*(1-strength));}
 function recordRange(section){const values=nodes.filter(n=>!n.isSeverity&&n.sections.includes(section)).map(n=>n.recordCount);return {min:Math.min(...values),max:Math.max(...values)};}
 let svg,tooltip,stage,clearButton,locked=null,preview=null,suppressHover=false;
 const tint=(hex,amount)=>'#'+rgb(hex).map(v=>Math.round(v+(255-v)*amount).toString(16).padStart(2,'0')).join('');
 function matches(e,key){const kind=e.dataset.kind||e.dataset.labelKind;return key.kind==='section'?e.dataset.section===key.section:kind==='issue'&&e.dataset.issue===key.issue||kind==='section'&&key.sections.includes(e.dataset.section);}
 function paint(){
  if(!svg)return;const key=locked?.key||preview;
  for(const p of svg.querySelectorAll('.pm-arc')){const active=!key||matches(p,key),base=p.dataset.baseFill||(p.dataset.baseFill=p.getAttribute('fill'));p.setAttribute('fill',base);p.classList.toggle('pm-highlight',!!key&&active);p.classList.toggle('pm-muted',!active);p.classList.toggle('pm-selected',!!key&&active&&p.dataset.issue===state.selected);p.setAttribute('aria-pressed',String(!!locked&&active));}
  for(const t of svg.querySelectorAll('text[data-background]')){const base=t.dataset.baseBackground||(t.dataset.baseBackground=t.dataset.background),background=base;t.dataset.background=background;t.style.fill=textFor(background);}
  // Separate focus layer: retain the underlying frequency fills and geometry.
  svg.querySelector('#pmHighlightLayer')?.remove();
  if(key){
   const layer=el('g',{id:'pmHighlightLayer','aria-hidden':'true','pointer-events':'none'});
   for(const p of svg.querySelectorAll('.pm-arc')){
    const active=matches(p,key);
    layer.append(el('path',{d:p.getAttribute('d'),fill:active?'none':'#FFFFFF','fill-opacity':active?0:.76,stroke:active?'#173f4b':'none','stroke-width':active?3:0,'stroke-linejoin':'round',class:active?'pm-highlight-outline':'pm-highlight-veil','data-section':p.dataset.section,'data-issue':p.dataset.issue||''}));
   }
   svg.append(layer);
  }
  const note=svg.querySelector('.pm-center-note');if(note)note.textContent=locked?'Click center to clear highlight':svg.dataset.connections+' mapped connections';
 }
 function clearPinned(){const refocus=document.activeElement===clearButton;locked=null;preview=null;suppressHover=true;if(clearButton)clearButton.hidden=true;if(tooltip)tooltip.hidden=true;paint();if(refocus)host.querySelector('#pmSunburstBack')?.focus();}
 function pin(key,lines){locked={key,lines};preview=null;if(tooltip)tooltip.hidden=true;if(clearButton)clearButton.hidden=false;paint();}
 function focusZoom(){host.querySelector('#pmSunburstBack[role="button"]')?.focus();}
 function focusSection(s){host.querySelector('.pm-section-arc[data-section="'+s+'"]')?.focus();}
 function el(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
 function point(r,a){return [450+r*Math.sin(a),450-r*Math.cos(a)];}
 function arc(r0,r1,a,b){
  const span=b-a;
  if(span>=TAU-1e-8){const p=point(r1,a),q=point(r1,a+Math.PI),i=point(r0,a),j=point(r0,a+Math.PI);return `M${p}A${r1},${r1} 0 1 1 ${q}A${r1},${r1} 0 1 1 ${p}L${i}A${r0},${r0} 0 1 0 ${j}A${r0},${r0} 0 1 0 ${i}Z`;}
  const p=point(r1,a),q=point(r1,b),i=point(r0,b),j=point(r0,a),large=span>Math.PI?1:0;return `M${p}A${r1},${r1} 0 ${large} 1 ${q}L${i}A${r0},${r0} 0 ${large} 0 ${j}Z`;
 }
 function wrap(text,max){const words=text.split(' '),lines=[];let line='';for(const w of words){if(line&&line.length+w.length+1>max){lines.push(line);line=w;}else line+=(line?' ':'')+w;}if(line)lines.push(line);return lines;}
 function showTip(path,lines,event){
  if(!tooltip)return;tooltip.replaceChildren(...lines.map((line,i)=>make(i?'span':'strong','',line)));tooltip.hidden=false;
  const rect=stage.getBoundingClientRect(),bounds=path.getBoundingClientRect();const x=event?.clientX??bounds.x+bounds.width/2,y=event?.clientY??bounds.y+bounds.height/2;
  tooltip.style.left=Math.max(8,Math.min(x-rect.left+15,rect.width-tooltip.offsetWidth-8))+'px';tooltip.style.top=Math.max(8,Math.min(y-rect.top+15,rect.height-tooltip.offsetHeight-8))+'px';
 }
 function clearHover(){preview=null;if(tooltip)tooltip.hidden=true;paint();}
 function interactive(path,label,activate,lines,key){
  path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label',label);
  const choose=()=>{pin(key,lines);activate();};path.onclick=choose;
  path.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();if(path.dataset.kind==='issue')document.querySelector('#pmIssueHeading')?.focus({preventScroll:true});}else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...svg.querySelectorAll('.pm-arc')],at=items.indexOf(path),next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+items.length)%items.length;items[next].focus();}else if(e.key==='Escape'){e.preventDefault();clearPinned();}};
  const hover=e=>{if(suppressHover&&e&&!locked)return;if(!locked){preview=key;paint();}showTip(path,lines,e);};
  path.onpointerenter=hover;path.onpointermove=e=>{suppressHover=false;hover(e);};path.onpointerleave=clearHover;path.onfocus=()=>hover();path.onblur=clearHover;
 }
 function label(text,r,a,cls,background,section,issue){const deg=a*180/Math.PI,flip=deg>180&&deg<360,p=point(r,a);const t=el('text',{x:p[0],y:p[1],transform:`rotate(${deg-90+(flip?180:0)} ${p})`,'text-anchor':'middle','dominant-baseline':'middle',class:cls,'aria-hidden':'true','data-radius':r,'data-background':background,'data-section':section,'data-label-kind':issue?'issue':'section'},text);if(issue){t.dataset.issue=issue;const lines=wrap(text,22);t.textContent='';for(const [i,line] of lines.entries())t.append(el('tspan',{x:p[0],dy:i?12:-(lines.length-1)*6},line));}t.style.fill=textFor(background);svg.append(t);}
 function select(n){
  for(const p of host.querySelectorAll('[data-kind="issue"]')){const selected=p.dataset.issue===n.label;p.classList.toggle('pm-selected',selected);p.setAttribute('aria-pressed',String(selected));}
  for(const b of host.querySelectorAll('.pm-issue')){const selected=b.dataset.issue===n.label;b.classList.toggle('pm-selected',selected);b.setAttribute('aria-pressed',String(selected));}
  paint();
 }
 function render(visible){
  host.replaceChildren();preview=null;
  const metric='coverage',maximum=Math.max(1,...nodes.filter(n=>!n.isSeverity).map(n=>n.coverage)),unit='distinct agencies';
  const innerRadius=244,labelBase=170,rayRange=100;
  const branches=(state.section==='all'?sections:[state.section]).map(s=>({section:s,issues:visible.filter(n=>n.sections.includes(s))})).filter(b=>b.issues.length),total=branches.reduce((n,b)=>n+b.issues.length,0);
  if(locked&&!branches.some(b=>locked.key.kind==='section'?b.section===locked.key.section:b.issues.some(n=>n.label===locked.key.issue)))locked=null;
  const breadcrumb=make('div','pm-breadcrumb');breadcrumb.append(button('All policy anchors',()=>{clearPinned();onSection('all');},'pm-breadcrumb-root'));if(state.section!=='all')breadcrumb.append(make('span','','/'),make('span','','§ '+state.section+' · '+titles[state.section]));else breadcrumb.append(make('span','','/'),make('span','','Hover to preview · click to lock'));host.append(breadcrumb);
  stage=make('div','pm-sunburst-stage');
  clearButton=button('Clear highlight',clearPinned,'pm-button pm-clear-highlight');clearButton.id='pmClearHighlight';clearButton.hidden=!locked;stage.append(clearButton);
  svg=el('svg',{id:'pmSunburst',viewBox:'-100 -100 1100 1100',role:'group','aria-label':'Hospice issues mapped to federal regulatory sections','aria-describedby':'pmSunburstDesc'});
  svg.dataset.connections=total;
  svg.append(el('desc',{id:'pmSunburstDesc'},`${visible.length} unique issues in ${total} issue–section relationships. Each ray has an equal label base, with additional length proportional to ${unit}, on a fixed full-corpus scale from zero to ${count(maximum)}. Darker rays indicate more matching records within each regulatory category; shade ranges are independent across categories. Equal angles represent mappings. Hover to preview; click or press Enter to lock a branch. Escape clears the highlight. Arrow keys move between sectors. Repeated issues have the same corpus-wide frequency in every policy branch, not policy-specific citation counts.`));
  svg.dataset.metric=metric;svg.dataset.maximum=maximum;
  for(const fraction of [0,.5,1])svg.append(el('circle',{cx:450,cy:450,r:innerRadius+labelBase+rayRange*fraction,fill:'none',stroke:'#d8e4e1','stroke-width':1,'stroke-dasharray':'3 4',class:'pm-frequency-guide','data-value':maximum*fraction}));
  svg.append(el('circle',{cx:450,cy:450,r:innerRadius,fill:'none',stroke:'#edf3f2','stroke-width':1}));
  let start=0;
  for(const branch of branches){
   const range=recordRange(branch.section);
   const s=branch.section,end=start+TAU*branch.issues.length/total,shade=color(s),mid=(start+end)/2,gap=branches.length>1?.004:0;
   const p=el('path',{d:arc(130,237,start+gap,end-gap),class:'pm-arc pm-section-arc',fill:shade,'data-kind':'section','data-section':s,'data-weight':branch.issues.length,'data-start':start,'data-end':end});
   interactive(p,'Lock highlight for § '+s+' · '+titles[s]+' · '+branch.issues.length+' mapped issues',()=>{},['§ '+s,titles[s],branch.issues.length+' mapped issues','Select an outer issue for policy links and source evidence'],{kind:'section',section:s});svg.append(p);
   if(branches.length>1){const narrow=end-start<.1;label('§ '+s,narrow?200:183,mid,'pm-section-label'+(narrow?' pm-section-label-narrow':''),shade,s);}
   if(branches.length===1){const t=el('text',{x:450,y:265,'text-anchor':'middle',class:'pm-section-label','aria-hidden':'true','data-background':shade,'data-section':s,'data-label-kind':'section'},'§ '+s+' · '+branch.issues.length+' mapped issues');t.style.fill=textFor(shade);svg.append(t);}
   let at=start;const step=(end-start)/branch.issues.length;
   for(const n of branch.issues){const next=at+step,middle=(at+next)/2,strength=range.max===range.min?1:(n.recordCount-range.min)/(range.max-range.min),leafShade=leafColor(shade,strength),length=labelBase+rayRange*n[metric]/maximum,outerRadius=innerRadius+length,leaf=el('path',{d:arc(innerRadius,outerRadius,at+.0018,next-.0018),class:'pm-arc pm-issue-arc',fill:leafShade,'data-kind':'issue','data-section':s,'data-issue':n.label,'data-weight':1,'data-start':at,'data-end':next,'data-value':n[metric],'data-matching-records':n.recordCount,'data-record-min':range.min,'data-record-max':range.max,'data-shade-strength':strength,'data-inner-radius':innerRadius,'data-label-base':labelBase,'data-outer-radius':outerRadius});
    interactive(leaf,n.label+' · § '+s+' · '+count(n[metric])+' '+unit+' · '+count(n.recordCount)+' matching records · lock highlight and read source evidence',()=>onIssue(n),[n.label,'§ '+s+' · '+titles[s],n.isSeverity?'Source-cited deficiency tag':'Care wording feature',count(n.recordCount)+' matching records · '+count(n.coverage)+' distinct hospices','Shade compares matching records within this policy branch ('+count(range.min)+'–'+count(range.max)+'). Counts are corpus-wide.'],{kind:'issue',issue:n.label,sections:n.sections});svg.append(leaf);
    label(n.label,innerRadius+labelBase/2,middle,'pm-leaf-label',leafShade,s,n.label);at=next;
   }
   start=end;
  }
  const center=el('g',{id:'pmSunburstBack',class:'pm-sunburst-center'});center.append(el('circle',{cx:450,cy:450,r:120,fill:'#f5f9f8',stroke:'#dce9e6','stroke-width':1}));
  const centered=state.section==='all';
  center.append(el('text',{x:450,y:centered?414:400,'text-anchor':'middle',class:'pm-center-eyebrow'},centered?'HOSPICE POLICY':'REGULATORY SECTION'));
  center.append(el('text',{x:450,y:centered?458:440,'text-anchor':'middle',class:'pm-center-value'},centered?String(visible.length):'§ '+state.section));
  if(centered){center.append(el('text',{x:450,y:485,'text-anchor':'middle',class:'pm-center-sub'},'unique issues'),el('text',{x:450,y:510,'text-anchor':'middle',class:'pm-center-note'},total+' mapped connections'));}
  else{wrap(titles[state.section],23).slice(0,3).forEach((line,i)=>center.append(el('text',{x:450,y:467+i*18,'text-anchor':'middle',class:'pm-center-sub'},line)));center.append(el('text',{x:450,y:529,'text-anchor':'middle',class:'pm-center-back'},'Clear highlight'));}
  center.setAttribute('role','button');center.setAttribute('tabindex','0');center.setAttribute('aria-label','Clear highlight');center.onclick=clearPinned;center.onkeydown=e=>{if(e.key==='Enter'||e.key===' '||e.key==='Escape'){e.preventDefault();clearPinned();}};
  svg.append(center);tooltip=make('div','pm-chart-tooltip');tooltip.hidden=true;tooltip.setAttribute('aria-hidden','true');stage.append(svg,tooltip);host.append(stage);
  const note=make('p','pm-chart-note','Every ray includes the same label space. Extra length = '+unit+' · linear scale: 0 / '+count(maximum/2)+' / '+count(maximum)+' at the label-base / middle / outer guide rings. Darker shades mean more matching records within each policy category; lightest = category minimum and darkest = maximum. Shade scales differ between categories. The length scale stays fixed across policy branches. Each assigned agency counts once per phrase. The same issue repeats its corpus-wide value under every linked policy; these are not policy-specific citation counts.');host.append(note);
  const legend=make('div','pm-section-legend');legend.setAttribute('aria-label','Regulations shown in the sunburst');
  for(const b of branches){const key=button('',()=>pin({kind:'section',section:b.section},['§ '+b.section,titles[b.section],b.issues.length+' mapped issues','Select an outer issue for policy links and source evidence']),'pm-section-key');key.dataset.section=b.section;const range=recordRange(b.section);key.style.setProperty('--section-color','linear-gradient(to top,'+leafColor(color(b.section),0)+','+color(b.section)+')');const swatch=make('span','pm-section-swatch');swatch.setAttribute('aria-hidden','true');const text=make('span');text.append(make('strong','','§ '+b.section),make('span','',titles[b.section]),make('span','',count(range.min)+'–'+count(range.max)+' matching records'));key.append(swatch,text,make('span','pm-key-count',String(b.issues.length)));key.setAttribute('aria-label','Lock highlight for § '+b.section+' · '+titles[b.section]+' · '+b.issues.length+' mapped issues');legend.append(key);}host.append(legend);
  const list=make('details','pm-issue-browser');list.id='pmIssueBrowser';list.open=state.section!=='all'||innerWidth<600;list.append(make('summary','','Browse '+visible.length+' unique issues as a list'));const items=make('div','pm-issue-list');
  for(const n of visible){const b=button('',()=>{pin({kind:'issue',issue:n.label,sections:n.sections},[n.label,count(n.recordCount)+' matching records · '+count(n.coverage)+' distinct hospices','Policy links and source evidence are shown in the issue details']);onIssue(n);},'pm-issue');b.dataset.issue=n.label;b.append(make('span','pm-issue-name',(n.isSeverity?'◇ ':'')+n.label),make('span','pm-issue-meta',count(n[metric])+' '+unit+' · '+n.sections.length+' policy sections'));items.append(b);}list.append(items);host.append(list);
  if(locked)pin(locked.key,locked.lines);else paint();
 }
 return {render,select,clear:clearPinned};
}
