/* Hospice-only deletion simulation. Exact route applies only to the checked
   reference topology. Changed topologies use a labeled greedy target route. */
(()=>{
 'use strict';
 const reference=__HOSPICE_REMOVAL_REFERENCE__;
 const stage=$('mapStage'),heading=document.querySelector('.map-heading'),workspace=$('workspace'),panel=document.querySelector('.controls'),evidence=$('evidence');
 const view=$('guidedView').closest('.guided-field');view.classList.add('title-view');heading.prepend(view);
 const info=elem('details','map-view-details');info.append(elem('summary','','View details'),$('mapTitle'),$('mapCounts'));panel.append(info);
 const toggleLabel=elem('label','sim-toggle'),toggle=elem('input');toggle.type='checkbox';toggle.id='simulationToggle';toggle.setAttribute('role','switch');toggle.setAttribute('aria-controls','simulationPanel simulationPlayback');toggleLabel.append(toggle,document.createTextNode('Simulation'));heading.insertBefore(toggleLabel,heading.querySelector('.map-tools'));
 const box=elem('section','panel sim-panel');box.id='simulationPanel';box.hidden=true;box.setAttribute('aria-label','Simulation information');
 box.innerHTML='<div class="kicker">Simulation</div><h2>Separate the severity diamonds</h2><label for="removalStrategy">Removal order</label><select id="removalStrategy"><option value="target">Shortest route to disconnect diamonds</option><option value="degree">Most connected first</option><option value="random">Random phrase order</option></select><p id="removalRouteNote"></p><button id="removalSeverityView" class="btn" type="button">Show severity view</button><div id="removalStats" class="sim-stats" role="status" aria-live="polite"></div><label for="manualRemoval">Remove a phrase</label><div class="manual-removal-row"><select id="manualRemoval" aria-label="Choose a phrase to remove"></select><button id="manualRemove" class="btn" type="button">Remove</button></div><p class="sim-hint">Or click a phrase in the map. Use × on a removed pill to restore it.</p><h3 id="removedTitle">Removed: 0</h3><div id="removedPhrases" class="removed-pills" aria-labelledby="removedTitle"></div><details class="sim-help"><summary>About this experiment</summary><p>Only phrases and their existing links are removed. Diamonds stay visible. Disconnected pieces are packed to fit the map. After a split, colors identify connected pieces. A main network must contain more than half of the remaining nodes. This is a text-network experiment, not a prediction of hospice care.</p></details>';
 workspace.append(box);
 const pieceKey=elem('div','simulation-piece-key');pieceKey.id='simulationPieceKey';pieceKey.setAttribute('aria-label','Connected piece colors');$('removalStats').after(pieceKey);
 box.append(simulationMethodCard());
 box.append(wordingSimulationMethodCard());
 box.querySelector('h2').id='simulationHeading';box.querySelector('.sim-hint').id='manualRemovalHint';
 const wordingUI=createWordingSimulationUI(box,stage);installSimulationMathGuides();
 const piecePalette=['#638f9a','#d17e45','#7866ac','#477dae','#aa5b79','#648f50','#ac8b3c'];
 const pieceColor=i=>piecePalette[i]||`hsl(${Math.round(i*137.508)%360} 45% 43%)`;
 const pillTooltip=elem('div','removed-pill-tooltip');pillTooltip.id='removedPillTooltip';pillTooltip.hidden=true;pillTooltip.setAttribute('role','tooltip');document.body.append(pillTooltip);
 let tooltipNode=null,tooltipTimer=null;
 function hidePillTooltip(){clearTimeout(tooltipTimer);pillTooltip.hidden=true;tooltipNode=null;}
 function showPillTooltip(pill){
  clearTimeout(tooltipTimer);const id=[...base.phrases].find(id=>String(id)===pill.dataset.node),label=base.labels.get(id);
  tooltipNode=id;pillTooltip.replaceChildren(elem('strong','',label),elem('p','',NODE_DESCRIPTIONS[label]||'Read the matching wording and source examples to interpret this lexical feature.'));pillTooltip.hidden=false;
  const anchor=pill.getBoundingClientRect(),height=pillTooltip.offsetHeight,width=pillTooltip.offsetWidth;
  pillTooltip.style.left=Math.max(10,Math.min(anchor.left,innerWidth-width-10))+'px';
  pillTooltip.style.top=Math.max(10,Math.min(anchor.bottom+8+height<=innerHeight?anchor.bottom+8:anchor.top-height-8,innerHeight-height-10))+'px';
 }
 function deferPillTooltip(){clearTimeout(tooltipTimer);tooltipTimer=setTimeout(()=>{const focused=document.activeElement?.closest('.removed-pill');if(focused&&!pillTooltip.hidden)showPillTooltip(focused);else hidePillTooltip();},150);}
 pillTooltip.onpointerenter=()=>clearTimeout(tooltipTimer);pillTooltip.onpointerleave=deferPillTooltip;
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hidePillTooltip();});
 window.addEventListener('scroll',()=>{const focused=document.activeElement?.closest('.removed-pill');if(!pillTooltip.hidden&&focused)showPillTooltip(focused);else hidePillTooltip();},true);window.addEventListener('resize',hidePillTooltip);
 const playback=elem('section','sim-playback');playback.id='simulationPlayback';playback.hidden=true;playback.setAttribute('aria-label','Simulation playback');
 playback.innerHTML='<div class="sim-buttons"><button id="removalPlay" class="btn primary" type="button">▶ Play</button><button id="removalReset" class="btn" type="button">Reset</button><output id="removalLabel" for="removalCount">0 / 40</output></div><label class="sr-only" for="removalCount">Number of phrases removed, up to 40</label><input id="removalCount" type="range" min="0" max="40" value="0" step="1">';stage.append(playback);
 let active=false,base=null,order=[],gone=[],timer=null,exact=false,manual=false,exportStates=[],legendOpen=true,wordingData=null,wordingBusy=false,wordingWorker=null,wordingGeneration=0,wordingSeed=5001,playbackLayout=false,severityData=null;
 const wordingCache=new Map([[WORDING_DEFAULT_ANALYSIS.key,WORDING_DEFAULT_ANALYSIS]]);let savedWordingStrategy='opt_fragmentation',savedSeverityStrategy='target';
 const removalLimit=()=>Math.min(base?.wording?20:40,base?.removable.size||0);
 function configureStrategy(){const select=$('removalStrategy');select.replaceChildren();for(const[value,label]of base.wording?WORDING_STRATEGIES:[['target','Shortest route to disconnect diamonds'],['degree','Most connected first'],['random','Random phrase order']]){const option=elem('option','',label);option.value=value;select.append(option);}select.value=base.wording?savedWordingStrategy:savedSeverityStrategy;}
 function stopWordingWorker(){wordingGeneration++;wordingWorker?.terminate();wordingWorker=null;}
 function loadWording(){if(!base.wording||!wordingBusy)return;const generation=++wordingGeneration;const input=base.wordingInput,url=URL.createObjectURL(new Blob([WORDING_WORKER_SOURCE],{type:'text/javascript'}));wordingWorker=new Worker(url);URL.revokeObjectURL(url);wordingWorker.onmessage=e=>{if(generation!==wordingGeneration||!active||!base.wording)return;const result=e.data.result;if(!result){wordingUI.pending('Calculation failed: '+e.data.error);wordingWorker.terminate();wordingWorker=null;return;}if(wordingCache.size>=10)wordingCache.clear();wordingCache.set(result.key,result);wordingData=result;wordingBusy=false;wordingWorker.terminate();wordingWorker=null;seek(0);};wordingWorker.onerror=e=>{wordingUI.pending('Calculation failed: '+e.message);};wordingWorker.postMessage(input);}
 const idsKey=ids=>ids.map(String).sort().join('|');
 const edgesKey=edges=>edges.map(e=>[String(e.from),String(e.to)].sort().join(':')).sort().join('|');
 function syncManualControls(){
  if(!base)return;const playing=timer!==null||wordingBusy,full=gone.length>=removalLimit();
  $('manualRemoval').disabled=playing||full||!$('manualRemoval').options.length;
  $('manualRemove').disabled=playing||full||!$('manualRemoval').options.length;
  for(const b of $('removedPhrases').querySelectorAll('button'))b.disabled=playing;
  $('manualRemovalHint').textContent=wordingBusy?'Manual editing is available when the comparison calculation finishes.':playing?'Pause playback to manually remove or restore phrases.':'Click a phrase in the map, or use the dropdown. Use × on a removed pill to restore it.';
  if(base.wording)$('wordingRandomDraw').disabled=playing||!wordingData;
 }
 function pause(){if(timer!==null)clearInterval(timer);timer=null;$('removalPlay').textContent='▶ Play';$('removalPlay').setAttribute('aria-label','Play phrase removals');syncManualControls();}
 function pieces(ids,edges,removed=new Set()){
  const adj=new Map(ids.filter(id=>!removed.has(id)).map(id=>[id,[]]));for(const e of edges)if(adj.has(e.from)&&adj.has(e.to)){adj.get(e.from).push(e.to);adj.get(e.to).push(e.from);}
  const seen=new Set(),groups=[];for(const id of adj.keys()){if(seen.has(id))continue;const q=[id];seen.add(id);for(let i=0;i<q.length;i++)for(const n of adj.get(q[i]))if(!seen.has(n)){seen.add(n);q.push(n);}groups.push(q);}
  return groups.sort((a,b)=>b.length-a.length||String(a[0]).localeCompare(String(b[0])));
 }
 const isPhrase=id=>base.phrases.has(id);
 function statistics(removed){
  if(base.wording){const b=Breakup.stats(Breakup.adjacency(base.nodes.map(n=>n.id),base.edges.map(e=>({a:e.from,b:e.to}))),base.nodes.map(n=>n.id),removed);return{groups:b.comps,remaining:b.remaining,F:b.F,lccShare:b.lccShare,isolated:b.isolated,goal:false};}
  const groups=pieces(base.nodes.map(n=>n.id),base.edges,removed),remaining=base.nodes.length-removed.size,majority=!!groups.length&&groups[0].length>remaining/2;
  const main=new Set(majority?groups[0]:[]),attached=base.diamonds.filter(id=>main.has(id)).length;
  const phraseLinks=base.edges.filter(e=>!removed.has(e.from)&&!removed.has(e.to)&&isPhrase(e.from)!==isPhrase(e.to)).length;
  return{groups,remaining,majority,attached,phraseLinks,connectedPairs:groups.reduce((n,g)=>n+g.length*(g.length-1),0),goal:base.diamonds.length>0&&majority&&attached===0};
 }
 function makeOrder(strategy=$('removalStrategy').value){
  const ids=[...base.removable];order=[];if(base.wording)return;
  exact=base.diamonds.length>0&&idsKey(base.nodes.map(n=>n.id))===idsKey(reference.nodes.map(n=>n[0]))&&base.nodes.every(n=>reference.nodes.some(r=>r[0]===n.id&&r[1]===base.labels.get(n.id)&&r[2]===base.diamonds.includes(n.id)))&&edgesKey(base.edges)===edgesKey(reference.edges.map(([from,to])=>({from,to})));
  if(strategy==='target'&&exact){order=reference.order.concat(ids.filter(id=>!reference.order.includes(id))).slice(0,40);return;}
  if(strategy==='random'){let seed=92741;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};order=ids.slice();for(let i=order.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[order[i],order[j]]=[order[j],order[i]];}order=order.slice(0,40);return;}
  const removed=new Set(order);while(order.length<Math.min(40,ids.length)){
   const remaining=ids.filter(id=>!removed.has(id));
   const ranked=remaining.map(id=>{const degree=base.edges.filter(e=>!removed.has(e.from)&&!removed.has(e.to)&&(e.from===id||e.to===id)).length;
    const direct=base.edges.filter(e=>(e.from===id&&base.diamonds.includes(e.to))||(e.to===id&&base.diamonds.includes(e.from))).length;
    const s=statistics(new Set([...removed,id]));return{id,score:strategy==='target'?(base.diamonds.length?[s.goal?1:0,s.majority?1:0,-s.attached,-s.phraseLinks,direct,degree]:[-(s.groups[0]?.length||0),-s.connectedPairs,degree]):[degree]};});
   ranked.sort((a,b)=>{for(let i=0;i<a.score.length;i++)if(a.score[i]!==b.score[i])return b.score[i]-a.score[i];return String(a.id).localeCompare(String(b.id),undefined,{numeric:true});});
   order.push(ranked[0].id);removed.add(ranked[0].id);
  }
 }
 function buildSeverityCurves(){
  const savedOrder=order.slice(),savedExact=exact;
  const series=[['target',exact?'Shortest route to disconnect diamonds':'Target severity diamonds','#b2182b'],['degree','Most connected first','#dc784e'],['random','Random phrase order','#1b7837']];
  const d={severity:true,kmax:removalLimit(),series,curves:{}};
  for(const[key]of series){makeOrder(key);const rows=[];for(let k=0;k<=d.kmax;k++){
   const s=statistics(new Set(order.slice(0,k))),pairs=s.connectedPairs;
   rows.push({lccShare:(s.groups[0]?.length||0)/Math.max(1,base.nodes.length),F:s.remaining<2?0:1-pairs/(s.remaining*(s.remaining-1))});
   if(key==='target'&&s.goal)break;
  }d.curves[key]=rows;}
  order=savedOrder;exact=savedExact;severityData=d;
 }
 function snapshot(){
  base={nodes:network.body.data.nodes.get(),edges:network.body.data.edges.get(),positions:network.getPositions(),camera:network.getViewPosition(),scale:network.getScale(),labels:new Map(shownNodes.map(n=>[n.id,n.label])),phrases:new Set(shownNodes.filter(n=>!n.isSeverity).map(n=>n.id)),diamonds:shownNodes.filter(n=>n.isSeverity).map(n=>n.id),legend:$('legend').innerHTML,legendTitle:$('legendColorTitle').textContent,legendNotes:$('legendNotes').textContent};
  base.wording=!base.diamonds.length&&GUIDED.snapshot().lens!=='severity';base.removable=new Set(base.phrases);configureStrategy();playbackLayout=false;$('wordingPullApart').checked=true;wordingBusy=false;wordingData=null;if(base.wording){base.wordingInput={nodes:shownNodes.map(n=>({id:n.id,label:n.label,records:n.count})),edges:shownEdges.map(e=>({a:e.source,b:e.target,w:e.weight}))};const key=wordingTopologyKey(base.wordingInput);wordingData=wordingCache.get(key)||null;wordingBusy=!wordingData;}makeOrder();gone=[];manual=base.wording&&$('removalStrategy').value==='manual';$('removalCount').max=removalLimit();if(!base.wording)buildSeverityCurves();
  if(!network.removalOverlayInstalled){
   network.removalOverlayInstalled=true;
   network.on('resize',()=>{if(active&&gone.length){if(timer!==null)preparePlaybackFrame();paint({fit:timer===null});}});
   network.on('click',event=>{if(active&&event.nodes.length)remove(event.nodes[0]);});
   // Deleted links are visual context only: paint behind the live graph,
   // without putting removed nodes or edges back into its data sets.
   network.on('beforeDrawing',ctx=>{
    if(!active||!gone.length)return;
    const removed=new Set(gone),positions=network.getPositions(),scale=Math.max(.05,network.getScale());
    ctx.save();ctx.strokeStyle='#cbd5db';ctx.globalAlpha=.55;ctx.lineWidth=.8/scale;ctx.setLineDash([2/scale,4/scale]);
    for(const e of base.edges)if(removed.has(e.from)||removed.has(e.to)){
     const a=positions[e.from]||base.positions[e.from],b=positions[e.to]||base.positions[e.to];
     ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.restore();
   });

  }
 }
 // Shelf-pack component bounding boxes, including label/radius margins.
 // Search widths for the best viewport fit instead of a long row of isolates.
 function fitPieces(groups,adjustCamera=true,measureOnly=false){
  if(!groups.length)return measureOnly?{scale:1,positions:new Map()}:new Map();
  const boxes=groups.map(group=>{const p=group.map(id=>base.positions[id]);const x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));
   const margin=Math.max(70,...group.map(id=>(base.labels.get(id)||'').length*4));
   return{group,x:x-margin,y:y-65,w:Math.max(140,Math.max(...p.map(p=>p.x))-x+margin*2),h:Math.max(130,Math.max(...p.map(p=>p.y))-y+130)};}).sort((a,b)=>b.h-a.h||b.w-a.w);
  const width=$('network').clientWidth,height=$('network').clientHeight,usableW=Math.max(100,width-36),usableH=Math.max(140,height-160),minW=Math.max(...boxes.map(b=>b.w)),sumW=boxes.reduce((n,b)=>n+b.w+35,0);
  let best=null;for(let i=0;i<=32;i++){const shelfW=minW+(sumW-minW)*i/32;let x=0,y=0,rowH=0,maxX=0;const placements=[];
   for(const b of boxes){if(x&&x+b.w>shelfW){x=0;y+=rowH+35;rowH=0;}placements.push({b,x,y});maxX=Math.max(maxX,x+b.w);rowH=Math.max(rowH,b.h);x+=b.w+35;}
   const packH=y+rowH,scale=Math.min(1.1,usableW/maxX,usableH/packH);if(!best||scale>best.scale)best={placements,w:maxX,h:packH,scale};
  }
  const positions=new Map();for(const{b,x,y}of best.placements)for(const id of b.group){const p=base.positions[id];positions.set(id,{x:p.x-b.x+x-best.w/2,y:p.y-b.y+y-best.h/2});}
  if(measureOnly)return{scale:best.scale,positions};if(adjustCamera)network.moveTo({position:{x:0,y:-45/best.scale},scale:best.scale,animation:false});return positions;
 }
 // Fit the remaining playback range once, then leave the camera alone on
 // each tick. Every packed snapshot shares this fixed frame until the user
 // deliberately pans/zooms; Fit can establish a new playback frame.
 function preparePlaybackFrame(){
  if(!$('wordingPullApart').checked){playbackLayout=false;network.moveTo({position:base.camera,scale:base.scale,animation:false});return;}
  playbackLayout=true;let scale=1.1;const initial=gone.slice(),sets=[initial];
  if(base.wording){for(let k=gone.length+1;k<=removalLimit();k++)sets.push(wordingSetAt(wordingData,$('removalStrategy').value,k,wordingSeed));}
  else{const current=initial.slice();for(const id of order)if(!current.includes(id)&&current.length<removalLimit()){current.push(id);sets.push(current.slice());}}
  for(const set of sets){const groups=statistics(new Set(set)).groups;if(groups.length)scale=Math.min(scale,fitPieces(groups,false,true).scale);}
  network.moveTo({position:{x:0,y:-45/scale},scale,animation:false});
 }
 function paint({fit=timer===null}={}){
  if(!active||!base)return;const removed=new Set(gone),nodes=base.nodes.filter(n=>!removed.has(n.id)),edges=base.edges.filter(e=>!removed.has(e.from)&&!removed.has(e.to)),s=statistics(removed);
  network.removalSimulationActive=true;network.stopSimulation();network.setOptions({physics:{enabled:false},interaction:{dragNodes:false}});
  // Playback owns deletion, while the user owns pan and zoom. Slider/manual
  // steps still fit by default; the Fit button can also fit during playback.
  const positions=(gone.length||playbackLayout)&&$('wordingPullApart').checked?fitPieces(s.groups,fit):new Map(base.nodes.map(n=>[n.id,base.positions[n.id]]));
  const grouped=base.wording||gone.length>0&&s.groups.length>1,colors=new Map();s.groups.forEach((group,i)=>group.forEach(id=>colors.set(id,base.wording&&group.length===1?'#aab3bb':pieceColor(i))));
  const redDiamonds=$('colorLayer').value==='teal';
  const nodeColor=n=>{const fill=redDiamonds&&base.diamonds.includes(n.id)?'#ff2020':grouped?colors.get(n.id):null;return fill?{...n.color,background:fill,border:fill,highlight:{background:fill,border:'#102f43'},hover:{background:fill,border:'#102f43'}}:n.color;};
  const camera=network.getViewPosition(),scale=network.getScale();network.setData({nodes:nodes.map(n=>({...n,...positions.get(n.id),fixed:{x:true,y:true},color:nodeColor(n)})),edges:edges.map(e=>({...e,...(grouped?{color:{...e.color,color:colors.get(e.from),highlight:colors.get(e.from),hover:colors.get(e.from)}}:{})}))});
  pieceKey.replaceChildren();pieceKey.hidden=!grouped;
  if(grouped){
   s.groups.forEach((group,i)=>{const item=elem('span','simulation-piece-chip'),dot=elem('span','dot');dot.style.background=base.wording&&group.length===1?'#aab3bb':pieceColor(i);item.append(dot,document.createTextNode(`Piece ${i+1} · ${group.length}`));pieceKey.append(item);});
   $('legendColorTitle').textContent='Color · Connected pieces';$('legend').replaceChildren(...[...pieceKey.querySelectorAll('.simulation-piece-chip')].map(n=>n.cloneNode(true)));if(redDiamonds&&base.diamonds.length){const key=elem('span','simulation-piece-chip'),dot=elem('span','dot');dot.style.background='#ff2020';dot.style.borderRadius='0';dot.style.transform='rotate(45deg)';key.append(dot,document.createTextNode('Severity diamonds'));pieceKey.append(key);$('legend').append(key.cloneNode(true));}$('legendNotes').textContent=base.wording?'Phrase and link colors identify connected pieces. Singletons are grey. Removed phrases are hidden; deleted links are faint background lines and do not count in connectivity. Sizes retain starting hospice coverage.':'Simulation phrase and link colors identify connected components after removal, not severity levels or wording clusters. In Neutral mode, diamonds stay bright red. Each surviving link stays within one piece. Sizes retain their starting hospice coverage.';
  }else{$('legend').innerHTML=base.legend;$('legendColorTitle').textContent=base.legendTitle;$('legendNotes').textContent=base.legendNotes;}
  network.moveTo({position:gone.length||playbackLayout?camera:base.camera,scale:gone.length||playbackLayout?scale:base.scale,animation:false});
  const limit=removalLimit();$('removalCount').value=gone.length;$('removalLabel').textContent=`${gone.length} / ${limit}`;
  $('removalCount').setAttribute('aria-valuetext',`${gone.length} phrases removed; ${s.groups.length} connected pieces`);
  wordingUI.controls.hidden=wordingUI.lower.hidden=false;wordingUI.lower.classList.toggle('severity-comparison',!base.wording);$('wordingComputing').hidden=!base.wording;$('removalRouteNote').hidden=$('removalStats').hidden=true;
  $('simulationMethods').hidden=base.wording;$('wordingSimulationMethods').hidden=!base.wording;
  if(base.wording){
   $('simulationHeading').textContent='Wording network dismantling';box.querySelector('.sim-help p').textContent='Each snapshot deletes its selected phrases and their incident links from the starting graph. All phrases can be removed. Best sets for different counts need not be nested. There are no protected targets or majority-main-network conditions. Results describe wording relationships, not providers or care quality.';
   $('removalRouteNote').textContent='';$('removalStats').replaceChildren();
   if(wordingBusy)wordingUI.pending('Computing in the background…');else if(wordingData)wordingUI.render(wordingData,gone.length,$('removalStrategy').value,gone,wordingSeed);
  }else{
   $('removalStats').replaceChildren();for(const text of [`${s.remaining} nodes left · ${edges.length} links`,`${s.groups.length} pieces · Largest piece: ${s.groups[0]?.length||0}`,s.majority?`${base.diamonds.length-s.attached} / ${base.diamonds.length} diamonds disconnected from the main network`:'No majority main network remains'])$('removalStats').append(elem('div','',text));
   if(s.goal)$('removalStats').append(elem('strong','sim-goal','All severity diamonds disconnected'));
   wordingUI.renderSeverity(severityData,gone.length,manual?'manual':$('removalStrategy').value);
   $('simulationHeading').textContent='Separate the severity diamonds';box.querySelector('.sim-help p').textContent='Only care phrases and their existing links are removed. Severity diamonds stay visible. A main network must contain more than half of the remaining nodes. In Neutral mode, diamonds stay bright red. This is a text-network experiment, not a prediction of hospice care.';
   $('removalRouteNote').textContent=manual?'Manual selection · Reset to replay the automatic route.':$('removalStrategy').value!=='target'?'Only phrases are removed; severity diamonds stay visible.':exact?`Shortest reference route: ${reference.minimum} phrases. Playback stops when all diamonds are disconnected.`:'Targeted route for these filters · greedy strategy, not a proven shortest route.';
   $('removalStrategy').options[0].textContent=exact?'Shortest route to disconnect diamonds':'Target severity diamonds';
   $('simulationMethodStatus').textContent=manual?'Current run: manual choices. Reset to replay the automatic route.':$('removalStrategy').value!=='target'?'Current run: '+$('removalStrategy').selectedOptions[0].textContent+'. This is a comparison strategy, without a minimum-removal guarantee.':exact?'Reference result: 18 of 64 phrases removed; 55 nodes survive. The main piece has 28 nodes and no diamonds (28 > 55/2). Fewer than 18 removals cannot meet these conditions on this reference graph.':'Current filters change the graph. The greedy target route is not proven minimal; the reference result of 18 does not apply.';
  }
  $('removalRouteNote').textContent='';$('removalStats').replaceChildren();if(!base.wording)$('wordingRandomDraw').hidden=true;
  $('removalSeverityView').hidden=true;
  $('removedTitle').textContent=`Removed: ${gone.length}`;const focusedId=document.activeElement?.dataset?.restore;
  $('removedPhrases').replaceChildren();if(!gone.length)$('removedPhrases').append(elem('p','sim-hint','No phrases removed yet.'));
  gone.forEach((id,i)=>{const pill=elem('span','removed-pill'),label=elem('span','',`${i+1}. ${base.labels.get(id)}`),restore=elem('button','','×');pill.dataset.node=String(id);label.tabIndex=0;label.setAttribute('aria-describedby',pillTooltip.id);restore.type='button';restore.dataset.restore=String(id);restore.setAttribute('aria-label',`Restore ${base.labels.get(id)}`);restore.setAttribute('aria-describedby',pillTooltip.id);restore.onclick=()=>putBack(id);pill.onpointerenter=()=>showPillTooltip(pill);pill.onpointerleave=deferPillTooltip;pill.addEventListener('focusin',()=>showPillTooltip(pill));pill.addEventListener('focusout',e=>{if(!pill.contains(e.relatedTarget))deferPillTooltip();});pill.append(label,restore);$('removedPhrases').append(pill);});
  if(tooltipNode!==null){const anchor=[...$('removedPhrases').children].find(p=>p.dataset.node===String(tooltipNode));if(anchor)showPillTooltip(anchor);else hidePillTooltip();}
  if(focusedId){const buttons=[...$('removedPhrases').querySelectorAll('button')];(buttons.find(b=>b.dataset.restore===focusedId)||buttons[0]||$('manualRemove')).focus({preventScroll:true});}
  const select=$('manualRemoval'),previous=select.value;select.replaceChildren();for(const id of [...base.removable].filter(id=>!removed.has(id)).sort((a,b)=>base.labels.get(a).localeCompare(base.labels.get(b)))){const option=elem('option','',base.labels.get(id));option.value=String(id);select.append(option);}if([...select.options].some(o=>o.value===previous))select.value=previous;
  $('manualRemove').disabled=gone.length>=limit||!select.options.length;$('removalCount').disabled=!limit||wordingBusy||base.wording&&manual;
  const targetBlocked=!base.wording&&$('removalStrategy').value==='target'&&s.goal;
  $('removalPlay').disabled=gone.length>=limit||targetBlocked||wordingBusy||base.wording&&manual;if($('removalPlay').disabled)pause();
  syncManualControls();if(base.wording)$('wordingRandomDraw').disabled=timer!==null||wordingBusy;
 }
 function seek(value){pause();if(!active||wordingBusy)return;playbackLayout=false;const k=Math.max(0,Math.min(removalLimit(),Math.trunc(Number(value)||0)));if(base.wording){if(manual){if(k===0)gone=[];}else gone=wordingSetAt(wordingData,$('removalStrategy').value,k,wordingSeed);}else{manual=false;gone=order.slice(0,k);}paint();}
 function chooseManual(){if(base.wording){$('removalStrategy').value=savedWordingStrategy='manual';}manual=true;}
 function remove(id){if(!active||timer!==null||wordingBusy||!base.removable.has(id)||gone.includes(id)||gone.length>=removalLimit())return false;pause();chooseManual();gone.push(id);paint();return true;}
 function putBack(id){if(!active||timer!==null||wordingBusy||!gone.includes(id))return false;pause();chooseManual();gone=gone.filter(n=>n!==id);paint();return true;}
 function restore(){playbackLayout=false;network.removalSimulationActive=false;network.setData({nodes:base.nodes.map(n=>({...n,...base.positions[n.id]})),edges:base.edges.map(e=>({...e}))});network.setOptions({physics:{enabled:!isSourceComparison()},interaction:{dragNodes:!isSourceComparison()}});network.moveTo({position:base.camera,scale:base.scale,animation:false});}
 function enabled(value){
  value=!!value&&mode==='phrase';if(value===active)return;pause();if(!value)stopWordingWorker();if(value){network.neighborhoodFocus?.clear();snapshot();legendOpen=$('floatingLegend').open;$('floatingLegend').open=false;active=true;
   exportStates=[...panel.querySelectorAll('button')].filter(b=>/export|csv|excel/i.test(b.textContent)).map(b=>[b,b.disabled]);for(const[b]of exportStates)b.disabled=true;
  }else{hidePillTooltip();restore();active=false;$('floatingLegend').open=legendOpen;$('legend').innerHTML=base.legend;$('legendColorTitle').textContent=base.legendTitle;$('legendNotes').textContent=base.legendNotes;for(const[b,disabled]of exportStates)b.disabled=disabled;}
  toggle.checked=active;box.hidden=playback.hidden=!active;evidence.hidden=active;workspace.classList.toggle('simulation-active',active);document.body.classList.toggle('simulation-mode',active);if(active){paint();if(base.wording&&wordingBusy)loadWording();}else{wordingUI.controls.hidden=wordingUI.lower.hidden=true;}
 }
 toggle.onchange=()=>enabled(toggle.checked);$('removalCount').oninput=()=>seek($('removalCount').value);
 $('removalStrategy').onchange=()=>{pause();if(base.wording){savedWordingStrategy=$('removalStrategy').value;manual=savedWordingStrategy==='manual';if(!manual)gone=[];}else{savedSeverityStrategy=$('removalStrategy').value;manual=false;makeOrder();gone=[];}paint();};$('removalReset').onclick=()=>seek(0);
 $('manualRemove').onclick=()=>{const id=[...base.removable].find(id=>String(id)===$('manualRemoval').value);remove(id);};
 $('removalSeverityView').onclick=()=>GUIDED.setView('severity');
 $('removalPlay').onclick=()=>{if(timer!==null){pause();return;}if($('removalPlay').disabled)return;preparePlaybackFrame();paint({fit:false});$('removalPlay').textContent='❚❚ Pause';$('removalPlay').setAttribute('aria-label','Pause phrase removals');timer=setInterval(()=>{if(base.wording){gone=wordingSetAt(wordingData,$('removalStrategy').value,gone.length+1,wordingSeed);}else{const next=order.find(id=>!gone.includes(id));if(next===undefined){pause();return;}gone.push(next);}paint();},800);syncManualControls();if(base.wording)$('wordingRandomDraw').disabled=true;};

 $('wordingRandomDraw').onclick=()=>{pause();wordingSeed++;if(!manual)gone=wordingSetAt(wordingData,'random',gone.length,wordingSeed);paint();};
 $('wordingPullApart').onchange=()=>{if(active)paint({fit:timer===null});};
 const originalFit=$('fit').onclick;$('fit').onclick=()=>{if(active&&(gone.length||playbackLayout)){if(timer!==null){preparePlaybackFrame();paint({fit:false});}else paint({fit:true});}else originalFit();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 const originalRender=render;render=function(){const wasActive=active;if(wasActive)enabled(false);originalRender();if(wasActive&&mode==='phrase')enabled(true);};
 const originalMode=setMode;setMode=function(next){enabled(false);originalMode(next);toggle.disabled=next!=='phrase';view.hidden=next!=='phrase';};
 const originalShow=showNode;showNode=function(id){if(active)return false;return originalShow(id);};
 window.REMOVAL_SIM={enable:enabled,seek,pause,remove,restore:putBack,get state(){const s=active?statistics(new Set(gone)):null;return{active,removed:gone.length,removedIds:gone.slice(),order:order.slice(),exact,manual,wording:!!base?.wording,busy:wordingBusy,analysis:wordingData,strategy:$('removalStrategy').value,playing:timer!==null,nodes:network.body.data.nodes.getIds(),edges:network.body.data.edges.get(),components:s?.groups||[],goal:s?.goal||false,diamonds:base?.diamonds.slice()||[],baselineNodes:base?.nodes.length||0};}};
})();
