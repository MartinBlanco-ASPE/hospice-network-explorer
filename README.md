# Hospice Network Explorer

[Open the interactive dashboard](https://martinblanco-aspe.github.io/hospice-network-explorer/) · [Detailed methodology](https://martinblanco-aspe.github.io/hospice-network-explorer/methodology.html)

An exploratory browser dashboard of wording in CMS hospice QCOR survey narratives. Release: November 13, 2026. The dashboard includes the current CMS-classified network views, targeted removal simulations, and the compact care-wording policy sunburst with agency-based ray extensions, record-frequency shading and layered highlights. This release supersedes the November 7 dashboard behavior. Home health is maintained in a separate repository; no observations are joined between studies.

## Data and analytical scope

The source workbook covers October 2021–September 2026. The care corpus has 67,594 candidate records and 6,486 case-normalized assigned source CCNs. Pending identities contribute to record-based calculations but not assigned-hospice coverage. The 70 held records and separate emergency-preparedness/life-safety material remain outside this care analysis. Source CCNs are descriptive identifiers, not independently verified agency histories.

This repository includes derived feature-incidence data, source classifications, pilot material, and bounded illustrative excerpts already embedded in the reviewed dashboard. The CMS-classified payload contains 29,568 excerpt entries across phrase/tag groups and evidence/untrimmed modes; these entries overlap and are not unique patients, records, or additional coded cases. Their purpose is filtered source inspection. The original workbook, full reconstructed narrative corpus, internal notes, policy-source archives and policy-result synthesis are excluded.

Automated matching is distinct from complete-account reading. The study records AI-assisted reading/coding of 96 selected narratives; the original pilot view contains the first 48. Independent human semantic validation and saturation are not claimed. Counts cannot establish patient-harm prevalence, provider ties, national noncompliance rates, causation or policy effectiveness.

## Current network views and source classifications

The four views are Wording patterns, Standard-level deficiency, Condition-level deficiency and IJ. The 64 care phrases use research-defined aliases. Standard and Condition use source deficiency-level fields; IJ uses source IJ Yes and overlaps those levels. Missing IJ remains missing. Within the care corpus, 64,310 records are Standard, 3,284 Condition, and 289 IJ Yes (35 Standard and 254 Condition).

Classified views rank five source deficiency tags by distinct assigned hospices, then matching records and tag code. Those tags are protected diamonds. Their plain-language names appear on the map and source tag codes remain in metadata/tooltips. Policy descriptions are explanatory references; source classifications are not reassigned by text severity keywords.

The general default shows 64 phrases and 172 connections. Nodes describe text features. Phrase magnitude counts distinct assigned source hospices with matching wording in the selected cohort. Lines describe text relationships, not actual provider connections. Year, surveyor, survey purpose, text and graph controls apply to network calculations; the policy sunburst uses the separate full-corpus reference view.

## Connection mathematics

For a selected record set, N is its record count, nA and nB count records containing each feature, and nAB counts records containing both. Each feature counts once per record for these presence-based calculations.

```text
lift(A,B) = N * nAB / (nA * nB)
PPMI(A,B) = max(0, log2(lift(A,B)))
```

The current CMS views use unweighted same-record PPMI. The default support is at least 25 shared records, with lift at least 1.5; strongest-neighbor pruning keeps the union of the four strongest qualifying neighbors at either endpoint. Phrase/tag links use the same displayed graph construction rather than lexical harm weighting. A zero marginal does not yield an edge. Feature definitions, support, pruning, cohort and resolution influence the result.

Alternative feature constructions and text handling are exploratory sensitivities. Hospice-incidence connections use phrase presence across an assigned hospice's selected records and can connect wording appearing on different dates. Exact-text collapse is a text sensitivity, not a verified duplicate-event removal rule. Community colors identify algorithmic wording groups, not validated clinical themes. Screen positions and distances are browsing aids.

## Removal simulations

Turn Simulation on in the map. Four wording strategies are available: Separate the wording clusters; Best path to shatter it; Make the largest piece smaller; Most common phrases. Wording playback covers up to 40 removals. Cluster separation uses a vertex cover of the initial between-cluster links; the full default all-cluster cover has 23 phrases. Default exact results and filtered best-found results are labeled separately. Shatter/shrink playback follows fixed finish-line sets, with dotted per-count references distinguished from the solid sequential paths. A best-found set is not a general optimality claim.

In Standard, Condition and IJ, select one of the five protected source-tag targets. Stage 1 removes care phrases to leave that target outside a surviving strict-majority main component. All tag diamonds remain protected. Default stored target solutions have independent zero-gap integer-program checks; changed graph/filter settings invoke a qualified best-found search. No-link, already-separated and main-network-shift outcomes are distinguished. A route certificate for fixed endpoints does not independently prove the additional majority constraint.

```text
Stage 1: minimize |R|, subject to target not in C and 2*|C| > N0 - |R|
Largest-piece share = largest surviving component size / starting node count
Fragmentation = 1 - sum(s_i*(s_i-1)) / (n*(n-1))
```

R contains removable care phrases; C is a complete surviving connected component; N0 includes all starting nodes, including protected tags. Component sizes s_i and surviving count n include surviving tags. The retained fragmentation engine uses 1 when n is at most 1.

Stage 2 greedily removes additional phrases to fragment the graph; it has no minimum-removal guarantee. Protected links can obstruct complete dismantling. Paused map clicks and removed pills support manual exploration; there is no manual-removal dropdown. Target-neighbor links receive red emphasis. Playback preserves pan/zoom and Neutral colors retain teal phrase nodes and red diamonds. These simulations describe text topology, not effects of improving care or changing policy.

## Issues and policy

The compact sunburst shows the 64 care phrases in 86 phrase–policy mappings. References are primarily [42 CFR Part 418](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-418), explained using the existing [CMS Appendix M](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/downloads/som107ap_m_hospice.pdf) reference material. Current reference links are not a complete historical finding-to-law crosswalk. Source tags remain available in network evidence and underlying data; the simplified sunburst displays care wording only.

Every ray has equal label space plus an extension proportional to distinct assigned agencies: extension = 100 × agency count / largest care-phrase agency count. Full phrase labels wrap. Section labels remain present in the compact ring, with smaller text for narrow sectors. Equal angular widths count mappings; category hue identifies the policy section.

Within each policy category, lighter shades mean fewer matching records and darker shades mean more. Shade position t = (records − minimum) / (maximum − minimum); the category-color contribution rises from 22% to 100% over a white background. A tied/single-value category uses its full color. Category scales are separate, so identical shades across categories do not imply equal counts. Legends show the record ranges.

Hover previews and click locks a phrase/policy branch. A separate pointer-transparent layer outlines related sectors and temporarily fades unrelated ones. A small Clear highlight button appears at the top right of the map only while a highlight is locked. The former highlight-summary card is omitted; hover tooltips and source details supply the information. The floating button, center click or Escape restores the original frequency colors without shifting the chart. Agency lengths, raw counts and underlying fills do not change during highlighting. The accessible phrase list, policy legend, exact counts, saved evidence and pilot navigation remain. Top search/vocabulary/metric filters are omitted.

A phrase linked to several policies repeats its corpus-wide value under each; do not add these as unique observations or interpret them as citations restricted to that policy. Neither frequency nor shade measures harm or policy importance.

## Reading coverage and validation

This is provisional descriptive text analysis. Survey selection, publication lag, partial calendar endpoints, source documentation differences, repeated wording and unresolved historical policy versions limit comparisons. Source findings, patients, providers, records and independent survey events are distinct units. No independent clinical validation, saturation, causal inference or Phase 4 policy-result synthesis is included in this public release.

Release checks compare packaged network/source metadata and graph views to the approved local dashboard, verify sunburst geometry/counts/shading/highlight interactions on desktop/mobile, check local links and build hashes, and test the live Pages site. The scoped snapshot is a research presentation, not an official CMS reporting product or federal endorsement.

## Communities, size, and comparisons

Weighted community grouping is exploratory and varies with the displayed graph and controls. Node magnitude is assigned-hospice coverage, not patient harm. Cohorts can contain the same hospice across dates and are not independent random populations. Exact counts and denominators should be read with each graph. Historical severity method files, where retained under methods, describe earlier experiments; they do not define the current CMS-classified views.

## Repository and reproducible build

Download the repository ZIP, extract it, and open index.html, or use the public dashboard link. The page bundles its libraries and derived data; regulatory references open online.

```text
python build.py
python build.py --check
python -m http.server 8000
```

The standard-library build recreates index.html and methodology.html from src, data and vendor files. It does not rerun the original workbook audit or qualitative analysis. The manifest records published artifact hashes. Current source-classification and simulation implementation references are under methods; validation records describe their actual scope and release date. GitHub Pages serves main/root with .nojekyll. No original workbook or full corpus is required or included.
