# Upstream method references

These are the original computational method implementations, preserved for inspection. They use paths and inputs from the separate study workspace. The workbook, full narrative corpus, metadata audit, phrase cache, and complete upstream dependencies are not included here; do not interpret these as a standalone source-data pipeline.

`analyze_phase3.py` defines the 64 phrase features, prefix handling, feature calculations, and TF-IDF/cosine. `build_hospice_network.py` aggregates hospice incidence and supporting indicators. `severity_core.py` defines lexical families, context rules, score bands, and PPMI; `build_severity.py` applies that model and assembles derived data. `wording_communities.py` implements the independent community calculation. The JavaScript actually used by the published dashboard, including current filtering and PPMI/pruning, is in `src/dashboard.js`.

To rebuild the included dashboard snapshot, use `python build.py` at the repository root. All required derived dashboard inputs are in `data/`. `phrase_aliases.csv` documents the general vocabulary; `reference_positions.json` is a display frame and adds no analytical evidence.
