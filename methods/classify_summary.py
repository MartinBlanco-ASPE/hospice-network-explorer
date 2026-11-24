"""Classify one extracted issue-summary sentence using the disclosed study rules."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
STUDY='hospice'
def load(name,filename):
    spec=importlib.util.spec_from_file_location(name,HERE/filename)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
RULES=load('released_citation_rules','citation_rules.py')
ADAPTER=load('released_homehealth_rules','homehealth_care_area_rules.py') if STUDY=='homehealth' else None
if ADAPTER:ADAPTER.FROZEN_PATH=HERE/'citation_rules.py'
def classify(statement):
    return ADAPTER.classify(statement,rules=RULES) if ADAPTER else RULES.classify(statement)
if __name__=='__main__':print(json.dumps(classify(' '.join(sys.argv[1:])),ensure_ascii=False,indent=2))
