# Hospice Network Explorer

[Open the interactive dashboard](https://MartinBlanco-ASPE.github.io/hospice-network-explorer/) · [Detailed methodology](https://MartinBlanco-ASPE.github.io/hospice-network-explorer/methodology.html)

A browser-based explorer of wording in hospice QCOR survey narratives. The website opens directly to the dashboard. It includes general wording patterns, provisional severity wording, source comparison, and an Issues & policy sunburst with links to federal regulations. The original first-round coding view remains available from that tab. This repository documents descriptive methods, regulatory reference mappings and the dashboard implementation; it contains no policy-effectiveness analysis or policy recommendations.

## What the dashboard shows

Nodes represent selected phrases, with nine additional severity-family diamonds in the severity view. Phrase-node area represents distinct identified hospices with matching wording. Lines describe text relationships, not relationships between providers. The compact summary reports leading phrases or severity families, their strongest partners and the strongest displayed pairs. Source comparison shows each selection's hospice counts and percentages using separate denominators. Compact formulas beside the reading guide explain lift, color grouping and text handling; hover, focus or tap to read their symbol definitions.

## Issues and policy reference map

The sunburst places 17 federal regulatory sections in the inner ring and 96 issue-to-section relationships in the outer ring, covering 64 care-wording features and nine provisional severity families. Each outer slice has equal weight. Issues can appear under several sections, so the 73 unique issues differ from the 96 displayed relationships. Arc size represents mapping counts, not hospice coverage, clinical severity or policy importance.

Click a branch to lock its highlight and information while the other branches become lighter; the whole chart stays visible. Select an issue for its plain-language policy description, exact paragraph links, hospice/record coverage and illustrative source passages. Clear highlight, the center or Escape restores the colors. Search, vocabulary and regulatory-section controls provide explicit filtering; an accessible companion list and CSV export are included. Colors follow the user's rainbow reference, with adaptive label text for contrast.

The links are current regulatory references, not adjudicated source citations or a completed survey-date legal crosswalk. Some provisions have setting-specific scope, and the general immediate-jeopardy definition supplies context for two severity families. Historical applicability and independent semantic validation remain pending. This is a descriptive reference map; it does not assess policy effectiveness or establish policy gaps.

Community colors identify exploratory wording clusters fitted to the displayed connections. They are different from the predefined severity families and are not validated study themes. Severity share, source Immediate Jeopardy (IJ), and condition-level association are separate indicators. Advanced controls retain TF-IDF, hospice-incidence connections, text-processing sensitivities, and earlier community colors.

## Data and analytical scope

The source is a hospice QCOR workbook covering October 2021 through September 2026. The initial care-analysis corpus contains 67,594 candidate records and 6,486 case-normalized assigned CCNs. Earlier source artifacts contain 6,487 raw CCN keys; the derived dashboard merges a case-only key variant. The 1,211 Pending-identity records contribute to record-based analysis but not identified-hospice counts. Seventy uncertain records and separately scoped emergency-preparedness/life-safety material are outside the initial analysis. Survey-purpose and surveying-organization differences remain explicit; this is hospice-only work.

The repository includes derived dashboard data and the illustrative narrative excerpts already used by the explorer. The original workbook, full narrative corpus, internal notes, policy reports, and policy-synthesis materials are not included. The derived snapshot supports the published filters and interactions; it does not allow reconstruction of all original narratives.

## Text processing and phrase selection

The vocabulary consists of 64 deliberately selected care/organizational phrase features with documented aliases, rather than automatically discovered themes. Matching is counted once per record for phrase presence. The default evidence-oriented text removes introductory material preceding an explicit standard/condition-not-met statement when one is found. Other quoted requirements and templates can remain. Untrimmed text is available in Advanced. Exact normalized-text deduplication keeps the first matching text before filtering and can therefore remove another hospice's identical wording; it is not semantic deduplication.

## How connections are calculated

The general view uses unweighted positive pointwise mutual information (PPMI). Let N be the number of selected records, nA and nB the numbers mentioning each phrase, and nAB the number mentioning both. Then:

```text
lift(A, B) = (nAB / N) / ((nA / N) * (nB / N))
PPMI(A, B) = max(0, log2(lift(A, B)))
```

The default keeps lift at least 1.5, using the exact log2(1.5) cutoff. Phrase pairs require at least 25 shared records; links involving a severity-family node require at least 10. Vocabulary and support/strength cutoffs are applied before retaining the union of each endpoint's four strongest candidate links. The full-corpus general preset displays 64 nodes and 172 connections; the severity preset displays 73 nodes and 209 connections. Filtered/custom views recompute their displayed graph.

The severity view uses the same PPMI structure with record weight 1 + provisional record-severity score. Each marginal and joint share uses weighted sums divided by the total record weight; shared-record support remains unweighted. Lift is an above-baseline association measure, not a significance test or a direct measure of clinical severity.

Advanced TF-IDF connections use cosine similarity between phrase features after frequency/rarity weighting. Hospice-incidence cosine uses binary phrase-presence vectors over identified hospices, allowing phrases to appear in different records or surveys. The separate pilot graph uses sample-fitted TF-IDF cosine between narratives. Cosine equals the vector dot product divided by the product of vector lengths.

## Calendar year filtering

The Calendar year checkbox dropdown sits directly below Node color, outside Advanced. Select one year, multiple years together (for example 2025 and 2026), or All years. The graph, hospice coverage, repeat appearances and exports use the selected years, combined with the surveyor, survey context, text-handling and severity filters. Both source-comparison selections use the same year set. Resetting the view or clearing the last specific year restores All years. The 2021 and 2026 endpoints are partial years. Repeated wording across survey dates does not establish new failures or recurrence rates.

## Edge workbook and report traceability

The Network graph tab's Export edges button downloads an Excel workbook with three sheets: Edges, CCN and year, and Export settings. Edges retains the visible graph's weights, support counts and filter metadata and adds an edge_id. CCN and year lists each supporting workbook record once, with assigned CCN, survey-end date/year, source Excel row, source document and derived survey-group identifiers, tag, surveyor, context, matched features and semicolon-separated supported_edge_ids. Use those IDs to join the reports to Edges. CCNs are explicit text cells, preserving leading zeros; blank identifiers are labeled Pending identity rather than inferred.

For record-based connections, a supporting record contains both endpoint topics. For same-hospice incidence connections, both topics occur at the CCN somewhere in the selected data; they may occur in different records or survey dates. The supporting sheet lists relevant endpoint records and labels that distinction. Pilot-similarity exports list the endpoint narratives. Exports honor current year, surveyor/context, text and severity settings, including saved comparison selections and the global exact-text sensitivity. Edges CSV remains available for the original single-sheet format. The workbook is generated locally in the browser without a server request or external spreadsheet library.

## Provisional severity scoring

Nine predefined, policy-informed lexical families identify Abuse; Neglect; Sexual/assault; Exploitation/theft/diversion; Restraint/seclusion; Injury; Harm; Elopement/overdose; and Grievance. Policy informs category selection; the numerical weights are research choices. This page describes measurement rather than conducting policy analysis.

Mention score is family tier (3, 2, or 1) multiplied by a rule-based context multiplier: negated or IJ wording 0; requirement/paperwork 0.25; risk 0.5; reporting/protection failure 0.75; event/allegation 1; unresolved context 0.5. A record receives its maximum mention score, not the sum. High is at least 2, Moderate at least 1 but below 2, Low above 0 but below 1, and None zero. No match is not evidence of no harm.

Severity share is the proportion of matching identified hospices with at least one High-scored matching record. A record's score can come from another passage in that record. Lexicon matching, context labeling, and the High cutoff remain provisional. Source IJ and condition-level classifications are not replaced by this score.

## Communities, size, and comparisons

Wording clusters use deterministic weighted greedy modularity, with resolution 1 by default. Groups are fitted to the displayed graph; group numbers and hues can change with filters, sources, and settings. Diamond shape identifies a severity family even when community colors are selected. Group colors do not convert ordinary phrases into severity terms.

Node area follows distinct-hospice count with a minimum visible radius. Ordinary views rescale sizes within the view. Source comparison saves two selections, switches a single map between them, and uses a common hospice-size reference, fixed 73-node full-corpus reference positions, and common camera bounds. The same hospice can appear in both source groups. Matching hues do not establish matching groups, and screen distance adds no analytical evidence.

## Reading coverage and validation

Full-corpus phrase matching is separate from close reading. AI-assisted reading/coding decisions cover 96 selected narratives; the original coding view contains the first 48. Independent human validation and final reconciliation remain pending. There is no claim of thematic saturation, clinical validation, causal effects, national prevalence, or representative provider-quality comparisons.

Computational checks reproduce current communities in independent Python and JavaScript implementations. For each baseline, 81 settings vary lift, support, strongest-neighbor count, and modularity resolution; ten additional seeded checks perturb edge weights by ±5%. The general baseline has six groups and median construction adjusted Rand agreement 0.663; the severity baseline has seven groups and median agreement 0.643. Sensitivity describes algorithmic behavior, not validated meaning. The published snapshot passed 76 source-dashboard browser checks, 53 sunburst/policy checks and 27 targeted year-filter checks; publication-specific checks verify the packaged dashboard, methods links, A/B counts, and mobile layout. Check the files in `validation/` for the exact tested artifact and results.

## How this was built

Upstream Python scripts reconstructed and audited source records, computed phrase features, prepared TF-IDF/hospice-incidence and severity data, and assembled the original offline HTML. Browser JavaScript recomputes filters, associations, groups, node sizes, and summaries from the derived data. The interface uses HTML/CSS, canvas, and bundled vis-network 9.1.9. It needs no server-side processing, API key, account, or live third-party script request to explore the included snapshot.

This repository separates the publication source into `src/page.html`, `src/dashboard.js`, `data/*.json`, and `vendor/vis-network-9.1.9.min.js`. `build.py` embeds those files into the self-contained `index.html` and generates this README's browser companion. Rebuilding the dashboard from its derived snapshot requires only Python 3:

```text
python build.py
python -m http.server 8000
```

Open http://localhost:8000/ or open `index.html` directly. `python build.py --check` verifies the committed build and hashes without rewriting it. Upstream analysis implementations are included under `methods/` as method references; their original workbook/corpus dependencies are intentionally absent, so the upstream analysis cannot be rerun from this snapshot alone. No files are downloaded by the build.

## Repository contents and publishing

- `index.html`: the dashboard and GitHub Pages entry point.
- `methodology.html` and `README.md`: descriptive methodology and implementation guide.
- `src/`, `data/`, `vendor/`, and `build.py`: reproducible dashboard snapshot build.
- `methods/`: upstream phrase, severity, and community algorithms; phrase aliases and saved display-reference positions.
- `validation/`: computational assessment and browser-check records with artifact hashes.
- `THIRD_PARTY_NOTICES.md`: bundled library attribution and license.

GitHub Pages serves the root of the `main` branch with Jekyll disabled by `.nojekyll`. The published site consists of the dashboard and related methods/build files. To update it, replace the derived snapshot and source intentionally, rebuild, validate, and commit. The original study workspace and policy-analysis folders remain separate.
