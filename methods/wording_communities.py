"""Deterministic weighted greedy-modularity groups; not qualitative theme coding."""
from collections import Counter


def wording_groups(nodes, edges, resolution=1.):
    nodes=sorted(nodes);degree=Counter();cross={};members={n:[n] for n in nodes}
    for e in edges:
        i,j=e['source'],e['target'];w=e['weight']
        if i not in members or j not in members:continue
        degree[i]+=w;degree[j]+=w;cross[min(i,j),max(i,j)]=w
    total=sum(cross.values())
    if not total:return {n:-1 for n in nodes}
    while True:
        keys=sorted(members);best=None;gain=1e-12
        for at,i in enumerate(keys):
            for j in keys[at+1:]:
                delta=cross.get((i,j),0)/total-resolution*degree[i]*degree[j]/(2*total*total)
                if delta>gain:gain=delta;best=i,j
        if best is None:break
        i,j=best;members[i]+=members.pop(j);degree[i]+=degree[j]
        for k in list(members):
            if k==i:continue
            a=min(i,k),max(i,k);b=min(j,k),max(j,k)
            cross[a]=cross.get(a,0)+cross.pop(b,0)
        cross.pop((i,j),None);degree.pop(j)
    linked={e[k] for e in edges for k in ('source','target')}
    groups=sorted((sorted(v) for v in members.values() if any(n in linked for n in v)),key=lambda v:(-len(v),v[0]))
    result={n:-1 for n in nodes}
    for i,g in enumerate(groups):
        for n in g:result[n]=i
    return result


def adjusted_rand(a,b):
    def pairs(n):return n*(n-1)/2
    joint=Counter(zip(a,b));ra=Counter(a);rb=Counter(b);N=pairs(len(a))
    if not N:return 1.
    x=sum(pairs(n) for n in joint.values());A=sum(pairs(n) for n in ra.values());B=sum(pairs(n) for n in rb.values());expected=A*B/N;maximum=(A+B)/2
    return (x-expected)/(maximum-expected) if maximum!=expected else 1.
