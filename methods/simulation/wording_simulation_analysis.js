/* Shared build/worker orchestration. Graph algorithms are the frozen Breakup
   engine; the minimum-cut helper supplies its missing global vertex cut. */
function wordingTopologyKey(d){return JSON.stringify([d.nodes.map(n=>[n.id,n.label,n.records]).sort((a,b)=>a[0]-b[0]),d.edges.map(e=>[Math.min(e.a,e.b),Math.max(e.a,e.b)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])]);}
function wordingMinimumCut(ids,edges){
 const B=globalThis.Breakup,adj=B.adjacency(ids,edges),groups=B.pieces(adj,ids,new Set());
 if(ids.length<2||groups.length>1)return{set:[],size:0,alreadyDisconnected:groups.length>1};
 for(const id of ids)if(B.pieces(adj,ids,new Set([id])).length>1)return{set:[id],size:1};
 let best=[...adj.get(ids.slice().sort((a,b)=>adj.get(a).length-adj.get(b).length||a-b)[0])];
 const n=ids.length,ix=new Map(ids.map((id,i)=>[id,i]));
 if(best.length===n-1)return{set:best.sort((a,b)=>a-b),size:best.length,complete:true};
 function cut(s,t){const net=Array.from({length:2*n},()=>[]),inf=n+1,source=2*ix.get(s)+1,sink=2*ix.get(t);
  const arc=(a,b,c)=>{const f={to:b,c,r:net[b].length},r={to:a,c:0,r:net[a].length};net[a].push(f);net[b].push(r);};
  ids.forEach(id=>arc(2*ix.get(id),2*ix.get(id)+1,id===s||id===t?inf:1));
  for(const e of edges){arc(2*ix.get(e.a)+1,2*ix.get(e.b),inf);arc(2*ix.get(e.b)+1,2*ix.get(e.a),inf);}
  let flow=0;for(;;){const parent=new Int32Array(2*n).fill(-1),via=new Int32Array(2*n),q=[source];parent[source]=source;
   for(let i=0;i<q.length&&parent[sink]<0;i++)net[q[i]].forEach((e,k)=>{if(e.c>0&&parent[e.to]<0){parent[e.to]=q[i];via[e.to]=k;q.push(e.to);}});
   if(parent[sink]<0)break;let delta=inf;for(let v=sink;v!==source;v=parent[v])delta=Math.min(delta,net[parent[v]][via[v]].c);
   for(let v=sink;v!==source;v=parent[v]){const e=net[parent[v]][via[v]];e.c-=delta;net[v][e.r].c+=delta;}flow+=delta;if(flow>=best.length)return null;
  }
  const seen=new Set([source]),q=[source];for(let i=0;i<q.length;i++)for(const e of net[q[i]])if(e.c>0&&!seen.has(e.to)){seen.add(e.to);q.push(e.to);}
  return ids.filter(id=>id!==s&&id!==t&&seen.has(2*ix.get(id))&&!seen.has(2*ix.get(id)+1));
 }
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(!adj.get(ids[i]).includes(ids[j])){const c=cut(ids[i],ids[j]);if(c&&c.length<best.length)best=c;if(best.length===2)return{set:best.sort((a,b)=>a-b),size:2};}
 return{set:best.sort((a,b)=>a-b),size:best.length};
}
function computeWordingAnalysis(d){
 const B=globalThis.Breakup,ids=d.nodes.map(n=>n.id),adj=B.adjacency(ids,d.edges),kmax=Math.min(20,ids.length),orders={};
 const names=['adaptive_betweenness','adaptive_degree','static_degree','records'];for(const name of names)orders[name]=B.attackOrder(name,d.nodes,d.edges,kmax);
 const seeds={adaptive_betweenness:orders.adaptive_betweenness,adaptive_degree:orders.adaptive_degree};
 const optimal={fragmentation:B.optimalSets(ids,d.edges,kmax,'fragmentation',{seeds}),largest:B.optimalSets(ids,d.edges,kmax,'largest',{seeds})};
 const compact=s=>({pieces:s.pieces,lcc:s.lcc,lccShare:s.lccShare,F:s.F,isolated:s.isolated.length});
 const stats=set=>compact(B.stats(adj,ids,new Set(set))),curves={};
 for(const name of names)curves[name]=Array.from({length:kmax+1},(_,k)=>stats(orders[name].slice(0,k)));
 for(const obj of ['fragmentation','largest'])curves['opt_'+obj]=optimal[obj].map(r=>stats(r.set));
 const randomRuns=Array.from({length:60},(_,r)=>{const order=B.shuffled(ids,B.mulberry32(5001+r));return Array.from({length:kmax+1},(_,k)=>stats(order.slice(0,k)));});
 const q=(a,p)=>{a.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)];};
 const random=Array.from({length:kmax+1},(_,k)=>{const rows=randomRuns.map(r=>r[k]),out={};for(const field of ['pieces','lccShare','F','isolated'])out[field]=rows.reduce((s,r)=>s+r[field],0)/60;for(const field of ['lccShare','F']){out[field+'Low']=q(rows.map(r=>r[field]),.1);out[field+'High']=q(rows.map(r=>r[field]),.9);}return out;});
 curves.random=random;
 const mincut=wordingMinimumCut(ids,d.edges);return{key:wordingTopologyKey(d),nodes:d.nodes,edges:d.edges,kmax,orders,optimal,curves,random,mincut,settings:{exactUpTo:3,restarts:12,seed:20261106,randomSeeds:[5001,5060]}};
}
