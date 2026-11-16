// 나라별 대표팀 색 (엠블럼): Wikidata 대표팀 공식 색 (P6364) → 없으면 국기 색 (국가 P163 국기 → P462 색) · 색의 #코드 (P465)
//  → data/meta/nation-colors.json { "KOR": ["#c60c30", "#003478"] }  (사실 정보라 publish 가 공개 데이터에도 그대로 복사)
//  두 색 고르기: 흰색 · 검정이 아닌 가장 진한 색을 주색, 주색과 가장 대비가 큰 색을 보조색 (흰색 · 검정 포함)
//  node tools/data_pipeline natcolors [--apply]
const path = require('path');
const { DATA } = require('../config');
const { readJson, writeJsonIfChanged } = require('../lib/util');
const { getJson } = require('../lib/http');
const { sparql } = require('../providers/wikidata');

const API = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2';
const qid = (uri) => uri?.split('/').pop();

async function titlesToQids(pairs) {
  const out = {};
  for (let i = 0; i < pairs.length; i += 50) {
    const chunk = pairs.slice(i, i + 50);
    const j = await getJson('wikipedia', `${API}&action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(chunk.map(([, t]) => t).join('|'))}`);
    const red = new Map((j.query?.redirects ?? []).map((r) => [r.to, r.from]));
    const norm = new Map((j.query?.normalized ?? []).map((r) => [r.to, r.from]));
    for (const pg of j.query?.pages ?? []) {
      const q = pg.pageprops?.wikibase_item;
      if (!q) continue;
      const from = red.get(pg.title) ?? pg.title;
      const asked = norm.get(from) ?? from;
      for (const [code, t] of chunk) if ((t === asked || t === from || t === pg.title) && !out[code]) out[code] = q;
    }
  }
  return out;
}

const rgb = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (hex) => { const c = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const sat = (hex) => { const [r, g, b] = rgb(hex); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
/** 원색 (#0000ff 같은 색 이름 값) 을 국기 · 유니폼처럼 차분하게: 채도 ≤ 0.75, 밝기 0.32 ~ 0.52 (흰색 · 검정 · 아주 밝은 노랑은 그대로에 가깝게) */
function tone(hex) {
  let [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2, d = mx - mn;
  if (d < 0.08) return hex;   // 흰색 · 회색 · 검정
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360;
  const s0 = d / (1 - Math.abs(2 * l0 - 1));
  const yellow = h > 40 && h < 70;
  const sN = Math.min(s0, yellow ? 0.9 : 0.75), lN = yellow ? Math.min(Math.max(l0, 0.5), 0.55) : Math.min(Math.max(l0, 0.32), 0.52);
  const c = (1 - Math.abs(2 * lN - 1)) * sN, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = lN - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
function pickTwo(hexes) {
  const xs = [...new Set(hexes.map((h) => tone('#' + h.replace('#', '').toLowerCase().padStart(6, '0'))))];
  if (!xs.length) return null;
  const vivid = xs.filter((h) => sat(h) > 0.25).sort((a, b) => sat(b) - sat(a));
  const main = vivid[0] ?? xs[0];
  const second = xs.filter((h) => h !== main).sort((a, b) => contrast(main, b) - contrast(main, a))[0] ?? (lum(main) > 0.45 ? '#141414' : '#f4f4f2');
  return [main, second];
}

async function natcolors({ apply, log }) {
  log(`\n■ 나라별 대표팀 색 (${apply ? '적용' : '미리보기'})`);
  const nations = readJson(path.join(DATA, 'meta', 'nations.json')).nations;
  // 대표팀 항목 · 국가 항목
  const team = await titlesToQids(nations.flatMap((n) => [`${n.en} national football team`, `${n.en} men's national football team`, `${n.en} men's national soccer team`].map((t) => [n.code, t])));
  const country = await titlesToQids(nations.flatMap((n) => [`${n.en} (country)`, n.en].map((t) => [n.code, t])));
  const colorsOf = async (map, prop) => {
    const byQ = new Map(Object.entries(map).map(([c, q]) => [q, c]));
    const out = {};
    const qs = [...byQ.keys()];
    for (let i = 0; i < qs.length; i += 80) {
      const rows = await sparql(`SELECT ?x ?hex WHERE { VALUES ?x { ${qs.slice(i, i + 80).map((q) => `wd:${q}`).join(' ')} } ${prop} ?col. ?col wdt:P465 ?hex. }`);
      for (const r of rows) { const c = byQ.get(qid(r.x.value)); if (c) (out[c] ??= []).push(r.hex.value); }
    }
    return out;
  };
  const teamCols = await colorsOf(team, '?x wdt:P6364');
  const flagCols = await colorsOf(country, '?x wdt:P163 ?flag. ?flag wdt:P462');
  const out = {};
  let fromTeam = 0, fromFlag = 0;
  for (const n of nations) {
    const two = pickTwo(teamCols[n.code] ?? []) ?? pickTwo(flagCols[n.code] ?? []);
    if (!two) continue;
    out[n.code] = two;
    if (teamCols[n.code]?.length) fromTeam++; else fromFlag++;
  }
  log(`  ${nations.length}개 나라 중 ${Object.keys(out).length}개 (대표팀 공식 색 ${fromTeam} · 국기 색 ${fromFlag})`);
  log(`  예시 ${['KOR', 'BRA', 'GHA', 'NZL', 'ISL', 'JAM', 'QAT'].map((c) => `${c} ${out[c]?.join(' ') ?? '-'}`).join(' · ')}`);
  if (apply) { writeJsonIfChanged(path.join(DATA, 'meta', 'nation-colors.json'), out); log('  저장: data/meta/nation-colors.json'); }
  return out;
}

module.exports = { natcolors };
