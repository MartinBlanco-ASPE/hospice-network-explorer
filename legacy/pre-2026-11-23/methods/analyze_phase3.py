"""Full-corpus descriptive phrase analysis and TF-IDF/cosine networks, standard library."""
from pathlib import Path
from collections import Counter,defaultdict
from itertools import combinations
import csv,gzip,hashlib,json,math,re,time

ROOT=Path(__file__).resolve().parents[3]
B=ROOT/'Hospice/backend/phase3'
IN=ROOT/'Hospice/backend/phase2/corpus/care_findings.jsonl.gz'

# Researcher-selected vocabulary informed by intake/pilot, not discovered or validated themes.
PHRASES={
'care plan':['care plan','care plans','plan of care','plans of care'],
'assessment':['comprehensive assessment','comprehensive assessments','initial assessment','initial assessments'],
'reassessment':['reassessment','reassessments','reassessed','assessment update','assessment updates'],
'patient goals':['patient goals','measurable goals','measurable outcomes','goals and interventions'],
'visit frequency':['visit frequency','frequency of services','frequency of visits','visit frequencies'],
'skilled nursing':['skilled nursing','skilled nurse','skilled nurses'],
'hospice aide':['hospice aide','hospice aides'],
'aide supervision':['aide supervision','supervisory visits','supervisory visit','supervision of hospice aides'],
'competency evaluation':['competency evaluation','competency assessment','competency assessments','skills competency'],
'staff training':['staff training','in service training','inservice training','in-service training'],
'physician order':['physician order','physician orders','physicians orders'],
'medication profile':['medication profile','medication profiles','drug profile','medication list'],
'medication reconciliation':['medication reconciliation','reconciled','reconciliation'],
'medication dose':['medication dose','medication dosage','dose and frequency','dosage and frequency'],
'drug interaction':['drug interactions','drug interaction','duplicate drug therapy'],
'oxygen':['oxygen'],
'wound care':['wound care','wound assessment','wound assessments'],
'pain assessment':['pain assessment','pain assessments','assessment of pain'],
'symptom management':['symptom management','symptom control','pain management','pain control'],
'infection control':['infection control','infection prevention','infection prevention and control'],
'hand hygiene':['hand hygiene','hand washing','handwashing'],
'protective equipment':['personal protective equipment','ppe'],
'equipment cleaning':['disinfecting','disinfection','disinfected','contact time','wet time'],
'caregiver education':['caregiver education','patient education','caregiver training','teaching'],
'return demonstration':['return demonstration','return demonstrations'],
'communication':['communication','communicated'],
'discharge summary':['discharge summary','discharge summaries'],
'attending physician':['attending physician','attending physicians','primary practitioner','primary practitioners'],
'interdisciplinary group':['interdisciplinary group','interdisciplinary team','idg','idt'],
'medical director':['medical director','medical directors'],
'electronic record':['electronic medical record','electronic health record','ehr','emr'],
'documentation':['documentation','documented'],
'copied documentation':['pre populated','prepopulated','pre-populated','copied','copy forward','copy-forward'],
'advance directive':['advance directive','advance directives','advanced directives'],
'patient rights':['patient rights','patients rights'],
'consent':['consent','election statement','election statements','election of benefits'],
'spiritual care':['spiritual','chaplain'],
'bereavement care':['bereavement'],
'social work':['social work','social worker','social workers','msw'],
'volunteer services':['volunteer','volunteers'],
'quality improvement':['quality improvement','qapi','quality assessment'],
'governing body':['governing body','governing board'],
'administrator':['administrator','administrators'],
'background check':['background check','background checks'],
'supplies':['supplies'],
'medical equipment':['durable medical equipment','dme','medical equipment'],
'on-call response':['on call','on-call','after hours','after-hours'],
'service coordination':['coordination of services','coordination of care','coordinated care'],
'care refusal':['refused','refusing','refusal','declined'],
'fall risk':['fall risk','falls','fall precautions'],
'aspiration risk':['aspiration','swallowing'],
'skin integrity':['skin integrity','skin assessment','skin assessments'],
'catheter care':['catheter','catheters','foley'],
'terminal certification':['certification of terminal illness','certification narrative','terminal prognosis'],
'change in condition':['change in condition','changes in condition','patient changes','patient condition'],
'missed visits':['missed visit','missed visits'],
'physician notification':['physician notified','physician was notified','physician notification','notify the physician'],
'signed orders':['signed orders','signed order','verbal orders','verbal order'],
'drug storage':['medication storage','drug storage','stored','storage'],
'plan revision':['revised plan','revised plans','updated plan','updated plans','update the plan'],
'assessment timeliness':['calendar days','within 48 hours','every 15 days','15 calendar days'],
'performance monitoring':['performance improvement','track and trend','tracked','tracking'],
'pain medication':['pain medication','pain medications','opioid','opioids'],
'patient choice':['patient choice','patient preference','patient preferences'],
}
TOKEN=re.compile(r'[a-z]+')
TRIE={}
for label,aliases in PHRASES.items():
    for alias in aliases:
        node=TRIE
        for token in TOKEN.findall(alias):node=node.setdefault(token,{})
        node.setdefault('_labels',set()).add(label)


def feature_counts(text):
    words=TOKEN.findall(text.lower());out=Counter()
    for i,token in enumerate(words):
        node=TRIE.get(token)
        if not node:continue
        seen=set();j=i
        while node:
            seen.update(node.get('_labels',()))
            j+=1
            if j>=len(words):break
            node=node.get(words[j])
        for name in seen:out[name]+=1
    return out


def trim_prefix(text):
    # Deliberately conservative: only remove text before an explicit noncompliance anchor.
    m=re.search(r'\bthis\s+(?:standard|condition)(?:\s+of\s+participation)?\s+(?:was|is)\s+not\s+met\b',text,re.I)
    if m and m.start()>0:return text[m.start():],m.start()
    return text,0


def kwic(text,label):
    for alias in PHRASES[label]:
        pat=r'\b'+r'[\s-]+'.join(re.escape(x) for x in TOKEN.findall(alias))+r'\b'
        m=re.search(pat,text,re.I)
        if m:return text[max(0,m.start()-100):min(len(text),m.end()+200)].replace('\n',' ')
    return text[:240].replace('\n',' ')


def writecsv(path,rows,fields=None):
    rows=list(rows)
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields or list(rows[0]));w.writeheader();w.writerows(rows)


def communities(nodes,edges):
    # Greedy modularity merges on the default displayed graph, not qualitative theme discovery.
    groups={n:{n} for n in nodes};degree=Counter();weights={}
    for e in edges:
        a,b=e['source'],e['target'];w=e['weight'];degree[a]+=w;degree[b]+=w;weights[tuple(sorted((a,b)))]=w
    m=sum(weights.values())
    if not m:return {n:i for i,n in enumerate(nodes)}
    while True:
        best=None;gain=1e-12;keys=sorted(groups)
        for i,a in enumerate(keys):
            for b in keys[i+1:]:
                cross=sum(weights.get(tuple(sorted((u,v))),0) for u in groups[a] for v in groups[b])
                delta=cross/m-sum(degree[u] for u in groups[a])*sum(degree[v] for v in groups[b])/(2*m*m)
                if delta>gain:gain=delta;best=(a,b)
        if best is None:break
        a,b=best;groups[a]|=groups.pop(b)
    ordered=sorted(groups.values(),key=lambda x:(-len(x),sorted(x)))
    return {n:i for i,g in enumerate(ordered) for n in g}


def main():
    start=time.time();cache=B/'analysis/phrase_features.jsonl.gz'
    views=defaultdict(lambda:{'n':0,'df':Counter(),'tf':Counter()});totals=Counter();seen=set();docmeta={};allterms=Counter()
    with gzip.open(IN,'rt',encoding='utf-8') as f,gzip.open(cache,'wt',encoding='utf-8') as out:
        for line in f:
            r=json.loads(line);text,ntrim=trim_prefix(r['analysis_text']);freq=feature_counts(text);rawfreq=feature_counts(r['analysis_text'])
            keys=['all','org:'+r['surveyed_by'],'year:'+r['survey_end_date'][:4],'purpose:'+r['sampling_stratum']]
            unique=r['normalized_text_sha256'] not in seen;seen.add(r['normalized_text_sha256'])
            if unique:keys.append('deduplicated')
            for key in keys:
                view=views[key];view['n']+=1;view['df'].update(freq.keys());view['tf'].update(freq)
            views['untrimmed']['n']+=1;views['untrimmed']['df'].update(rawfreq.keys());views['untrimmed']['tf'].update(rawfreq)
            totals['rows']+=1;totals['prefix_trimmed_rows']+=ntrim>0;totals['prefix_removed_characters']+=ntrim
            totals['zero_feature_rows']+=not bool(freq)
            out.write(json.dumps({'id':r['document_id'],'views':keys,'freq':dict(freq),'rawfreq':dict(rawfreq)},separators=(',',':'))+'\n')
            docmeta[r['document_id']]={'row':r['source_excel_row'],'tag':r['deficiency_tag'],'org':r['surveyed_by'],'date':r['survey_end_date'],'survey':r['survey_visit_id'],'purpose':r['sampling_stratum'],'pending':r['provider_linkage_status']!='assigned_CCN'}
    labels=[p for p in PHRASES if views['all']['df'][p]>=20]
    names={name:i for i,name in enumerate(labels)}
    accum={key:{'norm':Counter(),'dot':Counter(),'shared':Counter(),'examples':defaultdict(list),'surveys':defaultdict(set),'with_features':0} for key in views}
    with gzip.open(cache,'rt',encoding='utf-8') as f:
        for line in f:
            item=json.loads(line)
            for key in item['views']+['untrimmed']:
                freq=item['rawfreq'] if key=='untrimmed' else item['freq'];v=views[key];a=accum[key]
                vals={names[p]:(1+math.log(n))*(1+math.log((v['n']+1)/(v['df'][p]+1))) for p,n in freq.items() if p in names}
                denominator=math.sqrt(sum(x*x for x in vals.values()))
                if not denominator:continue
                vals={i:x/denominator for i,x in vals.items()};a['with_features']+=1
                for i,x in vals.items():
                    a['norm'][i]+=x*x;a['surveys'][i].add(docmeta[item['id']]['survey'])
                    if len(a['examples'][i])<3:a['examples'][i].append(item['id'])
                for i,j in combinations(sorted(vals),2):a['dot'][(i,j)]+=vals[i]*vals[j];a['shared'][(i,j)]+=1
    all_example_ids={i for a in accum.values() for ids in a['examples'].values() for i in ids};example_text={}
    with gzip.open(IN,'rt',encoding='utf-8') as f:
        for line in f:
            r=json.loads(line)
            if r['document_id'] in all_example_ids:example_text[r['document_id']]=r['analysis_text']
    graphs={};edge_rows=[];node_rows=[]
    for key,v in views.items():
        a=accum[key];edges=[]
        for (i,j),dot in a['dot'].items():
            weight=dot/math.sqrt(a['norm'][i]*a['norm'][j]);shared=a['shared'][(i,j)]
            if weight>=.08 and shared>=10:edges.append({'source':i,'target':j,'weight':round(weight,6),'shared':shared})
        edges.sort(key=lambda e:(-e['weight'],e['source'],e['target']))
        base=[e for e in edges if e['weight']>=.12 and e['shared']>=25]
        tops=defaultdict(list)
        for e in base:tops[e['source']].append(e);tops[e['target']].append(e)
        keep={(e['source'],e['target']) for es in tops.values() for e in es[:4]}
        defaultedges=[e for e in base if (e['source'],e['target']) in keep]
        connected={e[k] for e in defaultedges for k in ['source','target']}
        comm=communities(sorted(connected),defaultedges)
        nodes=[]
        for p,i in names.items():
            examples=[{'id':d,**docmeta[d],'excerpt':kwic(example_text[d] if key=='untrimmed' else trim_prefix(example_text[d])[0],p)} for d in a['examples'][i]]
            node={'id':i,'label':p,'count':v['df'][p],'surveyCount':len(a['surveys'][i]),'occurrences':v['tf'][p],'group':comm.get(i,-1),'examples':examples}
            nodes.append(node);node_rows.append({'view':key,**{k:x for k,x in node.items() if k!='examples'}})
        for e in edges:edge_rows.append({'view':key,'source_id':e['source'],'source_phrase':labels[e['source']],'target_id':e['target'],'target_phrase':labels[e['target']],'cosine':e['weight'],'shared_rows':e['shared']})
        graphs[key]={'label':key,'documents':v['n'],'featureDocuments':a['with_features'],'nodes':nodes,'edges':edges,'defaultEdges':len(defaultedges),'communities':len(set(comm.values())),'defaultIsolates':len(labels)-len(connected)}
    writecsv(B/'network/nodes.csv',node_rows);writecsv(B/'network/edges.csv',edge_rows)
    stats=[]
    for p in labels:
        stats.append({'phrase':p,'trimmed_document_frequency':views['all']['df'][p],'trimmed_survey_frequency':len(accum['all']['surveys'][names[p]]),'untrimmed_document_frequency':views['untrimmed']['df'][p],'deduplicated_document_frequency':views['deduplicated']['df'][p],'trimmed_denominator':views['all']['n'],'deduplicated_denominator':views['deduplicated']['n']})
    writecsv(B/'analysis/phrase_frequencies_and_sensitivity.csv',sorted(stats,key=lambda r:-r['trimmed_document_frequency']))
    (B/'network/network_payload.json').write_text(json.dumps({'views':graphs,'method':{'feature':'Researcher-selected phrase aliases, informed by pilot; not an exhaustive vocabulary or theme classifier','vector':'log TF × smoothed IDF, L2-normalized within each document over retained phrase features; cosine between phrase columns','edge':'same-record weighted association, not provider or causal tie','default':'cosine >= 0.12; >=25 shared rows; union of top-four neighbor lists; isolated phrases hidden by default','minimum_exported':'cosine >= 0.08; >=10 shared rows','communities':'greedy modularity on default displayed graph excluding isolates; colors are exploratory, not themes','prefix':'remove content before explicit this standard/condition was/is not met; quoted policies may remain','cohort':'purpose views use mutually exclusive sampling stratum; original overlapping flags retained in corpus'}},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    writecsv(B/'analysis/edge_threshold_sensitivity.csv',[{'cosine_threshold':cut,'minimum_shared_rows':25,'all_qualifying_edges':sum(e['weight']>=cut and e['shared']>=25 for e in graphs['all']['edges']),'phrases_with_any_qualifying_edge':len({e[k] for e in graphs['all']['edges'] if e['weight']>=cut and e['shared']>=25 for k in ['source','target']})} for cut in [.08,.10,.12,.20,.30]])
    # Pilot document similarity: each node is one of the 48 actually read source narratives.
    reading=json.loads((B/'coding/reading_sample.json').read_text(encoding='utf-8'))
    vectors={r['document_id']:feature_counts(trim_prefix(r['analysis_text'])[0]) for r in reading}
    pdf=Counter(p for c in vectors.values() for p in c);pn=len(reading);pvec={}
    for doc,c in vectors.items():
        w={p:(1+math.log(n))*(1+math.log((pn+1)/(pdf[p]+1))) for p,n in c.items() if p in names};norm=math.sqrt(sum(x*x for x in w.values()));pvec[doc]={p:x/norm for p,x in w.items()} if norm else {}
    pedges=[]
    for a,b in combinations(reading,2):
        av=pvec[a['document_id']];bv=pvec[b['document_id']];score=sum(x*bv.get(p,0) for p,x in av.items())
        if score>=.15:pedges.append({'source':a['document_id'],'target':b['document_id'],'weight':round(score,6)})
    (B/'network/pilot_document_similarity.json').write_text(json.dumps({'nodes':[{'id':r['document_id'],'pilot':r['pilot_id'],'tag':r['deficiency_tag'],'org':r['surveyed_by'],'row':r['source_excel_row']} for r in reading],'edges':pedges,'feature_space':'same researcher-selected phrases, TF-IDF fitted on the 48 selected narratives; edges are lexical similarity'},indent=2),encoding='utf-8')
    writecsv(B/'network/pilot_document_nodes.csv',[{'id':r['document_id'],'pilot':r['pilot_id'],'tag':r['deficiency_tag'],'org':r['surveyed_by'],'row':r['source_excel_row']} for r in reading])
    writecsv(B/'network/pilot_document_edges.csv',pedges,['source','target','weight'])
    summary={'candidate_rows':totals['rows'],'phrase_nodes':len(labels),'views':len(graphs),'all_exported_edges':len(graphs['all']['edges']),'default_displayed_edges':graphs['all']['defaultEdges'],'exploratory_communities':graphs['all']['communities'],'prefix_trimmed_rows':totals['prefix_trimmed_rows'],'rows_without_selected_phrases':totals['zero_feature_rows'],'deduplicated_rows':views['deduplicated']['n'],'pilot_read_rows':len(reading),'pilot_similarity_edges':len(pedges),'elapsed_seconds':round(time.time()-start,1),'top_phrases':sorted(stats,key=lambda r:-r['trimmed_document_frequency'])[:12]}
    (B/'analysis/analysis_summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2),flush=True)


if __name__=='__main__':main()
