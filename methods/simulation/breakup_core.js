/* Break-apart (network dismantling) engine — reviewer diagnostic, Claude, Nov 6 2026.
   Deletion only: removed nodes and their links disappear; nothing replaces them.
   Measures: pieces (connected components), largest piece as a share of ALL original nodes, and Borgatti's (2006)
   fragmentation F = 1 - sum_c s_c (s_c - 1) / (n (n - 1)) over the n remaining nodes.
   Optimal sets: for each size k the set is searched separately (exhaustively for k <= 3; greedy start + swap local
   search with restarts above, after Borgatti's KPP-Neg heuristic), so the best set for k can differ from k - 1.
   Works in the browser (window.Breakup) and in node (module.exports). Nodes are wording features, not actors. */
(function (root) {
  'use strict';

  function adjacency(ids, edges) {
    const adj = new Map(ids.map(i => [i, []]));
    for (const e of edges) if (adj.has(e.a) && adj.has(e.b)) { adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
    return adj;
  }

  function pieces(adj, ids, removed) {
    const seen = new Set(removed), comps = [];
    for (const s of ids) {
      if (seen.has(s)) continue;
      const q = [s]; seen.add(s);
      for (let i = 0; i < q.length; i++) for (const u of adj.get(q[i])) if (!seen.has(u)) { seen.add(u); q.push(u); }
      comps.push(q);
    }
    comps.sort((x, y) => (y.length - x.length) || (Math.min(...x) - Math.min(...y)));
    return comps;
  }

  function stats(adj, ids, removed, special) {
    const R = removed instanceof Set ? removed : new Set(removed);
    const comps = pieces(adj, ids, R), n = ids.length - R.size;
    const ss = comps.reduce((s, c) => s + c.length * (c.length - 1), 0);
    const main = new Set(comps.length ? comps[0] : []), S = special || new Set();
    let attached = 0, alone = 0;
    for (const d of S) { if (main.has(d)) attached++; if (!R.has(d) && adj.get(d).every(u => R.has(u))) alone++; }
    return {
      comps, pieces: comps.length, remaining: n,
      F: n > 1 ? 1 - ss / (n * (n - 1)) : 1,
      lcc: comps.length ? comps[0].length : 0,
      lccShare: comps.length ? comps[0].length / ids.length : 0,
      isolated: comps.filter(c => c.length === 1).map(c => c[0]),
      // main network rule for the severity pages: the largest piece counts only if it holds more than half of the remaining nodes
      majority: comps.length > 0 && 2 * comps[0].length > n,
      attached, cutOff: S.size - attached, diamondsAlone: alone
    };
  }

  // Objective comparison: is score a better than score b?
  const EPS = 1e-12;
  function better(obj, a, b) {
    if (!b) return true;
    if (obj === 'fragmentation') {
      if (a.F > b.F + EPS) return true; if (a.F < b.F - EPS) return false;
      if (a.lcc !== b.lcc) return a.lcc < b.lcc;
    } else if (obj === 'diamonds') {   // cut every diamond off the main piece, keeping the main piece large
      if (a.attached !== b.attached) return a.attached < b.attached;
      if (a.lcc !== b.lcc) return a.lcc > b.lcc;
      if (a.F < b.F - EPS) return true; if (a.F > b.F + EPS) return false;
    } else {                      // 'largest': shrink the largest piece; tie-break on fragmentation
      if (a.lcc !== b.lcc) return a.lcc < b.lcc;
      if (a.F > b.F + EPS) return true; if (a.F < b.F - EPS) return false;
    }
    return a.key < b.key;          // deterministic final tie-break
  }
  let SPECIAL = new Set();
  function score(adj, ids, set) {
    const s = stats(adj, ids, set, SPECIAL);
    // 'diamonds' objective: a removal set with no main network (no piece above half) is treated as worse than any valid one
    return { F: s.F, lcc: s.lcc, attached: s.majority ? s.attached : SPECIAL.size + 1, key: [...set].sort((x, y) => x - y).join(',') };
  }

  function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffled(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function exhaustive(adj, ids, k, obj, pool) {
    pool = pool || ids;
    let best = null, bestSet = null; const n = pool.length, idx = [...Array(k).keys()];
    if (k === 0) return { set: [], score: score(adj, ids, new Set()) };
    for (;;) {
      const set = new Set(idx.map(i => pool[i])), s = score(adj, ids, set);
      if (better(obj, s, best)) { best = s; bestSet = [...set]; }
      let p = k - 1; while (p >= 0 && idx[p] === n - k + p) p--;
      if (p < 0) break;
      idx[p]++; for (let q = p + 1; q < k; q++) idx[q] = idx[q - 1] + 1;
    }
    return { set: bestSet, score: best };
  }

  function localSearch(adj, ids, start, obj, rnd, pool) {
    pool = pool || ids;
    const cur = new Set(start); let best = score(adj, ids, cur), guard = 0;
    for (let improved = true; improved && guard < 500; guard++) {
      improved = false;
      const ins = shuffled([...cur], rnd), outs = shuffled(pool.filter(i => !cur.has(i)), rnd);
      outer: for (const u of ins) for (const v of outs) {
        cur.delete(u); cur.add(v);
        const s = score(adj, ids, cur);
        if (better(obj, s, best)) { best = s; improved = true; break outer; }
        cur.delete(v); cur.add(u);
      }
    }
    return { set: [...cur], score: best };
  }

  // Best set for every size 1..kmax under one objective.
  function optimalSets(ids, edges, kmax, obj, opts) {
    const o = Object.assign({ exactUpTo: 3, restarts: 12, seed: 20261106, seeds: {}, removable: null, special: null }, opts || {});
    const pool = o.removable || ids; SPECIAL = new Set(o.special || []);
    const adj = adjacency(ids, edges), rnd = mulberry32(o.seed), out = [{ k: 0, set: [], exact: true, ...score(adj, ids, new Set()) }];
    for (let k = 1; k <= kmax; k++) {
      let res;
      if (k <= o.exactUpTo) res = exhaustive(adj, ids, k, obj, pool);
      else {
        const starts = [];
        const prev = out[k - 1].set;                                  // greedy extension of the best (k-1) set
        let bestAdd = null, bestAddScore = null;
        for (const v of pool) if (!prev.includes(v)) { const s = score(adj, ids, new Set([...prev, v])); if (better(obj, s, bestAddScore)) { bestAddScore = s; bestAdd = v; } }
        starts.push([...prev, bestAdd]);
        for (const name of Object.keys(o.seeds)) starts.push(o.seeds[name].slice(0, k));   // e.g. adaptive attack prefixes
        for (let r = 0; r < o.restarts; r++) starts.push(shuffled(pool, rnd).slice(0, k));
        res = null;
        for (const st of starts) { const ls = localSearch(adj, ids, st, obj, rnd, pool); if (!res || better(obj, ls.score, res.score)) res = ls; }
      }
      out.push({ k, set: res.set.slice().sort((x, y) => x - y), exact: k <= o.exactUpTo, F: res.score.F, lcc: res.score.lcc, attached: res.score.attached });
    }
    SPECIAL = new Set();
    return out;
  }

  // Brandes betweenness on the remaining graph.
  function betweenness(adj, ids, removed) {
    const alive = ids.filter(i => !removed.has(i)), C = new Map(alive.map(i => [i, 0]));
    for (const s of alive) {
      const S = [], P = new Map(alive.map(i => [i, []])), sigma = new Map(alive.map(i => [i, 0])), d = new Map(alive.map(i => [i, -1]));
      sigma.set(s, 1); d.set(s, 0); const Q = [s];
      for (let qi = 0; qi < Q.length; qi++) {
        const v = Q[qi]; S.push(v);
        for (const w of adj.get(v)) { if (removed.has(w)) continue;
          if (d.get(w) < 0) { Q.push(w); d.set(w, d.get(v) + 1); }
          if (d.get(w) === d.get(v) + 1) { sigma.set(w, sigma.get(w) + sigma.get(v)); P.get(w).push(v); } }
      }
      const delta = new Map(alive.map(i => [i, 0]));
      while (S.length) { const w = S.pop(); for (const v of P.get(w)) delta.set(v, delta.get(v) + sigma.get(v) / sigma.get(w) * (1 + delta.get(w))); if (w !== s) C.set(w, C.get(w) + delta.get(w)); }
    }
    return C;
  }

  // Attack orders. Adaptive versions recompute the score on the remaining graph after every removal.
  function attackOrder(name, nodes, edges, kmax, opts) {
    const o = opts || {}, ids = nodes.map(n => n.id), adj = adjacency(ids, edges), byId = new Map(nodes.map(n => [n.id, n]));
    const pool = o.removable || ids, inPool = new Set(pool), S = new Set(o.special || []);
    const tie = (x, y) => (byId.get(y).records - byId.get(x).records) || byId.get(x).label.localeCompare(byId.get(y).label);
    const degIn = (v, R) => adj.get(v).filter(u => !R.has(u)).length;
    if (name === 'static_degree') return pool.slice().sort((x, y) => (degIn(y, new Set()) - degIn(x, new Set())) || tie(x, y)).slice(0, kmax);
    if (name === 'records') return pool.slice().sort(tie).slice(0, kmax);
    const order = [], R = new Set();
    const toSpecial = v => adj.get(v).filter(u => S.has(u) && !R.has(u)).length;
    for (let k = 0; k < Math.min(kmax, pool.length); k++) {
      const alive = pool.filter(i => !R.has(i));
      let pick;
      if (name === 'adaptive_degree') pick = alive.slice().sort((x, y) => (degIn(y, R) - degIn(x, R)) || tie(x, y))[0];
      else if (name === 'adaptive_betweenness') { const b = betweenness(adj, ids, R); pick = alive.slice().sort((x, y) => (b.get(y) - b.get(x)) || (degIn(y, R) - degIn(x, R)) || tie(x, y))[0]; }
      else if (name === 'special_links') {   // phrase with the most links to diamonds still attached, re-scored after each removal
        const st = stats(adj, ids, R, S), main = new Set(st.comps.length ? st.comps[0] : []);
        const att = v => adj.get(v).filter(u => S.has(u) && main.has(u)).length;
        pick = alive.slice().sort((x, y) => (att(y) - att(x)) || (toSpecial(y) - toSpecial(x)) || (degIn(y, R) - degIn(x, R)) || tie(x, y))[0];
      }
      order.push(pick); R.add(pick);
    }
    return order;
  }

  const api = { adjacency, pieces, stats, optimalSets, attackOrder, betweenness, mulberry32, shuffled };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Breakup = api;
})(typeof window !== 'undefined' ? window : this);
