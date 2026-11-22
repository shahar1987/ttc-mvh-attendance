// Copied from shahar1987/ttc-uniform-sizes (match.js, blob 0c78aaaf18e47b148599f8ace9402dc5edbff4d2).
// scripts/uniform_sheet.mjs used to download this file on every run and execute it next to the service account;
// a local copy removes that. When the dashboard's matching changes, copy the new file here (and check the diff).
// The only edit: the niqqud and geresh ranges are written as \u escapes so they survive copy and paste.
// Name matching for the uniform form: parents type freely, the coach list is fixed.
// Plain script (no modules) so the page and a node self-check can both load it.
(function (root) {
  const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  const norm = s => String(s || '')
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '')            // niqqud
    .replace(/[׳'"`״.\-_]/g, '')                // geresh, quotes, dots, dashes
    .replace(/[ךםןףץ]/g, c => FINAL[c])
    .toLowerCase().replace(/\s+/g, ' ').trim();

  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const sim = (a, b) => (!a || !b) ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length);
  const tight = s => s.replace(/\s/g, '');

  // Nicknames that look nothing like the formal name. Written already normalised.
  const NICK = [
    ['יבגני', 'זניה', 'גניה', 'זיניה', 'יבגיני', 'evgeni', 'zhenya'],
    ['דניאל', 'דני', 'דנאל'],
    ['אלעזר', 'לעזר', 'אלי'],
    ['ישראל', 'איסי', 'סרוליק', 'ישי'],
    ['אנדרי', 'אנדריי', 'אנדרו', 'אנדרה'],
    ['לאוניד', 'ליאוניד', 'לוניה', 'ליוניה', 'לניה'],
    ['תאו', 'טאו', 'תיאו', 'טיאו'],
  ];
  function firstSim(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (NICK.some(g => g.includes(a) && g.includes(b))) return 1;
    const s = sim(a, b);
    if (Math.min(a.length, b.length) >= 2 && (a.startsWith(b) || b.startsWith(a))) return Math.max(s, 0.9);
    return s;
  }
  const lastSim = (a, b) => Math.max(sim(a, b), sim(tight(a), tight(b)));

  function score(first, last, rosterName) {
    const parts = norm(rosterName).split(' ');
    const rf = parts[0], rl = parts.slice(1).join(' ');
    const tf = norm(first), tl = norm(last);
    const pair = (f, l) => { const ls = lastSim(l, rl); return ls < 0.75 ? 0 : 0.6 * ls + 0.4 * firstSim(f, rf); };
    const whole = sim(tight(tf + tl), tight(rf + rl));                // full name typed in one field
    return Math.max(pair(tf, tl), pair(tl, tf), whole >= 0.85 ? whole * 0.95 : 0);
  }

  // Returns {name, score, suggestion}. name is set only when the best match is clear.
  function matchName(first, last, roster) {
    const ranked = roster.map(r => ({ name: r.name, s: score(first, last, r.name) })).sort((a, b) => b.s - a.s);
    const best = ranked[0] || { s: 0 }, second = ranked[1] || { s: 0 };
    const clear = best.s >= 0.8 && (best.s - second.s >= 0.1 || second.s < 0.8);
    return { name: clear ? best.name : '', score: best.s, suggestion: best.s >= 0.55 ? best.name : '' };
  }

  root.UniformMatch = { norm, matchName, score };
  if (typeof module !== 'undefined') module.exports = root.UniformMatch;
})(typeof window !== 'undefined' ? window : globalThis);
