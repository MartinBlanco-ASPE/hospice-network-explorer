"""Provider-balanced phrase coverage, source seriousness, and repeat-date sensitivity.

Uses assigned source CCNs only. Co-appearance at one hospice need not be in the
same record, survey, or episode. No new thematic coding is performed.
"""
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
import csv
import gzip
import hashlib
import json
import math

ROOT = Path(__file__).resolve().parents[3]
B = ROOT / 'Hospice/backend/phase3'


def read_jsonl(path):
    with gzip.open(path, 'rt', encoding='utf-8') as f:
        for line in f:
            yield json.loads(line)


def write_csv(path, rows):
    rows = list(rows)
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main():
    payload = json.loads((B / 'network/network_payload.json').read_text(encoding='utf-8'))
    labels = {n['label']: n['id'] for n in payload['views']['all']['nodes']}
    meta = {}
    for r in read_jsonl(ROOT / 'Hospice/backend/phase2/corpus/care_findings.jsonl.gz'):
        meta[r['document_id']] = {
            'provider': r['provider_key'] if r['provider_linkage_status'] == 'assigned_CCN' else None,
            'ccn': r['ccn'], 'row': r['source_excel_row'], 'date': r['survey_end_date'],
            'ij': r['immediate_jeopardy_original'] or 'Missing', 'level': r['tag_level'],
            'followup': bool(r['survey_purpose_flags'].get('follow_up')),
        }
    print('Source metadata loaded.', flush=True)
    # One entry per assigned CCN/phrase/view, aggregating rows without weighting
    # heavily surveyed providers more than once in provider incidence edges.
    members = {key: {} for key in payload['views']}
    all_dates = {key: defaultdict(set) for key in payload['views']}
    pending = Counter()
    row_levels = defaultdict(Counter)
    for feature in read_jsonl(B / 'analysis/phrase_features.jsonl.gz'):
        m = meta[feature['id']]
        for key in feature['views'] + ['untrimmed']:
            phrases = feature['rawfreq'] if key == 'untrimmed' else feature['freq']
            if m['provider']:
                all_dates[key][m['provider']].add(m['date'])
            else:
                pending[key] += 1
            for phrase in phrases:
                if phrase not in labels:
                    continue
                row_levels[key, phrase][m['level']] += 1
                if not m['provider']:
                    row_levels[key, phrase]['unassigned'] += 1
                    continue
                member_key = (m['provider'], phrase)
                a = members[key].get(member_key)
                if a is None:
                    a = members[key][member_key] = {'rows': [], 'dates': set(), 'nonfollowup_dates': set(), 'ij': Counter(), 'levels': Counter()}
                a['rows'].append(m['row'])
                a['dates'].add(m['date'])
                if not m['followup']:
                    a['nonfollowup_dates'].add(m['date'])
                a['ij'][m['ij']] += 1
                a['levels'][m['level']] += 1
    print('Coverage and repeat-date membership assembled.', flush=True)
    node_rows, edge_rows, summaries = [], [], []
    trace = gzip.open(B / 'analysis/hospice_phrase_membership_all.jsonl.gz', 'wt', encoding='utf-8')
    for key, graph in payload['views'].items():
        stats = defaultdict(Counter)
        provider_phrases = defaultdict(set)
        for (provider, phrase), a in members[key].items():
            p = stats[phrase]
            p['count'] += 1
            p['ijYes'] += bool(a['ij']['Yes'])
            known = bool(a['ij']['Yes'] or a['ij']['No'])
            p['ijKnown'] += known
            p['ijUnknownOnly'] += not known
            p['ijAnyMissing'] += bool(a['ij']['Missing'])
            p['ijPartialMissing'] += known and bool(a['ij']['Missing'])
            p['condition'] += bool(a['levels']['Condition'])
            p['levelKnown'] += bool(a['levels']['Condition'] or a['levels']['Standard'])
            p['repeatDates'] += len(a['dates']) > 1
            p['repeatNonFollowupDates'] += len(a['nonfollowup_dates']) > 1
            p['repeatEligible'] += len(all_dates[key][provider]) > 1
            provider_phrases[provider].add(labels[phrase])
            if key == 'all':
                trace.write(json.dumps({'provider_key': provider, 'phrase': phrase,
                    'source_excel_rows': a['rows'], 'survey_end_dates': sorted(a['dates']),
                    'non_followup_survey_end_dates': sorted(a['nonfollowup_dates']),
                    'ij_row_counts': dict(a['ij']), 'tag_level_row_counts': dict(a['levels'])}, separators=(',', ':')) + '\n')
        providers = len(all_dates[key])
        graph['hospiceTotals'] = {'count': providers, 'unassignedRows': pending[key],
            'multipleDates': sum(len(v) > 1 for v in all_dates[key].values())}
        for node in graph['nodes']:
            s = stats[node['label']]
            node['hospice'] = {field: s[field] for field in ('count', 'ijYes', 'ijKnown', 'ijUnknownOnly', 'ijAnyMissing', 'ijPartialMissing', 'condition', 'levelKnown', 'repeatDates', 'repeatNonFollowupDates', 'repeatEligible')}
            node['hospice']['unassignedRows'] = row_levels[key, node['label']]['unassigned']
            node['conditionRows'] = row_levels[key, node['label']]['Condition']
            node['standardRows'] = row_levels[key, node['label']]['Standard']
            assert 0 <= s['ijYes'] <= s['ijKnown'] <= s['count'] <= providers
            assert s['ijUnknownOnly'] + s['ijKnown'] == s['count']
            assert 0 <= s['repeatNonFollowupDates'] <= s['repeatDates'] <= s['repeatEligible'] <= s['count']
            assert node['conditionRows'] + node['standardRows'] == node['count']
            node_rows.append({'view': key, 'phrase': node['label'], 'records': node['count'],
                              'hospices_in_view': providers, **node['hospice'],
                              'condition_rows': node['conditionRows'], 'standard_rows': node['standardRows']})
        shared = Counter()
        for phrases in provider_phrases.values():
            shared.update(combinations(sorted(phrases), 2))
        by_id = {node['id']: node for node in graph['nodes']}
        edges = []
        for (i, j), common in shared.items():
            weight = common / math.sqrt(by_id[i]['hospice']['count'] * by_id[j]['hospice']['count'])
            assert common <= min(by_id[i]['hospice']['count'], by_id[j]['hospice']['count'])
            if common >= 10 and weight >= .08:
                edges.append({'source': i, 'target': j, 'shared': common, 'weight': round(weight, 6)})
                edge_rows.append({'view': key, 'source_phrase': by_id[i]['label'], 'target_phrase': by_id[j]['label'], 'cosine': round(weight, 6), 'shared_hospices': common})
        graph['hospiceEdges'] = sorted(edges, key=lambda e: (-e['weight'], e['source'], e['target']))
        base = {(e['source'], e['target']): e for e in graph['edges']}
        new = {(e['source'], e['target']): e for e in edges}
        intersection = set(base) & set(new)
        summary = {'view': key, **graph['hospiceTotals'], 'record_exported_edges': len(base),
                   'hospice_exported_edges': len(new), 'common_exported_pairs': len(intersection)}
        summaries.append(summary)
    trace.close()
    write_csv(B / 'analysis/hospice_phrase_coverage.csv', node_rows)
    write_csv(B / 'network/hospice_edges.csv', edge_rows)
    write_csv(B / 'analysis/hospice_record_network_comparison.csv', summaries)
    payload['hospiceMethod'] = {
        'identity': 'Assigned source CCN only; Pending identities excluded from hospice counts and edges, retained in record views.',
        'edge': 'Binary provider-by-phrase incidence. Cosine = shared hospices / sqrt(hospices mentioning A * hospices mentioning B). Phrases may occur in different records and surveys at the same hospice.',
        'severity': 'Any phrase-matching row for a hospice flagged IJ Yes; denominator includes hospices with at least one known Yes/No flag in matching rows. All-missing and partial-missing counts shown separately. Condition association is separate, not a composite severity score.',
        'repeat': 'Same phrase at the same assigned CCN on at least two distinct survey-end dates within the selected view. May include follow-up recitations, copied text, or related surveys. Also report repeats on non-follow-up dates only.',
        'interpretation': 'Text associations, not provider ties, independent failure events, validated themes, or national prevalence. Distinct CCNs do not establish distinct corporate owners.',
    }
    out = B / 'network/hospice_network_payload.json'
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    result = {'candidate_records': len(meta), 'identified_hospices': payload['views']['all']['hospiceTotals']['count'],
              'unassigned_rows': pending['all'], 'views': len(payload['views']),
              'ij_yes_hospices': len({m['provider'] for m in meta.values() if m['provider'] and m['ij'] == 'Yes'}),
              'ij_known_hospices': len({m['provider'] for m in meta.values() if m['provider'] and m['ij'] in ('Yes', 'No')}),
              'condition_associated_hospices': len({m['provider'] for m in meta.values() if m['provider'] and m['level'] == 'Condition'}),
              'source_payload_sha256': hashlib.sha256((B / 'network/network_payload.json').read_bytes()).hexdigest(),
              'feature_cache_sha256': hashlib.sha256((B / 'analysis/phrase_features.jsonl.gz').read_bytes()).hexdigest(),
              'care_corpus_sha256': hashlib.sha256((ROOT / 'Hospice/backend/phase2/corpus/care_findings.jsonl.gz').read_bytes()).hexdigest(),
              'close_reading_or_coding_added': 0, 'phase4': 'locked'}
    (B / 'analysis/hospice_network_summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2), flush=True)


if __name__ == '__main__':
    main()
