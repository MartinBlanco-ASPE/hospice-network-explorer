const WORDING_STRATEGIES=[
 ['opt_fragmentation','Best set to shatter it','#b2182b'],['opt_largest','Best set to shrink the largest piece','#dc784e'],
 ['adaptive_betweenness','Bridges, re-scored','#7b3294'],['adaptive_degree','Hubs, re-scored','#2166ac'],
 ['static_degree','Hubs in the original network','#67a9cf'],['records','Most common phrases','#1b7837'],
 ['random','Random','#7f8c99'],['manual','Manual','#172e43']];
const WORDING_CHART_STRATEGIES=WORDING_STRATEGIES.filter(r=>['opt_fragmentation','opt_largest','records'].includes(r[0]));
function wordingSetAt(d,strategy,k,seed=5001){
 if(strategy==='opt_fragmentation'||strategy==='opt_largest')return d.optimal[strategy.slice(4)][k].set.slice();
 if(strategy==='random')return Breakup.shuffled(d.nodes.map(n=>n.id),Breakup.mulberry32(seed)).slice(0,k);
 return d.orders[strategy]?.slice(0,k)||[];
}
function createWordingSimulationUI(box,stage){
 const controls=elem('div','wording-only');controls.id='wordingControls';
 controls.innerHTML='<p id="wordingComputing" role="status" class="sim-hint"></p><div class="wording-view-controls"><label class="check"><input id="wordingPullApart" type="checkbox" checked>Pull pieces apart</label></div><button class="btn" id="wordingRandomDraw" type="button">New random draw</button>';
 $('removalStats').after(controls);
 const lower=elem('section','color-description wording-comparison');lower.id='wordingComparison';lower.hidden=true;
 stage.after(lower);lower.append($('simulationMethods'),$('wordingSimulationMethods'));
 const curves=elem('div','wording-curves');curves.innerHTML='<div><h3>Largest piece · share of starting phrases</h3><div id="wordingCurveL"></div></div><div><h3>Fragmentation</h3><div id="wordingCurveF"></div></div>';lower.append(curves);
 const legend=elem('div','wording-curve-legend'),note=elem('p','sim-hint');lower.append(legend,note);
 function pending(message){$('wordingComputing').textContent=message;curves.hidden=legend.hidden=note.hidden=!!message;}
 function chart(d,field,k,selected,series){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 480 225');svg.setAttribute('role','img');svg.setAttribute('aria-label',field==='F'?'Fragmentation by number of removed phrases':d.severity?'Largest-piece share of starting nodes by removals':'Largest-piece share of starting phrases by removals');
  const add=(tag,attrs,text,parent=svg)=>{const n=document.createElementNS(ns,tag);for(const[a,v]of Object.entries(attrs))n.setAttribute(a,v);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
  const x=i=>40+420*i/Math.max(1,d.kmax),y=v=>183-155*v;
  for(const value of [0,.25,.5,.75,1]){add('line',{x1:40,x2:460,y1:y(value),y2:y(value),stroke:'#e0e8eb'});add('text',{x:34,y:y(value)+4,'text-anchor':'end'},`${Math.round(value*100)}%`);}
  for(let i=0;i<=d.kmax;i+=d.kmax>10?5:1)add('text',{x:x(i),y:201,'text-anchor':'middle'},String(i));
  add('text',{x:250,y:220,'text-anchor':'middle'},'Phrases removed');
  for(const[key,label,color]of series){const values=d.curves[key],path=add('path',{d:values.map((r,i)=>`${i?'L':'M'}${x(i)},${y(r[field])}`).join(''),fill:'none',stroke:color,'stroke-width':selected===key?3:1.6,'stroke-dasharray':key==='random'?'5 3':'none','data-strategy':key});add('title',{},label,path);}
  add('line',{x1:x(k),x2:x(k),y1:25,y2:185,stroke:'#234758','stroke-dasharray':'3 4','data-current-removals':k});return svg;
 }
 function renderCharts(d,k,strategy,series){
  curves.hidden=legend.hidden=note.hidden=false;
  curves.querySelector('h3').textContent=d.severity?'Largest piece · share of starting nodes':'Largest piece · share of starting phrases';
  legend.replaceChildren();for(const[key,label,color]of series){const item=elem('span'),dot=elem('span','dot');dot.style.background=color;item.append(dot,document.createTextNode(label));legend.append(item);}
  $('wordingCurveL').replaceChildren(chart(d,'lccShare',k,strategy,series));$('wordingCurveF').replaceChildren(chart(d,'F',k,strategy,series));
 }
 function renderSeverity(d,k,strategy){
  renderCharts(d,k,strategy,d.series);
  note.textContent='Only care phrases are removed; severity diamonds remain. Largest piece divides by all starting nodes (phrases + diamonds). Fragmentation = 1 − Σ sᵢ(sᵢ − 1) / [n(n − 1)], using surviving component sizes sᵢ and surviving nodes n (0 when n < 2). The target line ends when its separation goal is met; comparison lines continue to the removal limit. Random is one fixed draw.';
 }
 function render(d,k,strategy,removed,seed){
  pending('');const ids=d.nodes.map(n=>n.id),adj=Breakup.adjacency(ids,d.edges),stats=Breakup.stats(adj,ids,new Set(removed));
  $('wordingRandomDraw').hidden=strategy!=='random';renderCharts(d,k,strategy,WORDING_CHART_STRATEGIES);
  note.textContent='Best sets are exact through 3 removals and best found above 3. Each removal count is optimized separately, so phrases can return between snapshots.';
  return stats;
 }
 return{controls,lower,pending,render,renderSeverity};
}
