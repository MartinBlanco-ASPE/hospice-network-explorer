/* Two-layer dashboard core: decoding and aggregation only (no DOM). Shared by the page and by tests/test_core.js.
   Every view is computed from the per-citation columns, so all numbers respond to the same filter state. */
function createCitationSankeyCore(DATA) {
  'use strict';
  const HIGH = 1, FRAMED = 2, IDG = 4;
  const toBytes = s => {
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  const studies = {};
  for (const [key, raw] of Object.entries(DATA.studies)) {
    const S = {
      key, name: raw.name, n: raw.n, families: raw.families, care: raw.care, failures: raw.failures,
      levels: raw.levels, years: raw.years, tags: raw.tags, nAgency: raw.n_agency, nSurvey: raw.n_survey, flagged: raw.flagged, source: raw.source
    };
    for (const [col, bits] of [['fam', 8], ['car', 8], ['fai', 8], ['tag', 16], ['lev', 8], ['yr', 8], ['agy', 16], ['srv', 16], ['flg', 8]]) {
      const bytes = toBytes(raw.cols[col]);
      S[col] = bits === 16 ? new Uint16Array(bytes.buffer) : bytes;
      if (S[col].length !== S.n) throw new Error(`column ${col} has ${S[col].length} values, expected ${S.n}`);
    }
    S.uncertain = S.care.indexOf('uncertain_idg');
    S.idg = S.care.indexOf('hospice_idg_services');
    S.home = S.families.map(f => S.care.map(c => (DATA.home[f] || []).includes(c)));
    S.thread = ['PLAN', 'ORDERS', 'DELIVER'].map(f => S.families.indexOf(f)).filter(i => i >= 0);
    studies[key] = S;
  }

  function blankState(study) {
    return { study, mode: 'separate', years: new Set(), levels: new Set(), highOnly: false, excludeFramed: false,
             families: new Set(), care: new Set(), failures: new Set(), issues: new Set(), tags: new Set() };
  }
  // Care area as displayed: in Separate mode a flagged citation moves to the "care area uncertain" category.
  const shown = (S, st, i) => (st.mode === 'separate' && (S.flg[i] & IDG)) ? S.uncertain : S.car[i];
  const pairKey = (f, c) => f * 256 + c;

  // Row indices passing every filter except the dimensions a view owns. hidden = flagged rows removed by Hide mode.
  function rows(st, except = []) {
    const S = studies[st.study], ex = new Set(except), out = [];
    const useY = st.years.size > 0, useL = st.levels.size > 0;
    const useF = st.families.size > 0 && !ex.has('families'), useC = st.care.size > 0 && !ex.has('care');
    const useX = st.failures.size > 0 && !ex.has('failures'), useI = st.issues.size > 0 && !ex.has('issues');
    const useT = st.tags.size > 0 && !ex.has('tags');
    let hidden = 0;
    for (let i = 0; i < S.n; i++) {
      const fl = S.flg[i];
      if (st.highOnly && !(fl & HIGH)) continue;
      if (st.excludeFramed && (fl & FRAMED)) continue;
      if (useY && !st.years.has(S.yr[i])) continue;
      if (useL && !st.levels.has(S.lev[i])) continue;
      if (useF && !st.families.has(S.fam[i])) continue;
      if (useT && !st.tags.has(S.tag[i])) continue;
      if (useX && !st.failures.has(S.fai[i])) continue;
      if (useC || useI) {
        const c = shown(S, st, i);
        if (useC && !st.care.has(c)) continue;
        if (useI && !st.issues.has(pairKey(S.fai[i], c))) continue;
      }
      if (st.mode === 'hide' && (fl & IDG)) { hidden++; continue; }
      out.push(i);
    }
    out.hidden = hidden;
    return out;
  }

  // Smallest number of categories (largest first) whose running total reaches 80% of n; same rule as build_dataset.py.
  function cover80(values, n) {
    const v = [...values].filter(x => x > 0).sort((a, b) => b - a);
    let cum = 0;
    for (let k = 0; k < v.length; k++) { cum += v[k]; if (cum >= 0.8 * n) return k + 1; }
    return v.length;
  }

  function summary(st) {
    const S = studies[st.study], idx = rows(st), n = idx.length;
    const ag = new Uint8Array(S.nAgency), sv = new Uint8Array(S.nSurvey), tg = new Uint8Array(S.tags.length), fm = new Uint8Array(S.families.length);
    const pairs = new Map(), careCount = new Map();
    let agencies = 0, surveys = 0, tags = 0, families = 0, on = 0, flagged = 0;
    for (const i of idx) {
      if (!ag[S.agy[i]]) { ag[S.agy[i]] = 1; agencies++; }
      if (!sv[S.srv[i]]) { sv[S.srv[i]] = 1; surveys++; }
      if (!tg[S.tag[i]]) { tg[S.tag[i]] = 1; tags++; }
      if (!fm[S.fam[i]]) { fm[S.fam[i]] = 1; families++; }
      const c = shown(S, st, i), k = pairKey(S.fai[i], c);
      pairs.set(k, (pairs.get(k) || 0) + 1);
      careCount.set(c, (careCount.get(c) || 0) + 1);
      if (S.home[S.fam[i]][c]) on++;
      if (S.flg[i] & IDG) flagged++;
    }
    return { n, agencies, surveys, tags, families, issues: pairs.size, k80: n ? cover80(pairs.values(), n) : 0,
             onSubject: n ? on / n : 0, flagged, hidden: idx.hidden, pairs, careCount, idx };
  }

  function distinctAgencies(st, idx, test) {
    const S = studies[st.study], seen = new Uint8Array(S.nAgency);
    let k = 0;
    for (const i of idx) if (test(i) && !seen[S.agy[i]]) { seen[S.agy[i]] = 1; k++; }
    return k;
  }

  // A. Heatmap: family x displayed care area, ignoring the family and care-area selections (they are highlighted).
  function matrix(st) {
    const S = studies[st.study], idx = rows(st, ['families', 'care']);
    const m = S.families.map(() => new Float64Array(S.care.length)), rowT = new Float64Array(S.families.length), colT = new Float64Array(S.care.length);
    for (const i of idx) { const f = S.fam[i], c = shown(S, st, i); m[f][c]++; rowT[f]++; colT[c]++; }
    return { m, rowT, colT, n: idx.length, idx };
  }

  // B. Pipeline: families in scope -> displayed care areas -> issues (failure type within each care area).
  //    Care areas under 1% of the citations shown are grouped; the fewest issues that together cover 80% of the
  //    citations shown are drawn individually, and everything else flows to "remaining issues". Flows are conserved.
  function pipeline(st, scope) {
    const S = studies[st.study], idx = rows(st, ['care', 'failures', 'issues']);
    let fams = st.families.size ? [...st.families] : (scope === 'all' ? S.families.map((_, i) => i) : S.thread);
    fams = [...new Set(fams)].sort((a, b) => a - b);
    const inScope = new Uint8Array(S.families.length);
    for (const f of fams) inScope[f] = 1;
    const famT = new Float64Array(S.families.length), careT = new Map(), famCare = new Map(), issue = new Map(), fcx = new Map();
    let total = 0;
    for (const i of idx) {
      const f = S.fam[i];
      if (!inScope[f]) continue;
      const c = shown(S, st, i), fc = pairKey(f, c), k = pairKey(S.fai[i], c), t = f * 65536 + c * 256 + S.fai[i];
      famT[f]++; total++;
      careT.set(c, (careT.get(c) || 0) + 1);
      famCare.set(fc, (famCare.get(fc) || 0) + 1);
      issue.set(k, (issue.get(k) || 0) + 1);
      fcx.set(t, (fcx.get(t) || 0) + 1);
    }
    const kept = [...careT].filter(([, v]) => v >= 0.01 * total).map(([c]) => c), keptSet = new Set(kept);
    const ranked = [...issue].map(([key, v]) => ({ key, f: Math.floor(key / 256), c: key % 256, v })).sort((a, b) => b.v - a.v || a.key - b.key);
    let cum = 0, k80 = 0;
    ranked.forEach((it, j) => { it.rank = j + 1; cum += it.v; it.cum = total ? cum / total : 0; if (!k80 && cum >= 0.8 * total) k80 = j + 1; });
    if (total && !k80) k80 = ranked.length;
    const drawn = ranked.slice(0, k80).filter(it => keptSet.has(it.c)), inDrawn = new Map();
    for (const it of drawn) inDrawn.set(it.c, (inDrawn.get(it.c) || 0) + it.v);
    const remainder = new Map(kept.map(c => [c, careT.get(c) - (inDrawn.get(c) || 0)]));
    let smallCare = 0;
    for (const [c, v] of careT) if (!keptSet.has(c)) smallCare += v;
    return { fams: fams.filter(f => famT[f] > 0), total, famT, careT, famCare, fcx, kept, drawn, remainder, smallCare, k80, nIssues: ranked.length,
             remaining: total - drawn.reduce((a, it) => a + it.v, 0), idx };
  }

  // B. Sankey: families in scope -> displayed care areas; links under 1% of the Sankey's total merge per family
  //    into one "smaller links" node (spec 6.3).
  function flows(st, scope) {
    const S = studies[st.study], idx = rows(st, ['care']);
    let fams = st.families.size ? [...st.families] : (scope === 'all' ? S.families.map((_, i) => i) : S.thread);
    fams = [...new Set(fams)].sort((a, b) => a - b);
    const inScope = new Uint8Array(S.families.length);
    for (const f of fams) inScope[f] = 1;
    const link = new Map(), famT = new Float64Array(S.families.length);
    let total = 0;
    const kept = [], merged = new Map();
    const scoped = [];
    for (const i of idx) {
      const f = S.fam[i];
      if (!inScope[f]) continue;
      const k = pairKey(f, shown(S, st, i));
      link.set(k, (link.get(k) || 0) + 1);
      famT[f]++; total++; scoped.push(i);
    }
    for (const [k, v] of link) {
      const f = Math.floor(k / 256), c = k % 256;
      if (v >= 0.01 * total) kept.push({ f, c, v });
      else merged.set(f, (merged.get(f) || 0) + v);
    }
    kept.sort((a, b) => a.f - b.f || a.c - b.c);
    return { fams: fams.filter(f => famT[f] > 0), kept, merged, total, famT, links: link.size, idx: scoped };
  }

  // C. Ranked issues (failure type x care area) or care areas, ignoring failure, care and issue selections.
  function ranking(st, mode) {
    const S = studies[st.study], idx = rows(st, ['failures', 'care', 'issues']), cnt = new Map();
    for (const i of idx) {
      const c = shown(S, st, i), k = mode === 'care' ? c : pairKey(S.fai[i], c);
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    const items = [...cnt].map(([key, v]) => mode === 'care' ? { key, c: key, v } : { key, f: Math.floor(key / 256), c: key % 256, v })
      .sort((a, b) => b.v - a.v || a.key - b.key);
    let cum = 0, k80 = 0;
    items.forEach((it, j) => { cum += it.v; it.cum = idx.length ? cum / idx.length : 0; if (!k80 && cum >= 0.8 * idx.length) k80 = j + 1; });
    return { items, n: idx.length, k80: idx.length ? (k80 || items.length) : 0 };
  }

  // D. Icicle tree: family -> displayed care area -> failure type, ignoring those three selections.
  function tree(st) {
    const S = studies[st.study], idx = rows(st, ['families', 'care', 'failures']);
    const root = { key: -1, depth: 0, v: 0, children: new Map() };
    for (const i of idx) {
      const f = S.fam[i], c = shown(S, st, i), x = S.fai[i];
      root.v++;
      let a = root.children.get(f); if (!a) root.children.set(f, a = { key: f, depth: 1, v: 0, children: new Map() }); a.v++;
      let b = a.children.get(c); if (!b) a.children.set(c, b = { key: c, depth: 2, v: 0, children: new Map() }); b.v++;
      let d = b.children.get(x); if (!d) b.children.set(x, d = { key: x, depth: 3, v: 0 }); d.v++;
    }
    return root;
  }

  // E. Tags in the selection, ignoring the tag selection.
  function tagTable(st) {
    const S = studies[st.study], idx = rows(st, ['tags']), cnt = new Float64Array(S.tags.length), ags = S.tags.map(() => null);
    for (const i of idx) { const t = S.tag[i]; cnt[t]++; (ags[t] || (ags[t] = new Set())).add(S.agy[i]); }
    return S.tags.map((t, k) => ({ k, tag: t.tag, title: t.title, level: t.level, family: t.family, v: cnt[k], agencies: ags[k] ? ags[k].size : 0,
                                   pct: idx.length ? cnt[k] / idx.length : 0 }))
      .filter(r => r.v > 0).sort((a, b) => b.v - a.v || (a.tag < b.tag ? -1 : 1));
  }

  return { studies, blankState, rows, summary, matrix, pipeline, flows, ranking, tree, tagTable, distinctAgencies, cover80, shown, pairKey, flags: { HIGH, FRAMED, IDG } };
}
if (typeof module !== 'undefined') module.exports = { createCitationSankeyCore };
