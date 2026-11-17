// 선수 몸무게 (체형용): Wikidata 몸무게 (P2067, kg 로 정규화) → 시즌 파일 선수마다 weight
//  - 대상: data/canonical/players.json 의 모든 선수 (게임 번호 → Wikidata 항목)
//  - 받아 온 값은 data/meta/player-weights.json { "<선수 번호>": 72 } 에 모아 두고 (다시 받지 않게), --apply 면 시즌 파일에 넣는다
//  - 45 ~ 115kg 밖의 값은 버린다 (단위 실수 · 어릴 때 값). Wikidata 에 없는 선수는 게임이 몸싸움 능력치로 체형을 정한다
//  - 키는 이미 build 단계가 P2048 로 넣는다. 공개 데이터 (publish) 는 선수 항목을 그대로 복사하므로 weight 도 함께 나간다
//  node tools/data_pipeline weights [--apply] [--refresh]
const fs = require('fs');
const path = require('path');
const { DATA } = require('../config');
const { readJson, writeJsonIfChanged } = require('../lib/util');
const { sparql } = require('../providers/wikidata');

const qid = (uri) => uri?.split('/').pop();
const OK = (kg) => kg >= 45 && kg <= 115;

async function fetchWeights(qids, log) {
  const out = {};
  for (let i = 0; i < qids.length; i += 300) {
    const chunk = qids.slice(i, i + 300);
    // 정규화 값 (psn) 은 kg. 값이 여럿이면 가장 최근 (시점 P585) 값을 쓴다
    const rows = await sparql(`
      SELECT ?p ?kg ?when WHERE {
        VALUES ?p { ${chunk.map((q) => `wd:${q}`).join(' ')} }
        ?p p:P2067 ?st . ?st psn:P2067/wikibase:quantityAmount ?kg .
        OPTIONAL { ?st pq:P585 ?when }
      }`);
    const best = {};
    for (const r of rows) {
      const q = qid(r.p.value), kg = Math.round(Number(r.kg.value));
      if (!OK(kg)) continue;
      const when = r.when?.value ?? '';
      if (!best[q] || when > best[q].when) best[q] = { kg, when };
    }
    for (const [q, v] of Object.entries(best)) out[q] = v.kg;
    if ((i / 300) % 10 === 0) log(`  ${Math.min(i + 300, qids.length)} / ${qids.length} 확인 · 몸무게 ${Object.keys(out).length}명`);
  }
  return out;
}

async function weights({ apply, refresh, log }) {
  log(`\n■ 선수 몸무게 (${apply ? '적용' : '미리보기'})`);
  const players = readJson(path.join(DATA, 'canonical', 'players.json'));
  const cacheFile = path.join(DATA, 'meta', 'player-weights.json');
  const cache = !refresh && fs.existsSync(cacheFile) ? readJson(cacheFile) : null;
  let byId;
  if (cache) {
    byId = cache;
    log(`  저장해 둔 값 사용 (${Object.keys(byId).length}명) · 다시 받으려면 --refresh`);
  } else {
    const idOf = new Map();
    for (const [id, m] of Object.entries(players)) if (m?.wikidata && /^Q\d+$/.test(m.wikidata)) idOf.set(m.wikidata, id);
    const kgOf = await fetchWeights([...idOf.keys()], log);
    byId = {};
    for (const [q, kg] of Object.entries(kgOf)) byId[idOf.get(q)] = kg;
    writeJsonIfChanged(cacheFile, byId);   // 미리보기도 저장 (다시 받지 않게)
    log(`  Wikidata 항목이 있는 선수 ${idOf.size}명 중 몸무게 ${Object.keys(byId).length}명 (${((Object.keys(byId).length / Math.max(1, idOf.size)) * 100).toFixed(0)}%)`);
  }

  // 시즌 파일: 그 시즌에 뛴 선수 중 몸무게가 있는 비율
  const SEASONS = path.join(DATA, 'seasons');
  let files = 0, rows = 0, hit = 0, changed = 0, bad = 0;
  const recent = { rows: 0, hit: 0 };
  for (const s of fs.readdirSync(SEASONS).sort()) for (const l of fs.readdirSync(path.join(SEASONS, s))) {
    const dir = path.join(SEASONS, s, l);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && x !== '_league.json')) {
      const file = path.join(dir, f);
      const j = readJson(file);
      let dirty = false;
      for (const p of j.squad ?? []) {
        rows++;
        if (s >= '2020-21') recent.rows++;
        // 키와 맞지 않는 값 (BMI 18.5 ~ 28.5 밖) 은 버린다: Wikidata 값이 어릴 때 · 잘못 넣은 값인 경우
        let kg = byId[p.id] ?? null;
        if (kg && p.height) { const bmi = kg / (p.height / 100) ** 2; if (bmi < 18.5 || bmi > 28.5) { kg = null; bad++; } }
        if (kg) { hit++; if (s >= '2020-21') recent.hit++; }
        if ((p.weight ?? null) !== kg) { p.weight = kg; dirty = true; }
      }
      files++;
      if (dirty && apply) { writeJsonIfChanged(file, j); changed++; }
    }
  }
  log(`  시즌 파일 ${files}개 · 선수 칸 ${rows}개 중 몸무게 ${hit}개 (${((hit / Math.max(1, rows)) * 100).toFixed(0)}%) · 2020-21 이후 ${((recent.hit / Math.max(1, recent.rows)) * 100).toFixed(0)}% · 키와 안 맞아 버린 칸 ${bad}개`);
  const sample = Object.entries(byId).slice(0, 6).map(([id, kg]) => `${id} ${kg}kg`).join(' · ');
  if (sample) log(`  예시 ${sample}`);
  if (apply) {
    log(`  저장: data/meta/player-weights.json · 시즌 파일 ${changed}개 갱신`);
  }
  return byId;
}

module.exports = { weights };
