// 리그 정리 (새 리그 build 뒤, dedupe 다음에): 동명이인 오연결 · 생년월일 차이
//  (1) 시즌 시작 나이 15 미만 · 45 초과, 또는 id 출생연도 ≠ birth (다른 리그 기록 없음) → 그 항목 삭제
//  (2) 같은 id 의 생년월일이 다른 리그 기록과 다르면 다른 리그(먼저 있던) 기록에 맞춘다
//  사용: node tools/data_pipeline fix-league --league eng2 [--apply]  → 그다음 unify-names --apply · validate
const fs = require('fs'), path = require('path');
const { removePlayers } = require('./dedupe');
const { SEASONS_DIR } = require('../config');
function fixLeague({ league: LG, apply: APPLY = false, log = console.log }) {
if (!LG) throw new Error('사용법: fix-league --league <리그> [--apply]');
const D = SEASONS_DIR;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const files = [];
for (const s of fs.readdirSync(D).sort()) for (const l of fs.readdirSync(path.join(D, s))) for (const f of fs.readdirSync(path.join(D, s, l))) {
  if (f[0] === '_' || !f.endsWith('.json')) continue; const p = path.join(D, s, l, f); files.push({ p, s, l, raw: fs.readFileSync(p, 'utf8') });
}
const ref = new Map();
for (const x of files) if (x.l !== LG) for (const pl of JSON.parse(x.raw).squad) if (!ref.has(pl.id)) ref.set(pl.id, pl.birth);
let del = 0, fixB = 0, changed = 0, rewrote = 0; const dels = [];
for (const x of files) {
  if (x.l !== LG) continue;
  const j = JSON.parse(x.raw); const start = new Date(+x.s.slice(0, 4) + '-08-01');
  const keep = []; const gone = new Set(); const rebirth = new Map();
  for (const pl of j.squad) {
    const age = (start - new Date(pl.birth)) / 31557600000;
    const idYear = +((pl.id.match(/-(\d{4})(?:-\d+)?$/) || [])[1] || 0);
    const refB = ref.get(pl.id);
    const birthOk = refB ? true : (!idYear || idYear === +pl.birth.slice(0, 4));
    if (age < 15 || age > 45 || !birthOk) { del++; gone.add(pl.id); dels.push(`${x.s}/${x.l}/${path.basename(x.p)} ${pl.id} ${pl.birth}`); continue; }
    if (refB && refB !== pl.birth) { rebirth.set(pl.id, refB); pl.birth = refB; fixB++; }
    keep.push(pl);
  }
  if (!gone.size && !rebirth.size) continue;
  changed++;
  if (!APPLY) continue;
  let txt = gone.size ? removePlayers(x.raw, gone) : x.raw;
  for (const [id, b] of rebirth) txt = txt.replace(new RegExp(`("id": "${esc(id)}"[^\\n]*?"birth": ")[^"]+`), `$1${b}`);
  let good = false;
  try { const jj = JSON.parse(txt); good = jj.squad.length === keep.length && jj.squad.every((q, i) => q.id === keep[i].id && q.birth === keep[i].birth); } catch {}
  if (!good) { txt = JSON.stringify({ ...j, squad: keep }, null, 2) + '\n'; rewrote++; }
  fs.writeFileSync(x.p, txt);
}
log(`${LG}: 삭제 ${del} · 생년월일 맞춤 ${fixB} · 파일 ${changed}개${APPLY ? ` (적용 · 다시 쓰기 ${rewrote})` : ' (미리보기)'}`);
if (dels.length) log(dels.join('\n'));
}

module.exports = { fixLeague };
