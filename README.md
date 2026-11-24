# Hospice Citation Explorer

[Open dashboard](https://martinblanco-aspe.github.io/hospice-network-explorer/) · [Care area classification](https://martinblanco-aspe.github.io/hospice-network-explorer/classification.html) · [Methods & limits](https://martinblanco-aspe.github.io/hospice-network-explorer/methodology.html)

Updated November 24, 2026. This dashboard describes care-related findings in CMS Quality, Certification and Oversight Reports (QCOR) citation records. It shows which requirements were cited, which care topics appear together, and the failure patterns reported within each primary care area. Home health is maintained as a separate study; observations are not joined across studies.

## Explore the dashboard

- **Start here:** a short introduction to survey reports, deficiency tags and the data sources.
- **Regulations & requirements:** a sunburst of source-cited regulation sections and requirement categories. Ray length shows distinct source agencies; shade compares citation counts within a regulation.
- **Care area connections:** a network of care areas matched in the same summary. “Named together” shows shared citations; “Main → also named” shows the existing primary text label and other matches.
- **Care issue heatmap:** primary care area × primary failure type. Percentages use each care-area row total. Hover or click a care-area cell to preview or lock its row.
- **Methods & limits:** source definitions, counts, year and survey-type tables, classification procedures and limitations.

The multiple-year filter applies to the dashboard charts and examples. The standalone [classification explorer](https://martinblanco-aspe.github.io/hospice-network-explorer/classification.html) opens on **Care areas** and includes requirement-category and failure-type trees. Its direct link shows all years; open classification beneath the dashboard sunburst to use selected years.

## Data represented

| Measure | All-years care dataset |
|---|---:|
| Citation rows | 67,594 |
| Existing survey groups | 11,389 |
| Distinct source agency identifiers | 6,488 |
| Source-cited regulation sections | 22 |
| Distinct deficiency tags | 301 |
| Requirement categories | 19 |
| Named care-area categories | 25, plus Other |
| Failure types | 12, plus Other |
| Included survey dates | 2021-10-01 through 2026-09-25 |

Survey groups use the study’s existing source identifiers. They are not a count of PDFs separately reviewed. Partial years and source coverage limit year-to-year comparisons. Full annual and exact survey-type counts are in [Methods & limits](https://martinblanco-aspe.github.io/hospice-network-explorer/methodology.html). Source dataset: `hospice-classification-v1.0 / existing Phase 2 care corpus / HSP-IDG-DISPLAY-2026-11-24`.

## NLP and classification algorithms

The classification uses **deterministic, rule-based natural language processing (NLP)** and a source-linked tag mapping. It does not train a statistical or transformer classifier.

1. **Normalize and extract text.** Existing rules clean whitespace, split sentences, locate deficiency cues such as “failed to” or “did not,” and extract the surveyor’s issue summary. They trim specified boilerplate, evidence framing and sample descriptions. This is summary extraction by rules, not generated summarization.
2. **Map requirements.** Each deficiency tag inherits one requirement category from the existing section-based mapping, with specific tag, tag-range or paragraph exceptions. The [mapping table](methods/requirement_mapping.csv) preserves those assignments and their basis.
3. **Match care areas.** Case-insensitive regular expressions match disclosed words and phrases in the issue text. A summary may match several areas. The primary care area generally follows the earliest matched topic, with fixed tie-breaking, governance/quality exceptions and existing fallback rules.
4. **Match failure types.** Predefined regular expressions identify failure wording. Multiple patterns may match; a fixed check order chooses the primary type. “Other” retains unclassified records. Primary selection follows the disclosed study-specific rules; original wording flags remain backend trace fields.
5. **Count associations.** Each care area and pair counts at most once per citation. Lift compares observed co-occurrence with an independence baseline. Positive pointwise mutual information (PPMI) summarizes association strength. Default network lines require at least 25 shared citations, lift ≥ 1.5, and selection among either endpoint’s four strongest qualifying PPMI neighbors.

```text
N   = eligible citation rows in the selected years
nA  = rows mentioning care area A
nB  = rows mentioning care area B
nAB = rows mentioning both A and B

expected shared rows = nA * nB / N
lift(A,B)            = N * nAB / (nA * nB)
PPMI(A,B)            = max(0, log2(lift(A,B)))
```

Zero marginals do not create a link. Network layout uses D3 force-based positioning; positions arrange the display and do not quantify clinical similarity. Colors identify predefined topic groups. They are not evidence of machine-learned clusters or severity.

The lexical classification does not use embeddings, semantic similarity, topic-model training or inferred synonym expansion. AI assistance in developing rules and reviewing selected material is separate from classifying the complete corpus with those fixed rules. Computational consistency does not establish independent human or clinical validation.

Inspect [the frozen citation rules](methods/citation_rules.py), [the study-specific classifier](methods/classify_summary.py), [classification versions and IDG decisions](methods/classification_contract.json), [requirement mapping](methods/requirement_mapping.csv), [label definitions](methods/label_definitions.json), and [aggregate data profile](methods/data_profile.json). The [classification explorer](https://martinblanco-aspe.github.io/hospice-network-explorer/classification.html) shows the words and phrases behind the labels. Hospice retains its adopted IDG services assignments; the original wording flag does not create a separate care-area category.

## Interpretation and limits

Citation rows, survey groups, agencies and patients are different units. The network includes all matched care areas, so pair counts overlap. The heatmap counts each citation once under its primary care area and primary failure type. Primary means the existing text-rule selection, not clinical importance.

This is descriptive text analysis of the selected extract. Associations do not establish causation, provider relationships, statistical significance, patient-harm prevalence or national noncompliance rates. Current regulation links do not resolve the policy version applicable to each historical survey. The existing hospice requirement mapping retains the documented L0651 governance-to-delivery assignment and related L0650 issue. The owner retained IDG actor wording under the adopted IDG services care area; its original flag remains a backend trace field. Quoted rule language can also affect topic matches. Methods & limits records these decisions and limitations.

## Build and verification

Python 3 with the standard library is sufficient:

```sh
python build.py
python build.py --check
```

`src/page.html` and `src/scripts/` reproduce the released dashboard byte for byte. The build also creates `classification.html` and `methodology.html`; `build_manifest.json` records source/output hashes. Files under `validation/` record release checks. Rebuilding this derived display snapshot does not reconstruct the original workbook or rerun the study’s data audit.

The publication includes the reviewed derived display data and bounded source examples already embedded in the local dashboard. Original workbooks, full reconstructed narrative corpora, internal study notes, policy-source archives and policy-result synthesis are excluded. The previous public release is preserved under [`legacy/pre-2026-11-23/`](legacy/pre-2026-11-23/) and in Git history; its methods and counts describe that historical version.

## Official sources

- [CMS QCOR](https://qcor.cms.gov/)
- [42 CFR Part 418 — Hospice Care](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-418)
- [CMS State Operations Manual, Appendix M — Hospice](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/som107ap_m_hospice.pdf)

Third-party visualization licensing is recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
