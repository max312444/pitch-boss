// 월드컵 실제 명단 (2002 ~ 2026): 영어 위키백과 "{연도} FIFA World Cup squads" 문서의 선수 줄
//   {{nat fs player | nat fs g player | National football squad player |no=|pos=|name=[[..]]|age={{birth date and age2|대회일|생일}}|caps=|goals=|club=[[..]]|clubnat=}}
//  → data/worldcups/squads.json { "2002": { "KOR": [ { no, pos, name, birth, caps, goals, club, clubnat, id?, qid? } ] } }
//    id = 게임에 이미 있는 선수 (Wikidata 번호 → data/canonical/players.json, 없으면 그 시즌 이름 + 생년월일)
//    id 가 없는 선수는 게임이 월드컵 때 실명 선수로 만든다 (능력은 리그 수준 · 나이 · A매치로 추정, engine 쪽)
//  → data/locale/ko/wcplayers.json  게임에 없는 선수의 한국어 이름 (Wikidata ko 이름이 있는 선수만, wc 번호 기준)
//  영어 이름만 위키백과에서, 한국어는 Wikidata 이름표 (50명씩) — 토큰 · 요청을 적게
//  node tools/data_pipeline wcsquads [--apply]
const fs = require('fs');
const path = require('path');
const { DATA, SEASONS_DIR, CANONICAL_DIR } = require('../config');
const { readJson, writeJsonIfChanged, normName } = require('../lib/util');
const { getJson } = require('../lib/http');

const API = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2';
const YEARS = [2002, 2006, 2010, 2014, 2018, 2022, 2026];
const ALIAS = {
  'Turkey': 'Türkiye', 'China PR': 'China', 'IR Iran': 'Iran', 'Korea Republic': 'South Korea', 'Ireland': 'Republic of Ireland',
  'Ivory Coast': "Côte d'Ivoire", 'Czech Republic': 'Czechia', 'Serbia and Montenegro': 'Serbia',
  'England': 'England', 'Scotland': 'Scotland', 'Wales': 'Wales', 'Northern Ireland': 'Northern Ireland',
  'United States': 'United States', 'USA': 'United States', 'Korea DPR': 'North Korea', 'DR Congo': 'DR Congo', 'Cape Verde': 'Cape Verde',
};
const PLAYER_RE = /\{\{\s*(?:nat fs (?:g )?player|national football squad player)\s*\|/i;

/** 틀 안의 매개변수 (중첩 {{ }} · [[ ]] 안의 | 는 무시) */
function params(s) {
  const out = {}; let depth = 0, cur = '', parts = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i], two = s.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if (two === '}}' || two === ']]') { depth--; cur += two; i++; continue; }
    if (c === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  for (const p of parts) { const k = p.indexOf('='); if (k > 0) out[p.slice(0, k).trim().toLowerCase()] = p.slice(k + 1).trim(); }
  return out;
}
/** 틀 하나 (여는 {{ 부터 짝이 맞는 }} 까지) */
function templateAt(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') { depth++; i++; } else if (two === '}}') { depth--; i++; if (depth === 0) return text.slice(start + 2, i - 1); }
  }
  return null;
}
const linkTarget = (s) => { const m = s.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/); return m ? { title: m[1].trim(), text: (m[2] ?? m[1]).trim() } : { title: null, text: s.replace(/\{\{.*?\}\}|<[^>]+>/g, '').trim() }; };
function birthOf(age) {
  const nums = (age.match(/\|\s*\d{1,4}(?=\s*[|}])/g) || []).map((x) => +x.replace(/\D/g, ''));
  if (nums.length < 6) return null;
  const [y, m, d] = nums.slice(3, 6);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function wcsquads({ apply, log }) {
  log(`\n■ 월드컵 실제 명단 (${apply ? '적용' : '미리보기'})`);
  const nations = readJson(path.join(DATA, 'meta', 'nations.json')).nations;
  const byName = new Map(nations.map((n) => [n.en.toLowerCase(), n.code]));
  const codes = new Set(nations.map((n) => n.code));
  const codeOf = (name) => byName.get(name.toLowerCase()) ?? byName.get((ALIAS[name] ?? '').toLowerCase()) ?? null;
  const natCode = (s) => { const t = s.replace(/\[\[|\]\]/g, '').trim(); return codes.has(t.toUpperCase()) && t.length === 3 ? t.toUpperCase() : codeOf(t) ?? t; };

  // 게임 선수: Wikidata 번호 → id
  const canon = readJson(path.join(CANONICAL_DIR, 'players.json'));
  const byQid = new Map(Object.entries(canon).filter(([, v]) => v.wikidata && v.status !== 'invalid').map(([id, v]) => [v.wikidata, id]));
  // 예비: 그 대회 직전 시즌의 이름 + 생년월일
  const seasonIndex = (y) => {
    const s = `${y - 1}-${String(y % 100).padStart(2, '0')}`;
    const dir = path.join(SEASONS_DIR, s);
    const m = new Map();
    if (!fs.existsSync(dir)) return m;
    for (const lg of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, lg))) {
      if (f.startsWith('_')) continue;
      for (const p of readJson(path.join(dir, lg, f)).squad || []) if (p.birth) m.set(`${normName(p.name)}|${p.birth}`, p.id);
    }
    return m;
  };

  const out = {};
  const titles = new Set();
  let total = 0;
  for (const y of YEARS) {
    const title = `${y} FIFA World Cup squads`;
    const j = await getJson('wikipedia', `${API}&action=query&prop=revisions&rvprop=ids|content&rvslots=main&rvlimit=1&redirects=1&titles=${encodeURIComponent(title)}`);
    const text = j.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
    if (!text) { log(`  ${y}: 문서 없음`); continue; }
    const cup = {};
    // 나라 제목(===) 위치
    const heads = [...text.matchAll(/^===\s*(.+?)\s*===\s*$/gm)].map((m) => ({ at: m.index, code: codeOf(m[1].replace(/\[\[|\]\]/g, '').trim()) }));
    for (let i = 0; i < text.length;) {
      const k = text.slice(i).search(PLAYER_RE);
      if (k < 0) break;
      const at = i + k;
      const body = templateAt(text, at);
      if (!body) break;
      i = at + body.length + 4;
      const nat = [...heads].reverse().find((h) => h.at < at)?.code;
      if (!nat) continue;
      const p = params(body);
      const nm = linkTarget(p.name || '');
      const club = linkTarget(p.club || '');
      const row = {
        no: +p.no || null, pos: (p.pos || '').toUpperCase().slice(0, 2), name: nm.text.replace(/\s*\(.*?\)\s*$/, '').trim(),
        birth: birthOf(p.age || ''), caps: +p.caps || 0, goals: +p.goals || 0, club: club.text, clubnat: natCode(p.clubnat || ''),
        ...(nm.title ? { wiki: nm.title } : {}),
      };
      if (!row.name) continue;
      (cup[nat] ??= []).push(row);
      if (nm.title) titles.add(nm.title);
      total++;
    }
    out[y] = cup;
    log(`  ${y}: ${Object.keys(cup).length}개 나라 · ${Object.values(cup).flat().length}명`);
  }

  // 위키백과 문서 → Wikidata 번호 (50개씩)
  const qidOf = new Map();
  const tl = [...titles];
  for (let i = 0; i < tl.length; i += 50) {
    const chunk = tl.slice(i, i + 50);
    const j = await getJson('wikipedia', `${API}&action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(chunk.join('|'))}`);
    const red = new Map((j.query?.redirects ?? []).map((r) => [r.to, r.from]));
    const norm = new Map((j.query?.normalized ?? []).map((r) => [r.to, r.from]));
    for (const pg of j.query?.pages ?? []) {
      const q = pg.pageprops?.wikibase_item;
      if (!q) continue;
      let t = pg.title; const from = red.get(t) ?? t;
      qidOf.set(t, q); qidOf.set(from, q); qidOf.set(norm.get(from) ?? from, q);
    }
    if ((i / 50) % 20 === 0) log(`  Wikidata 번호 ${Math.min(i + 50, tl.length)} / ${tl.length}`);
  }

  // 게임 선수와 맞추기
  let matched = 0, byNameBirth = 0;
  const newQ = new Set();
  for (const y of Object.keys(out)) {
    const idx = seasonIndex(+y);
    for (const rows of Object.values(out[y])) for (const r of rows) {
      const q = r.wiki ? qidOf.get(r.wiki) : null;
      if (q) r.qid = q;
      const id = (q && byQid.get(q)) || (r.birth && idx.get(`${normName(r.name)}|${r.birth}`));
      if (id) { r.id = id; matched++; if (!(q && byQid.get(q))) byNameBirth++; } else if (q) newQ.add(q);
      delete r.wiki;
    }
  }
  log(`  전체 ${total}명 · 게임 선수와 맞춤 ${matched}명 (이름+생일 ${byNameBirth}) · 새로 만들 선수 ${total - matched}명`);

  // 게임에 없는 선수의 한국어 이름 (Wikidata ko 이름표)
  const koOut = {};
  const ql = [...newQ];
  const koByQ = new Map();
  for (let i = 0; i < ql.length; i += 50) {
    const chunk = ql.slice(i, i + 50);
    const j = await getJson('wikidataApi', `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=ko&ids=${chunk.join('|')}`);
    for (const [q, e] of Object.entries((j.data ?? j).entities ?? {})) { const ko = e.labels?.ko?.value; if (ko) koByQ.set(q, ko); }
    if ((i / 50) % 20 === 0) log(`  한국어 이름 ${Math.min(i + 50, ql.length)} / ${ql.length}`);
  }
  const wcId = (r) => `wc-${normName(r.name).replace(/ /g, '-')}-${r.birth?.slice(0, 4) ?? 'x'}`;
  for (const y of Object.keys(out)) for (const rows of Object.values(out[y])) for (const r of rows) {
    if (r.id) continue;
    r.wc = wcId(r);
    const ko = r.qid && koByQ.get(r.qid);
    if (ko) koOut[r.wc] = { name: ko, short: ko.split(' ').pop() };
  }
  log(`  한국어 이름: 새 선수 ${Object.keys(koOut).length}명`);
  // 예시
  for (const [y, n] of [['2002', 'KOR'], ['2022', 'KOR'], ['2026', 'ARG']]) {
    const rows = out[y]?.[n] ?? [];
    log(`  예시 ${y} ${n}: ${rows.slice(0, 5).map((r) => `${r.name}${r.id ? '' : '*'}`).join(', ')} … (* = 새로 만들 선수)`);
  }
  if (apply) {
    writeJsonIfChanged(path.join(DATA, 'worldcups', 'squads.json'), out);
    writeJsonIfChanged(path.join(DATA, 'locale', 'ko', 'wcplayers.json'), koOut);
    log('  저장: data/worldcups/squads.json · data/locale/ko/wcplayers.json');
  }
  return { out, koOut };
}

module.exports = { wcsquads };
