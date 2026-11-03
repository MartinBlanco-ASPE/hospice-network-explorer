"""Rebuild the self-contained dashboard from the included derived snapshot."""
from pathlib import Path
import argparse,hashlib,html,json,re

ROOT=Path(__file__).resolve().parent


def inline(s):
    s=html.escape(s)
    s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',r'<a href="\2">\1</a>',s)
    return re.sub(r'`([^`]+)`',r'<code>\1</code>',s)


def slug(s):return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')


def methodology():
    md=(ROOT/'README.md').read_text(encoding='utf-8');parts=[]
    for block in md.strip().split('\n\n'):
        if block.startswith('```'):
            lines=block.splitlines();parts.append('<pre><code>'+html.escape('\n'.join(lines[1:-1]))+'</code></pre>')
        elif block.startswith('# '):parts.append('<h1>'+inline(block[2:])+'</h1>')
        elif block.startswith('## '):parts.append('<h2 id="'+slug(block[3:])+'">'+inline(block[3:])+'</h2>')
        elif block.startswith('- '):parts.append('<ul>'+''.join('<li>'+inline(line[2:])+'</li>' for line in block.splitlines())+'</ul>')
        else:parts.append('<p>'+inline(block)+'</p>')
    style='body{margin:0;background:#f3f6f8;color:#193044;font:16px/1.7 Segoe UI,Arial,sans-serif}nav{background:#102f43;padding:15px 24px}nav a{color:#b7e8e2}main{max-width:920px;margin:24px auto;padding:28px 38px;background:white;border:1px solid #dce5eb;border-radius:12px}h1{line-height:1.2}h2{margin-top:30px;font-size:22px}a{color:#006c7b}pre{background:#edf5f6;padding:14px;overflow:auto}code{overflow-wrap:anywhere}li{margin:7px 0}@media(max-width:650px){main{padding:20px;margin:8px}h1{font-size:28px}}'
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hospice Network Explorer · Methodology</title><style>'+style+'</style></head><body><nav><a href="index.html">← Open dashboard</a></nav><main>'+''.join(parts)+'</main></body></html>'


def outputs():
    page=(ROOT/'src/page.html').read_text(encoding='utf-8');runtime=(ROOT/'src/dashboard.js').read_text(encoding='utf-8')
    for name in ['DATA','PILOT','CODING','READ','SEVERITY']:
        raw=(ROOT/'data'/f'{name.lower()}.json').read_text(encoding='utf-8');json.loads(raw)
        assert runtime.count('__'+name+'__')==1,name
        runtime=runtime.replace('__'+name+'__',raw)
    assert '__VIS_LIBRARY__' in page and '__DASHBOARD_RUNTIME__' in page
    page=page.replace('__VIS_LIBRARY__',(ROOT/'vendor/vis-network-9.1.9.min.js').read_text(encoding='utf-8')).replace('__DASHBOARD_RUNTIME__',runtime)
    return {'index.html':page,'methodology.html':methodology()}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();generated=outputs()
    for name,text in generated.items():
        if args.check:assert (ROOT/name).read_bytes()==text.encode('utf-8'),'Rebuild needed: '+name
        else:(ROOT/name).write_text(text,encoding='utf-8',newline='\n')
    paths=['build.py','README.md','src/page.html','src/dashboard.js','vendor/vis-network-9.1.9.min.js']+['data/'+n+'.json' for n in ['data','pilot','coding','read','severity','provenance']]+list(generated)
    manifest={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sorted(paths)}
    target=ROOT/'build_manifest.json'
    if args.check:assert json.loads(target.read_text(encoding='utf-8'))==manifest,'Build manifest differs'
    else:target.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'checked':args.check,'outputs':list(generated),'verified_files':len(manifest)}))


if __name__=='__main__':main()
