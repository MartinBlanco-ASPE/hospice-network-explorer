"""Reassemble the released derived snapshot using only Python's standard library."""
from pathlib import Path
import argparse,hashlib,json,re
ROOT=Path(__file__).resolve().parent
def grab(text,key):return json.JSONDecoder().raw_decode(text.split(key,1)[1])[0]
def outputs():
    release=json.loads((ROOT/'release.json').read_text(encoding='utf-8'))
    page=(ROOT/'src/page.html').read_text(encoding='utf-8')
    for item in json.loads((ROOT/'src/scripts.json').read_text(encoding='utf-8')):
        assert page.count(item['token'])==1
        page=page.replace(item['token'],item['open']+(ROOT/item['path']).read_text(encoding='utf-8')+item['close'],1)
    if release['source_newline']=='CRLF':page=page.replace('\n','\r\n')
    assert hashlib.sha256(page.encode()).hexdigest()==release['source_dashboard_sha256']
    classification=grab(page,'window.'+release['prefix']+'_CLASSIFICATION_PAGE=')
    classification=re.sub(r'<header>.*?</header>','',classification,count=1,flags=re.S)
    classification=re.sub(r'<title>.*?</title>','<title>'+release['name']+' care area classification</title>',classification,count=1,flags=re.S)
    bar='<div class="release-bar"><a href="index.html">← Dashboard</a> · <a href="methodology.html">Methods &amp; limits</a><strong>'+release['name']+' care area classification</strong><span>All years · Select years within the dashboard.</span></div>'
    style='<style>.release-bar{font:13px/1.5 system-ui;padding:14px 24px;color:#173c4b;background:#fff;border-bottom:1px solid #d9e5e8}.release-bar a{color:#087b78}.release-bar strong,.release-bar span{display:block}.release-bar strong{font-size:20px;margin:6px 0}.tr-card .chart-actions,.tr-select{flex-wrap:wrap;max-width:100%;min-width:0}</style>'
    classification=classification.replace('</head>',style+'</head>',1).replace('<body>','<body>'+bar,1)
    document=re.search(r'<section id="methodsPage".*?(?=<footer>)',page,re.S).group(0).strip()
    document=document.replace(' hidden','',1).replace('<div id="methodsScope"></div>','<div id="methodsScope"><p class="year-scope-note">All-years reference tables. Use the dashboard to select years for the charts.</p></div>')
    methods='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+release['name']+' methods and limits</title><style>body{margin:0;background:#f1f6f7;font:14px "Segoe UI",Arial,sans-serif}[hidden]{display:none!important}.release-nav{padding:14px 24px;background:#123343;color:white}.release-nav a{color:white;margin-right:20px}</style><style>'+(ROOT/'src/methods.css').read_text(encoding='utf-8')+'</style></head><body><nav class="release-nav"><a href="index.html">← Dashboard</a><a href="classification.html">Care area classification</a></nav>'+document+'</body></html>'
    return {'index.html':page,'classification.html':classification,'methodology.html':methods}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
    generated=outputs()
    for name,text in generated.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==text.encode('utf-8'),'Rebuild needed: '+name
        else:path.write_text(text,encoding='utf-8',newline='\n')
    names=['.gitattributes','.nojekyll','build.py','release.json','README.md','THIRD_PARTY_NOTICES.md',*generated]
    names += [p.relative_to(ROOT).as_posix() for folder in ['src','methods'] for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    manifest={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in sorted(set(names))}
    target=ROOT/'build_manifest.json'
    if args.check:assert json.loads(target.read_text(encoding='utf-8'))==manifest,'Build manifest differs'
    else:target.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'checked':args.check,'verified_files':len(manifest),'pages':list(generated)}))
if __name__=='__main__':main()
