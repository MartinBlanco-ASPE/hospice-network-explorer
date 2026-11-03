"""Score both text variants, reproduce handoff counts, build audit/review/sensitivities."""
from pathlib import Path
from collections import Counter,defaultdict
from datetime import datetime,timezone
import csv,gzip,hashlib,html,json,random,shutil
from analyze_phase3 import trim_prefix
from severity_core import *

ROOT=Path(__file__).resolve().parents[3]
B=ROOT/'Hospice/backend/phase3/severity'
P=ROOT/'Hospice/03_thematic_analysis/severity'


def readrows(path):
    with gzip.open(path,'rt',encoding='utf-8') as f:
        for line in f:yield json.loads(line)


def dump(path,value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')


def csvout(name,rows,fields=None):
    rows=list(rows)
    with (B/name).open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields or list(rows[0]));w.writeheader();w.writerows(rows)


def main():
    B.mkdir(parents=True,exist_ok=True);P.mkdir(parents=True,exist_ok=True)
    stamp=datetime.now(timezone.utc).isoformat()
    manifest=json.loads((ROOT/'Hospice/backend/phase2/artifact_manifest.json').read_text())
    protected=[ROOT/a['path'] for a in manifest['artifacts']]
    protected+=list((ROOT/'Hospice/backend/source_data').glob('*.xlsx'))
    protected+=[ROOT/'Hospice/backend/phase3'/s for s in ['network/network_payload.json','network/hospice_network_payload.json','analysis/phrase_features.jsonl.gz']]
    hashes={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
    for a in manifest['artifacts']:assert hashes[a['path']]==a['sha256'],a['path']
    snapshot=B/'protected_input_hashes.json'
    if snapshot.exists():assert json.loads(snapshot.read_text())==hashes,'Protected inputs changed'
    else:dump(snapshot,hashes)
    shutil.copyfile(ROOT/'SEVERITY_FLAG_HANDOFF.md',B/'SOURCE_HANDOFF.md')
    csvout('lexicon_v1.csv',[{'family_id':i,'family':n,'tier':t,'words':w,'policy_sections':a,'version':VERSION} for i,(n,t,w,a) in enumerate(FAMILIES)])
    dump(B/'context_rules_v1.json',{'version':VERSION,'multipliers':MULTIPLIERS,'patterns':{k:v.pattern for k,v in {'patient':PATIENT,'event':EVENT,'report':REPORT,'paperwork':PAPER,'risk':RISK,'negation':NEG,'ij':IJ}.items()},'precedence':'local N, local I; specific-patient R/E overrides P; otherwise P,K,R,E,U','scope':'sentence plus one adjacent sentence each side; local mention clauses for N/I/K','label_source':'rule; AI-authored rules, no claim of AI reading each scored record','unresolved':'U retained and queued; no per-mention AI adjudication yet','aggregation':'maximum; no-match/only N/I is zero, not evidence of no harm','final_lexicon_approval':'pending; user authorized provisional implementation'})
    sources=list(readrows(ROOT/'Hospice/backend/phase2/corpus/care_findings.jsonl.gz'))
    base=json.loads((ROOT/'Hospice/backend/phase3/network/network_payload.json').read_text(encoding='utf-8'))
    labels={n['label']:n['id'] for n in base['views']['all']['nodes']}
    cache=list(readrows(ROOT/'Hospice/backend/phase3/analysis/phrase_features.jsonl.gz'))
    assert [r['document_id'] for r in sources]==[r['id'] for r in cache]
    scored=[];compact={};family_counts=Counter();raw_counts=Counter();contexts=Counter();bands=Counter();strata=defaultdict(Counter);family_stats=defaultdict(Counter);queue=[];examples=defaultdict(list)
    case_providers=defaultdict(set);original_providers=set();normalized_providers=set()
    with gzip.open(B/'record_severity.jsonl.gz','wt',encoding='utf-8') as out,gzip.open(B/'record_severity_untrimmed.jsonl.gz','wt',encoding='utf-8') as rawout:
        for index,r in enumerate(sources):
            text,offset=trim_prefix(r['analysis_text']);a=score_text(text,offset);raw=score_text(r['analysis_text']) if offset else a
            scored.append(a)
            provider=r['ccn'].upper() if r['provider_linkage_status']=='assigned_CCN' else None
            if provider:original_providers.add(r['provider_key']);normalized_providers.add(provider);case_providers[provider].add(r['provider_key'])
            for variant,handle in [(a,out),(raw,rawout)]:
                handle.write(json.dumps({'document_id':r['document_id'],'source_excel_row':r['source_excel_row'],'assigned_ccn':provider,'survey_end_date':r['survey_end_date'],'ij':r['immediate_jeopardy_original'],'tag_level':r['tag_level'],'version':VERSION,**variant},separators=(',',':'))+'\n')
            if a['families'] or raw['families']:
                compact[str(r['source_excel_row'])]=[a['score'],raw['score'],int(a['paperwork_only']),int(raw['paperwork_only']),a['families'],raw['families']]
            family_counts.update(i for i,*_ in a['families']);raw_counts.update(i for i,*_ in raw['families']);bands[a['band']]+=1
            for m in a['mentions']:
                contexts[m['context']]+=1
                if m['context']=='U':queue.append({'document_id':r['document_id'],'source_excel_row':r['source_excel_row'],'family':FAMILIES[m['family']][0],'start':m['source_start'],'end':m['source_end'],'context':'U','status':'unresolved; human/AI reading pending'})
            for key in [('surveyor',r['surveyed_by']),('context',r['sampling_stratum']),('surveyor_context',r['surveyed_by']+' / '+r['sampling_stratum'])]:
                s=strata[key];s['records']+=1;s[a['band']]+=1
            for i,*_ in a['families']:
                s=family_stats[i];s['records']+=1;s['ijYes']+=r['immediate_jeopardy_original']=='Yes';s['ijKnown']+=r['immediate_jeopardy_original'] in ('Yes','No');s['condition']+=r['tag_level']=='Condition'
                for code in sorted({m['context'] for m in a['mentions'] if m['family']==i}):
                    if len(examples[i,code])<3:
                        examples[i,code].append({'id':r['document_id'],'row':r['source_excel_row'],'org':r['surveyed_by'],'date':r['survey_end_date'],'tag':r['deficiency_tag'],'ij':r['immediate_jeopardy_original'] or 'Missing','text':r['analysis_text'],'context':code})
            if index and index%15000==0:print('Scored',index,flush=True)
    reproduced=[family_counts[i] for i in range(9)]
    dump(B/'handoff_reproduction.json',{'expected':EXPECTED,'actual':reproduced,'exact_match':reproduced==EXPECTED,'word_forms_match':'token-presence definitions in handoff; no aliases added'})
    assert reproduced==EXPECTED,('Handoff counts differ',reproduced)
    csvout('unresolved_mentions.csv',queue,['document_id','source_excel_row','family','start','end','context','status'])
    csvout('severity_by_family.csv',[{'family':n,**family_stats[i],'raw_records':raw_counts[i],'ij_share_known':family_stats[i]['ijYes']/family_stats[i]['ijKnown'] if family_stats[i]['ijKnown'] else ''} for i,(n,*_) in enumerate(FAMILIES)])
    csvout('severity_by_surveyor_context.csv',[{'dimension':k[0],'group':k[1],**{f:s[f] for f in ['records','High','Moderate','Low','None']}} for k,s in sorted(strata.items())])
    byband=[]
    for name in ['High','Moderate','Low','None']:
        rows=[r for r,a in zip(sources,scored) if a['band']==name]
        known=sum(r['immediate_jeopardy_original'] in ('Yes','No') for r in rows);yes=sum(r['immediate_jeopardy_original']=='Yes' for r in rows)
        byband.append({'band':name,'records':len(rows),'ij_yes':yes,'ij_known':known,'ij_share':yes/known if known else None,'condition_records':sum(r['tag_level']=='Condition' for r in rows)})
    csvout('severity_by_band.csv',byband)
    features=[sorted([labels[p] for p in c['freq'] if p in labels]+[64+i for i,*_ in a['families']]) for c,a in zip(cache,scored)]
    scores=[a['score'] for a in scored]
    edgebase=default_pairs(ppmi_edges(features,scores))
    variants=[('equal_tiers',(1,1,1),None,'max'),('base',(3,2,1),None,'max'),('tier_4_2_1',(4,2,1),None,'max'),('tier_5_3_1',(5,3,1),None,'max'),('strict',(3,2,1),dict(zip(CONTEXTS,[0,0,0,0,1,1,0])),'max'),('lenient',(3,2,1),dict(zip(CONTEXTS,[0,0,.5,.75,.75,1,.75])),'max'),('sum',(3,2,1),None,'sum')]
    base_top=sorted(range(len(scores)),key=lambda i:(-scores[i],sources[i]['document_id']))[:500]
    def hosp(values):
        out=defaultdict(float)
        for r,v in zip(sources,values):
            if r['provider_linkage_status']=='assigned_CCN':out[r['ccn'].upper()]=max(out[r['ccn'].upper()],v)
        return out
    base_h=hosp(scores);top_h=sorted(base_h,key=lambda p:(-base_h[p],p))[:100]
    sensitivities=[];transitions=[]
    for name,tiers,ctx,agg in variants:
        vals=scores if name=='base' else [alternative_score(a['mentions'],tiers,ctx,agg) for a in scored]
        hs=hosp(vals);top=sorted(range(len(vals)),key=lambda i:(-vals[i],sources[i]['document_id']))[:500]
        pairs=default_pairs(ppmi_edges(features,vals));matrix=Counter((band(a),band(b)) for a,b in zip(scores,vals))
        sensitivities.append({'variant':name,'spearman':spearman(scores,vals),'top500_record_jaccard':jaccard(base_top,top),'top100_hospice_jaccard':jaccard(top_h,sorted(hs,key=lambda p:(-hs[p],p))[:100]),'default_edge_jaccard':jaccard(edgebase,pairs),'High_records':sum(v>=2 for v in vals)})
        transitions.extend({'variant':name,'from_band':a,'to_band':b,'records':n} for (a,b),n in matrix.items())
    csvout('sensitivity_results.csv',sensitivities);csvout('band_transitions.csv',transitions)
    for weighted in [False,True]:
        edges=ppmi_edges(features,scores,weighted)
        csvout('severity_edges.csv' if weighted else 'unweighted_ppmi_edges.csv',edges)
    high_dates=defaultdict(set);nonfollow=defaultdict(set)
    for r,a in zip(sources,scored):
        if a['score']>=2 and r['provider_linkage_status']=='assigned_CCN':
            high_dates[r['ccn'].upper()].add(r['survey_end_date'])
            if not r['survey_purpose_flags']['follow_up']:nonfollow[r['ccn'].upper()].add(r['survey_end_date'])
    csvout('hospice_severity.csv',[{'assigned_ccn':p,'max_score':s,'band':band(s),'High_dates':len(high_dates[p]),'High_nonfollowup_dates':len(nonfollow[p])} for p,s in sorted(base_h.items())])
    # Deterministic, stratified review set. Overlapping family/context quotas are
    # filled first, then randomized to 150 flagged; add 30 IJ+ no-match and 30
    # random unflagged. Draws are not a representative validation design.
    rng=random.Random(20261103);selected=set()
    def choose(pool,n):
        pool=[i for i in pool if i not in selected];rng.shuffle(pool);selected.update(pool[:n])
    for fam in range(9):choose([i for i,a in enumerate(scored) if any(f[0]==fam for f in a['families'])],10)
    for ctx in CONTEXTS:choose([i for i,a in enumerate(scored) if any(m['context']==ctx for m in a['mentions'])],1)
    choose([i for i,(r,a) in enumerate(zip(sources,scored)) if a['mentions'] and r['deficiency_tag'] in ('L0771','L0517')],10)
    choose([i for i,a in enumerate(scored) if a['mentions']],150-len(selected));assert len(selected)==150
    flagged=set(selected)
    choose([i for i,(r,a) in enumerate(zip(sources,scored)) if not a['mentions'] and r['immediate_jeopardy_original']=='Yes'],30)
    ijextra=selected-flagged
    choose([i for i,a in enumerate(scored) if not a['mentions']],30)
    review=[]
    for i in sorted(selected,key=lambda i:sources[i]['source_excel_row']):
        r=sources[i];a=scored[i]
        review.append({'document_id':r['document_id'],'row':r['source_excel_row'],'org':r['surveyed_by'],'date':r['survey_end_date'],'context':r['sampling_stratum'],'tag':r['deficiency_tag'],'text':r['analysis_text'],'score':a['score'],'band':a['band'],'mentions':a['mentions'],'sampling_group':'flagged' if i in flagged else 'IJ_yes_no_lexicon_match' if i in ijextra else 'random_no_lexicon_match'})
    sample_text=json.dumps(review,ensure_ascii=False,indent=2)
    results_path=B/'validation_results.json'
    prior=json.loads(results_path.read_text(encoding='utf-8')) if results_path.exists() else None
    if prior and prior.get('human_responses',0):
        assert prior.get('sample_hash')==hashlib.sha256(sample_text.encode()).hexdigest(), 'Existing human review belongs to a different sample; retain/version it before rebuilding'
    (B/'validation_sample.json').write_text(sample_text,encoding='utf-8')
    if not prior or not prior.get('human_responses',0):
        dump(results_path,{'status':'pending human review','sample_records':len(review),'human_responses':0,'precision':None,'kappa':None,'target_high_precision':.8,'note':'No validation claim. Report stratified estimates/uncertainty and disagreement, not just a pooled precision threshold.'})
    dump(B/'severity_network_payload.json',{'version':VERSION,'status':'provisional','families':[{'id':64+i,'label':n,'tier':t,'aliases':w.split(),'anchor':a} for i,(n,t,w,a) in enumerate(FAMILIES)],'contexts':CONTEXTS,'records':compact,'examples':{str(64+i):[x for code in CONTEXTS for x in examples[i,code]] for i in range(9)},'normalization':'uppercase assigned CCNs in severity-only views; preserve legacy defaults'})
    summary={'version':VERSION,'built_utc':stamp,'candidate_records':len(sources),'records_with_any_lexicon_match':sum(bool(a['mentions']) for a in scored),'positive_score_records':sum(a['score']>0 for a in scored),'bands':dict(bands),'context_mention_counts':dict(contexts),'unresolved_mentions':len(queue),'original_assigned_keys':len(original_providers),'case_normalized_ccns':len(normalized_providers),'case_variants':{k:sorted(v) for k,v in case_providers.items() if len(v)>1},'High_hospices':sum(v>=2 for v in base_h.values()),'repeat_High_dates_hospices':sum(len(v)>1 for v in high_dates.values()),'repeat_High_nonfollowup_dates_hospices':sum(len(v)>1 for v in nonfollow.values()),'handoff_family_counts_exact':True,'human_validation':'pending','label_source_counts':{'rule':sum(contexts.values()),'AI_read':0,'human':0},'phase4':'locked'}
    dump(B/'severity_summary.json',summary)
    print(json.dumps(summary,indent=2),flush=True)


if __name__=='__main__':main()
