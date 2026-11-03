"""Versioned provisional severity measurement. No thematic or clinical classifier."""
import math
import re
from collections import Counter, defaultdict
from itertools import combinations

VERSION = 'severity-v1.0-provisional'
FAMILIES = [
    ('Abuse',3,'abuse abused abusive abusing','418.52'),
    ('Neglect',3,'neglect neglected neglectful neglecting','418.52'),
    ('Sexual / assault',3,'sexual sexually assault assaulted harassment','418.52'),
    ('Exploitation / theft / diversion',3,'exploitation exploited misappropriation misappropriated theft stolen stealing diversion diverted','418.52'),
    ('Restraint / seclusion',3,'restraint restraints restrained seclusion secluded','418.110'),
    ('Injury',2,'injury injuries injured fracture fractures fractured laceration lacerations bruise bruises bruising bruised burn burns burned','418.110;418.52'),
    ('Harm',2,'harm harmed harmful','489.3'),
    ('Elopement / overdose',2,'elopement eloped overdose overdosed','489.3'),
    ('Grievance',1,'grievance grievances','418.52'),
]
CONTEXTS = ['N','I','P','K','R','E','U']
MULTIPLIERS = dict(zip(CONTEXTS,[0,0,.25,.5,.75,1,.5]))
WORDS = {w:i for i,(_,_,words,_) in enumerate(FAMILIES) for w in words.split()}
EXPECTED = [589,418,230,386,96,2016,600,81,266]
TOKEN = re.compile(r'[a-z]+',re.I)
PATIENT = re.compile(r'\b(?:patient|resident|client)\s*(?:#|number|no\.|[0-9])|\b(?:p|mr|rr|hv)\s*#',re.I)
EVENT = re.compile(r'\b(?:struck|hit|slapped|pushed|yelled|fell|sustained|assaulted|overdosed|eloped|stolen)\b|found on the floor|bruise on|fracture of|skin tear|(?:reported|alleged|stated|witnessed|observed).{0,60}(?:abuse|neglect|assault)|(?:emergency (?:room|department)|911|ambulance|police|adult protective services)',re.I)
REPORT = re.compile(r'(?:fail(?:ed|ure)?|did not|not|never|without).{0,55}(?:report|investigat|protect)|(?:report|investigat|protect).{0,35}(?:not (?:done|made|completed)|fail)',re.I)
PAPER = re.compile(r'\b(?:policy|policies|procedure|training|orientation|inservice|agreement|contract|rights notice|bill of rights|patient rights|patient\W+s rights|provision)\b|injuries of unknown source|misappropriation of patient property|verbal.{0,20}mental.{0,20}sexual',re.I)
RISK = re.compile(r'\b(?:risk (?:for|of)|at risk|potential for|potential to)\b',re.I)
NEG = re.compile(r'\bno (?:signs?|evidence|indication|reports?) (?:of|for)\b|\b(?:denied|denies|without evidence of)\b',re.I)
IJ = re.compile(r'(?:likely to cause|has caused|resulted in|risk of).{0,35}serious injury.{0,20}harm.{0,25}(?:impairment|death)|immediate jeopardy',re.I)


def band(s):
    return 'High' if s>=2 else 'Moderate' if s>=1 else 'Low' if s>0 else 'None'


def classify(text, start, end):
    # Sentence windows retain offsets; local clause scope prevents neighboring
    # requirement/negation/IJ words from swallowing a specific event mention.
    boundaries=[0]+[m.end() for m in re.finditer(r'[.!?](?:\s|$)|\n+',text)]+[len(text)]
    import bisect
    at=max(0,bisect.bisect_right(boundaries,start)-1)
    lo=boundaries[max(0,at-1)];hi=boundaries[min(len(boundaries)-1,at+2)]
    sentence=text[boundaries[at]:boundaries[min(len(boundaries)-1,at+1)]]
    local=text[max(boundaries[at],start-95):min(boundaries[min(len(boundaries)-1,at+1)],end+100)]
    before=text[max(boundaries[at],start-65):start]
    if NEG.search(before) and not re.search(r'\b(?:but|however)\b',before): code='N';reason='local negation before mention'
    elif IJ.search(local): code='I';reason='local IJ determination language'
    else:
        window=text[lo:hi]
        specific=bool(PATIENT.search(sentence) or PATIENT.search(window) and EVENT.search(sentence))
        if specific and REPORT.search(sentence): code='R';reason='specific-patient reporting/protection failure'
        elif specific and EVENT.search(sentence) and not RISK.search(local): code='E';reason='specific-patient event/allegation cue'
        elif PAPER.search(sentence): code='P';reason='requirement/policy/protection-process wording'
        elif RISK.search(local): code='K';reason='local risk/potential language'
        elif REPORT.search(sentence): code='R';reason='reporting/investigation/protection failure cue'
        elif specific and EVENT.search(window): code='E';reason='specific-patient event cue in adjacent sentence'
        else: code='U';reason='unresolved; queued for context review'
    return code,lo,hi,reason


def score_text(text, source_offset=0):
    matches=[(position,m,WORDS[m.group().lower()]) for position,m in enumerate(TOKEN.finditer(text)) if m.group().lower() in WORDS]
    mentions=[]
    for position,m,i in matches:
        code,lo,hi,reason=classify(text,m.start(),m.end())
        mentions.append({'family':i,'word':m.group(),'tier':FAMILIES[i][1],
            'token_position':position,'start':m.start(),'end':m.end(),
            'source_start':source_offset+m.start(),'source_end':source_offset+m.end(),
            'window_start':lo,'window_end':hi,'context':code,'label_source':'rule',
            'reason':reason,'multiplier':MULTIPLIERS[code],
            'score':FAMILIES[i][1]*MULTIPLIERS[code]})
    score=max((m['score'] for m in mentions),default=0)
    fs=[]
    for i in sorted({m['family'] for m in mentions}):
        mm=[m for m in mentions if m['family']==i]
        fs.append([i,max(m['score'] for m in mm),[sum(m['context']==c for m in mm) for c in CONTEXTS]])
    return {'score':score,'band':band(score),'family_count':len(fs),'families':fs,
            'paperwork_only':bool(mentions) and all(m['context']=='P' for m in mentions),'mentions':mentions}


def alternative_score(mentions, tiers=(3,2,1), context=None, aggregation='max'):
    mult=context or MULTIPLIERS
    vals=[tiers[3-m['tier']]*mult[m['context']] for m in mentions]
    return (sum(vals) if aggregation=='sum' else max(vals,default=0))


def rank(values):
    order=sorted(range(len(values)),key=lambda i:values[i]);result=[0.]*len(values);a=0
    while a<len(order):
        b=a+1
        while b<len(order) and values[order[b]]==values[order[a]]:b+=1
        for i in order[a:b]:result[i]=(a+b-1)/2
        a=b
    return result


def spearman(a,b):
    a=rank(a);b=rank(b);ma=sum(a)/len(a);mb=sum(b)/len(b)
    den=math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))
    return sum((x-ma)*(y-mb) for x,y in zip(a,b))/den if den else None


def jaccard(a,b):
    a=set(a);b=set(b);return len(a&b)/len(a|b) if a|b else 1.


def ppmi_edges(features,scores,weighted=True):
    total=0.;marg=Counter();joint=Counter();support=Counter();high=Counter()
    for ids,s in zip(features,scores):
        weight=1+s if weighted else 1.;total+=weight
        ids=sorted(set(ids))
        for i in ids:marg[i]+=weight
        for pair in combinations(ids,2):joint[pair]+=weight;support[pair]+=1;high[pair]+=s>=2
    edges=[]
    for (i,j),w in joint.items():
        minimum=10 if max(i,j)>=64 else 25
        if support[i,j]<minimum:continue
        lift=w*total/(marg[i]*marg[j])
        if lift<=1:continue
        edges.append({'source':i,'target':j,'weight':math.log2(lift),'lift':lift,
                      'shared':support[i,j],'highShare':high[i,j]/support[i,j]})
    return sorted(edges,key=lambda e:(-e['weight'],e['source'],e['target']))


def default_pairs(edges):
    degree=Counter();keep=set()
    for e in edges:
        if e['lift']<1.5:continue
        pair=(e['source'],e['target'])
        for n in pair:
            if degree[n]<4:keep.add(pair)
            degree[n]+=1
    return keep
