// 나라별 대표 선수 풀 (월드컵 모드 소집 후보): Wikidata 의 "○○ 국가대표팀 소속" 기록 (P54 + 기간 P580/P582 · 출전 P1350 · 골 P1351)
//  → data/worldcups/pools.json { "KOR": [ { name, birth, from, to, caps, goals, pos, id?, wc?, qid } ] }
//    id = 게임에 이미 있는 선수 (Wikidata 번호 → data/canonical/players.json), 없으면 wc 번호 (squads.json 과 같은 규칙 → 같은 사람이 이어짐)
//    1998년 이후에도 대표였던 선수만 (게임 시즌 2000/01 ~)
//  → data/locale/ko/wcplayers.json 에 게임에 없는 선수의 한국어 이름을 더한다 (Wikidata ko 이름표)
//  대표팀 항목: 영어 위키백과 "{나라} national football team" (· men's · soccer 표기) → Wikidata 번호
//  node tools/data_pipeline natpool [--apply] [--nation KOR]
const path = require('path');
const { DATA, CANONICAL_DIR } = require('../config');
const { readJson, writeJsonIfChanged, normName } = require('../lib/util');
const { getJson } = require('../lib/http');
const { sparql } = require('../providers/wikidata');

const API = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2';
const qid = (uri) => uri?.split('/').pop();
const year = (v) => (v ? +v.value.slice(0, 4) : null);
const posOf = (label) => {
  const l = (label || '').toLowerCase();
  if (/goalkeeper/.test(l)) return 'GK';
  if (/defender|back|sweeper|libero/.test(l)) return 'DF';
  if (/midfield|playmaker/.test(l)) return 'MF';
  if (/forward|striker|winger|attack/.test(l)) return 'FW';
  return null;
};
const wcId = (name, birth) => `wc-${normName(name).replace(/ /g, '-')}-${birth?.slice(0, 4) ?? 'x'}`;

/** 나라 → 대표팀 Wikidata 번호 (위키백과 문서 이름 몇 가지로) */
async function teamQids(nations, log) {
  const variants = (en) => [`${en} national football team`, `${en} men's national football team`, `${en} men's national soccer team`, `${en} national soccer team`];
  const titles = nations.flatMap((n) => variants(n.en).map((t) => [n.code, t]));
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const j = await getJson('wikipedia', `${API}&action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(chunk.map(([, t]) => t).join('|'))}`);
    const red = new Map((j.query?.redirects ?? []).map((r) => [r.to, r.from]));
    const norm = new Map((j.query?.normalized ?? []).map((r) => [r.to, r.from]));
    for (const pg of j.query?.pages ?? []) {
      const q = pg.pageprops?.wikibase_item;
      if (!q) continue;
      const from = red.get(pg.title) ?? pg.title;
      const asked = norm.get(from) ?? from;
      const hit = chunk.find(([, t]) => t === asked || t === from || t === pg.title);
      if (hit && !out[hit[0]]) out[hit[0]] = q;
    }
  }
  log(`  대표팀 항목: ${Object.keys(out).length} / ${nations.length}개 나라`);
  return out;
}

async function natpool({ apply, nation, log }) {
  log(`\n■ 나라별 대표 선수 풀 (${apply ? '적용' : '미리보기'})`);
  const nations = readJson(path.join(DATA, 'meta', 'nations.json')).nations.filter((n) => !nation || n.code === nation);
  const teams = await teamQids(nations, log);
  const canon = readJson(path.join(CANONICAL_DIR, 'players.json'));
  const byQid = new Map(Object.entries(canon).filter(([, v]) => v.wikidata && v.status !== 'invalid').map(([id, v]) => [v.wikidata, id]));
  const out = {};
  let total = 0, matched = 0;
  const codes = Object.keys(teams);
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const rows = await sparql(`
      SELECT ?p ?pLabel ?birth ?start ?end ?caps ?goals ?posLabel WHERE {
        ?p p:P54 ?st. ?st ps:P54 wd:${teams[code]}.
        OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
        OPTIONAL { ?st pq:P1350 ?caps } OPTIONAL { ?st pq:P1351 ?goals }
        ?p wdt:P569 ?birth. FILTER(YEAR(?birth) >= 1962)
        OPTIONAL { ?p wdt:P413 ?pos }
        FILTER(!BOUND(?end) || YEAR(?end) >= 1998)
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }`);
    const by = new Map();
    for (const r of rows) {
      const q = qid(r.p.value);
      const name = r.pLabel?.value;
      if (!name || /^Q\d+$/.test(name)) continue;
      const e = by.get(q) ?? { qid: q, name, birth: r.birth.value.slice(0, 10), from: year(r.start), to: year(r.end), caps: 0, goals: 0, pos: null };
      e.caps = Math.max(e.caps, +(r.caps?.value ?? 0)); e.goals = Math.max(e.goals, +(r.goals?.value ?? 0));
      e.pos ??= posOf(r.posLabel?.value);
      if (e.from == null || (year(r.start) ?? 9999) < e.from) e.from = year(r.start) ?? e.from;
      if (r.end && (e.to == null || year(r.end) > e.to)) e.to = year(r.end);
      if (!r.end && r.start && year(r.start) >= (e.from ?? 0)) e.to = null;
      by.set(q, e);
    }
    const list = [...by.values()].map((e) => {
      const id = byQid.get(e.qid);
      // 기간이 없으면 생년으로 짐작 (20 ~ 33세)
      const by0 = +e.birth.slice(0, 4);
      const from = e.from ?? by0 + 20, to = e.to === undefined ? by0 + 33 : e.to;
      return { ...e, from, to, pos: e.pos ?? 'MF', ...(id ? { id } : { wc: wcId(e.name, e.birth) }) };
    }).filter((e) => (e.to == null || e.to >= 1998) && e.from <= 2027);
    out[code] = list;
    total += list.length; matched += list.filter((e) => e.id).length;
    if (i % 20 === 0) log(`  ${i + 1}/${codes.length} ${code}: ${list.length}명`);
  }
  log(`  전체 ${total}명 · 게임 선수와 맞춤 ${matched}명 · 새 선수 ${total - matched}명`);

  // 한국어 이름 (게임에 없는 선수, 이미 있는 이름은 두고 더함)
  const koFile = path.join(DATA, 'locale', 'ko', 'wcplayers.json');
  const koOut = readJson(koFile, {});
  const need = [...new Set(Object.values(out).flat().filter((e) => e.wc && !koOut[e.wc]).map((e) => e.qid))];
  const koBy = new Map();
  for (let i = 0; i < need.length; i += 50) {
    const j = await getJson('wikidataApi', `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=ko&ids=${need.slice(i, i + 50).join('|')}`);
    for (const [q, e] of Object.entries((j.data ?? j).entities ?? {})) { const ko = e.labels?.ko?.value; if (ko) koBy.set(q, ko); }
    if ((i / 50) % 40 === 0) log(`  한국어 이름 ${Math.min(i + 50, need.length)} / ${need.length}`);
  }
  let added = 0;
  for (const e of Object.values(out).flat()) if (e.wc && koBy.has(e.qid) && !koOut[e.wc]) { const ko = koBy.get(e.qid); koOut[e.wc] = { name: ko, short: ko.split(' ').pop() }; added++; }
  log(`  한국어 이름 더함: ${added}명`);
  for (const n of ['KOR', 'JPN', 'ENG']) if (out[n]) {
    const act = out[n].filter((e) => e.from <= 2010 && (e.to == null || e.to >= 2009));
    log(`  예시 ${n} 2009/10 풀 ${act.length}명: ${act.slice(0, 6).map((e) => `${e.name}${e.id ? '' : '*'}`).join(', ')} …`);
  }
  if (apply) {
    writeJsonIfChanged(path.join(DATA, 'worldcups', 'pools.json'), out);
    writeJsonIfChanged(koFile, koOut);
    log('  저장: data/worldcups/pools.json · data/locale/ko/wcplayers.json');
  }
  return out;
}

module.exports = { natpool };
