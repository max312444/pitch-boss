// 내 데이터 넣고 빼기
//  1) 이름 목록 CSV (엑셀): id,구분,소속,지금 이름,바꿀 이름,짧은 이름 — '바꿀 이름'을 채운 줄만 바뀜
//     내려받을 때 UTF-8 + BOM (엑셀에서 한글이 안 깨짐). 올릴 때 UTF-8 · 엑셀 기본 저장(EUC-KR) 모두 읽음. JSON 도 가능
//  2) 사진 여러 장: 파일 이름 = 선수 id 또는 지금 이름 (+ _시즌, 예: p00000a1_2017-18.jpg). 가운데 · 위쪽 기준으로 잘라 저장
//  3) 내 데이터 파일 (.pitchboss): 바꾼 이름 · 사진 · (원하면) 실명 데이터를 압축 파일 하나로 → 다른 기기(휴대폰)에서 가져오기
import { availableSeasons, clubKo, clubs, devRealEntries, koNames, leagues, loadLeagueSeason, loadManagers, realSource } from './db';
import { bakePhoto, custom, putDevicePhoto, putDevicePhotos, setCustomNames, type CustomNames, type NameKind } from './custom';
import { exportRealEntries, importRealEntries, type PickedFile } from './realStore';
import { parseCsv, SAMPLE_CSV } from './csv';
export { parseCsv, SAMPLE_CSV };

const KO_KIND: Record<string, NameKind> = { 선수: 'players', 구단: 'clubs', 감독: 'managers', player: 'players', players: 'players', club: 'clubs', clubs: 'clubs', manager: 'managers', managers: 'managers' };

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvLine = (xs: string[]) => xs.map(csvCell).join(',');

/** 파일로 내려받기 */
export function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const today = () => new Date().toISOString().slice(0, 10);

export const downloadSample = () => download('pitchboss-이름-예시.csv', new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv' }));

/** 이름 목록 CSV 만들기: 구단 → 선수 (가장 최근 시즌 소속 구단 순) → 감독. 이미 바꾼 이름은 '바꿀 이름'에 채워 둠 */
export async function buildNamesCsv(onProgress?: (msg: string) => void): Promise<string> {
  const rows: string[][] = [['id', '구분', '소속', '지금 이름', '바꿀 이름', '짧은 이름']];
  const mine = (k: NameKind, id: string) => custom.names[k][id];
  // 최근 시즌 소속
  onProgress?.('선수 목록 읽는 중…');
  const clubOf = new Map<string, string>();
  const playerName = new Map<string, string>();
  const tops = leagues.filter((l) => availableSeasons(l.id).length);
  for (const l of tops) {
    const s = availableSeasons(l.id).at(-1)!;
    try { const r = await loadLeagueSeason(s, l.id); for (const c of r.clubs) for (const p of c.squad) { if (!clubOf.has(p.id)) clubOf.set(p.id, c.club); playerName.set(p.id, p.name); } } catch { /* 없는 시즌 */ }
  }
  for (const id of koNames.keys()) if (!playerName.has(id) && !id.startsWith('m')) playerName.set(id, koNames.get(id)!.name);
  // 구단
  for (const c of [...clubs.values()].sort((a, b) => (a.ko ?? a.name).localeCompare(b.ko ?? b.name, 'ko'))) {
    const m = mine('clubs', c.id);
    rows.push([c.id, '구단', '', c.ko ?? c.name, m?.name ?? '', m?.short ?? '']);
  }
  // 선수 (소속 구단 이름 순 → 소속 없음)
  const ids = [...playerName.keys()].sort((a, b) => (clubOf.has(a) ? clubKo(clubOf.get(a)!) : '힣').localeCompare(clubOf.has(b) ? clubKo(clubOf.get(b)!) : '힣', 'ko'));
  for (const id of ids) {
    const m = mine('players', id);
    rows.push([id, '선수', clubOf.has(id) ? clubKo(clubOf.get(id)!) : '', koNames.get(id)?.name ?? playerName.get(id)!, m?.name ?? '', m?.short ?? '']);
  }
  // 감독
  onProgress?.('감독 목록 읽는 중…');
  const md = await loadManagers();
  if (md) {
    const last = Object.keys(md.seasons).sort().at(-1);
    const where = new Map(Object.entries(last ? md.seasons[last] : {}).map(([club, id]) => [id, club]));
    for (const [id, m0] of Object.entries(md.managers)) {
      const m = mine('managers', id);
      rows.push([id, '감독', where.has(id) ? clubKo(where.get(id)!) : '', koNames.get(id)?.name ?? m0.name, m?.name ?? '', m?.short ?? '']);
    }
  }
  return rows.map(csvLine).join('\r\n');
}
export async function downloadNamesCsv(onProgress?: (msg: string) => void) {
  const csv = await buildNamesCsv(onProgress);
  download(`pitchboss-이름목록-${today()}.csv`, new Blob(['﻿' + csv], { type: 'text/csv' }));
}

/** 글자 읽기: UTF-8 (BOM 포함) → 깨지면 EUC-KR (엑셀 기본 'CSV (쉼표로 분리)' 저장) */
async function readText(f: Blob): Promise<string> {
  const buf = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('euc-kr').decode(buf); }
}

/** 이름 파일 올리기 (CSV · JSON) → 바뀐 수 · 건너뛴 줄 */
export async function importNamesFile(f: File): Promise<{ applied: number; skipped: string[] }> {
  const text = await readText(f);
  const list: { kind: NameKind; id: string; name: string; short?: string }[] = [];
  const skipped: string[] = [];
  const kindOf = (id: string, g?: string): NameKind | null => (g && KO_KIND[g.trim()]) || (clubs.has(id) ? 'clubs' : koNames.has(id) || /^p/.test(id) ? 'players' : /^m/.test(id) ? 'managers' : null);
  if (/^\s*[[{]/.test(text)) {
    // JSON: { players: { id: { name, short } }, clubs: {...}, managers: {...} } 또는 [{ id, kind, name, short }]
    const j = JSON.parse(text);
    if (Array.isArray(j)) for (const x of j) { const k = kindOf(String(x.id), x.kind ?? x['구분']); if (k && x.name) list.push({ kind: k, id: String(x.id), name: String(x.name), short: x.short }); }
    else for (const k of ['players', 'clubs', 'managers'] as NameKind[]) for (const [id, v] of Object.entries((j[k] ?? {}) as Record<string, { name: string; short?: string }>)) if (v?.name) list.push({ kind: k, id, name: v.name, short: v.short });
  } else {
    const rows = parseCsv(text);
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const ci = col('id', '번호'), cg = col('구분', 'kind', 'type'), cn = col('바꿀 이름', 'new', 'new name', 'name'), cs = col('짧은 이름', 'short');
    if (ci < 0 || cn < 0) throw new Error("첫 줄에 'id'와 '바꿀 이름' 칸이 있어야 합니다 (이름 목록을 내려받아 고쳐 주세요)");
    rows.slice(1).forEach((r, i) => {
      const id = (r[ci] ?? '').trim(), name = (r[cn] ?? '').trim();
      if (!id || !name) return;
      const k = kindOf(id, cg >= 0 ? r[cg] : undefined);
      if (!k) { skipped.push(`${i + 2}번째 줄 (${id})`); return; }
      list.push({ kind: k, id, name, short: cs >= 0 ? r[cs] : undefined });
    });
  }
  await setCustomNames(list);
  return { applied: list.length, skipped };
}

/** 사진 여러 장: 파일 이름으로 선수 찾기 (id → 지금 이름 · 바꾼 이름, 같은 이름이 여럿이면 건너뜀) */
export async function importPhotoFiles(files: File[], onProgress?: (done: number, total: number) => void): Promise<{ ok: number; skipped: string[] }> {
  const byName = new Map<string, string[]>();
  const add = (n: string | undefined, id: string) => { if (!n) return; const k = n.replace(/\s+/g, ' ').trim(); byName.set(k, [...(byName.get(k) ?? []), id]); };
  for (const [id, v] of koNames) if (!id.startsWith('m')) add(v.name, id);
  for (const [id, v] of Object.entries(custom.names.players)) add(v.name, id);
  let ok = 0; const skipped: string[] = [];
  const imgs = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
  for (let i = 0; i < imgs.length; i++) {
    const f = imgs[i];
    const base = f.name.replace(/\.[^.]+$/, '');
    const m = base.match(/^(.*?)(?:[_ ](\d{4}-\d{2}))?$/)!;
    const key = m[1].trim(), season = m[2] ?? null;
    let id: string | null = koNames.has(key) || custom.names.players[key] ? key : null;
    if (!id) { const c = [...new Set(byName.get(key.replace(/\s+/g, ' ')) ?? [])]; if (c.length === 1) id = c[0]; else { skipped.push(`${f.name} (${c.length ? '같은 이름 여럿' : '선수를 찾지 못함'})`); continue; } }
    try { await putDevicePhoto(id, season, await bakePhoto(f)); ok++; } catch { skipped.push(`${f.name} (그림을 읽지 못함)`); }
    onProgress?.(i + 1, imgs.length);
  }
  return { ok, skipped };
}

// ── PC 사진 폴더 (data/photos: manifest.json + files/) ──────────────
/** 얼굴 위치로 자르기 (게임 사진 칸과 같은 방식: 얼굴이 칸 너비의 약 55%, 칸 높이 45% 쯤) → 원본 기준 비율 */
export function faceCrop(c: { w?: number; h?: number; face?: number[] }, W = 300, H = 360): { x: number; y: number; w: number } | undefined {
  if (!c.face || !c.w || !c.h) return undefined;
  const [fx, fy, fw, fh] = c.face;
  const ar = c.w / c.h;
  const dw = Math.max((0.55 * W) / fw, W, H * ar), dh = dw / ar;
  const cx = (fx + fw / 2) * dw, cy = (fy + fh / 2) * dh;
  const left = Math.min(0, Math.max(W - dw, W / 2 - cx)), top = Math.min(0, Math.max(H - dh, H * 0.45 - cy));
  return { x: -left / dw, y: -top / dh, w: W / dw };
}

type PhotoManifest = { players: Record<string, { seasons: Record<string, string> }>; files: Record<string, { w?: number; h?: number; face?: number[]; ext?: string }> };
const pathOf = (it: PickedFile) => (it instanceof File ? it.webkitRelativePath || it.name : it.path).replace(/\\/g, '/');
const isManifest = (p: string) => /(^|\/)manifest\.json$/.test(p);
const isPhotosManifest = (p: string) => /(^|\/)photos\/manifest\.json$/.test(p);

/** 고른 파일 목록에 사진 폴더(manifest.json + files/)가 있는지 */
export function hasPhotoFolder(list: FileList | PickedFile[]) {
  return (Array.from(list) as PickedFile[]).some((it) => isManifest(pathOf(it)) && (it instanceof File ? it : it.file).size > 0);
}

/** PC 사진 폴더(data/photos 또는 data)를 골라 이 기기에 넣기. 게임과 같게 '그 시즌 사진'만 (선수|시즌) */
export async function importPhotoFolder(list: FileList | PickedFile[], onProgress?: (done: number, total: number) => void): Promise<{ ok: number; missing: number }> {
  const items = (Array.from(list) as PickedFile[]).map((it) => ({ file: it instanceof File ? it : it.file, path: pathOf(it) }));
  const mf = items.filter((x) => isManifest(x.path)).sort((a, b) => +isPhotosManifest(b.path) - +isPhotosManifest(a.path))[0];
  // files 폴더만 골랐으면 목록(manifest.json)이 없다 → 개발 서버에서 받아 오기
  const m = mf ? (JSON.parse(await mf.file.text()) as PhotoManifest)
    : import.meta.env.PROD ? null : await fetch('/photos/manifest.json', { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<PhotoManifest>) : null)).catch(() => null);
  if (!m?.players || !m.files || !Object.keys(m.files).length) throw new Error("사진 목록(manifest.json)을 찾지 못했습니다. files 말고 그 위의 'photos' 폴더를 골라 주세요 (manifest.json 과 files 폴더가 함께 있는 곳).");
  // 사진 파일: 고른 폴더 안 files/ 아래 (files 폴더 자체를 골랐으면 그 안)
  const byKey = new Map<string, File>();
  for (const x of items) {
    const p = x.path.split('/');
    if (p.length >= 2 && p[p.length - 2] === 'files' && /\.(jpe?g|png|webp)$/i.test(p[p.length - 1])) byKey.set(p[p.length - 1].replace(/\.[^.]+$/, ''), x.file);
  }
  if (!byKey.size) throw new Error("사진 파일을 찾지 못했습니다. 'photos' 폴더(또는 그 안의 files 폴더)를 골라 주세요.");
  const jobs: { id: string; season: string; key: string }[] = [];
  for (const [id, e] of Object.entries(m.players)) for (const [season, key] of Object.entries(e.seasons ?? {})) jobs.push({ id, season, key });
  let missing = 0;
  const out: { key: string; blob: Blob; folder?: boolean }[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i], f = byKey.get(j.key);
    if (!f) { missing++; continue; }
    try { out.push({ key: `${j.id}|${j.season}`, blob: await bakePhoto(f, faceCrop(m.files[j.key] ?? {})), folder: true }); } catch { missing++; }
    if (i % 10 === 0) onProgress?.(i + 1, jobs.length);
  }
  await putDevicePhotos(out);
  return { ok: out.length, missing };
}

// ── 내 데이터 파일 (.pitchboss) ────────────────────────────────
interface Pack { format: 'pitchboss-mydata'; version: 1; date: string; names: CustomNames; photos: { key: string; data?: string; same?: string; folder?: boolean }[]; real?: [string, string][] }

const toB64 = async (b: Blob) => { const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string, type = 'image/jpeg') => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
async function gzip(text: string): Promise<Blob> {
  const blob = new Blob([text]);
  if (typeof CompressionStream === 'undefined') return blob;
  return await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
}
async function gunzip(f: Blob): Promise<string> {
  const head = new Uint8Array(await f.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('이 브라우저는 압축 파일을 풀 수 없습니다 (최신 브라우저로 열어 주세요)');
    return await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return await f.text();
}

/** 실명 데이터를 함께 넣을 수 있는지 (이 PC data/ 폴더 · 이 브라우저에 넣어 둔 것) */
export const realExportable = () => !!realSource;

/** 내 데이터 파일 만들기 → 내려받기 */
export async function exportPack(withReal: boolean, onProgress?: (msg: string) => void) {
  onProgress?.('사진 묶는 중…');
  const photos: Pack['photos'] = [];
  for (const p of custom.photos.values()) photos.push({ key: p.key, data: await toB64(p.blob), ...(custom.folder.has(p.key) ? { folder: true } : {}) });
  let real: Pack['real'];
  // 개발 서버 PC: 실명과 함께면 PC 사진 폴더(data/photos)의 그 시즌 사진도 (이 기기에 넣은 사진이 먼저)
  if (withReal && realSource === 'folder') {
    const m = await fetch('/photos/manifest.json', { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<PhotoManifest>) : null)).catch(() => null);
    if (m?.players && m.files) {
      const jobs = Object.entries(m.players).flatMap(([id, e]) => Object.entries(e.seasons ?? {}).map(([season, key]) => ({ k: `${id}|${season}`, key })))
        .filter((j) => !custom.photos.has(j.k) && m.files[j.key]);
      // 같은 사진 파일 (실명 번호 · 패러디 번호) 은 한 번만 넣고 나머지는 가리키기
      const first = new Map<string, string>();
      for (let i = 0; i < jobs.length; i++) {
        const { k, key } = jobs[i];
        const prev = first.get(key);
        if (prev) { photos.push({ key: k, same: prev, folder: true }); continue; }
        const b = await fetch(`/photos/files/${key}.${m.files[key].ext ?? 'jpg'}`).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
        if (b) { try { photos.push({ key: k, data: await toB64(await bakePhoto(b, faceCrop(m.files[key]))), folder: true }); first.set(key, k); } catch { /* 건너뜀 */ } }
        if (i % 10 === 0) onProgress?.(`PC 사진 묶는 중… ${i + 1}/${jobs.length}`);
      }
    }
  }
  if (withReal && realSource) {
    onProgress?.('실명 데이터 묶는 중…');
    real = realSource === 'folder' ? await devRealEntries((d, t) => onProgress?.(`실명 데이터 묶는 중… ${Math.round((d / t) * 100)}%`)) : await exportRealEntries();
  }
  onProgress?.('압축하는 중…');
  const pack: Pack = { format: 'pitchboss-mydata', version: 1, date: today(), names: custom.names, photos, ...(real ? { real } : {}) };
  download(`pitchboss-내데이터-${today()}.pitchboss`, await gzip(JSON.stringify(pack)));
}

/** 내 데이터 파일 가져오기: 이름 (합치기) · 사진 · 실명 데이터 (있으면 이 브라우저에 저장) */
export async function importPack(f: File, onProgress?: (msg: string) => void): Promise<{ names: number; photos: number; real: boolean }> {
  onProgress?.('파일 푸는 중…');
  const pack = JSON.parse(await gunzip(f)) as Pack;
  if (pack.format !== 'pitchboss-mydata') throw new Error('PITCH BOSS 내 데이터 파일이 아닙니다');
  const list: { kind: NameKind; id: string; name: string; short?: string }[] = [];
  for (const k of ['players', 'clubs', 'managers'] as NameKind[]) for (const [id, v] of Object.entries(pack.names?.[k] ?? {})) list.push({ kind: k, id, name: v.name, short: v.short });
  await setCustomNames(list);
  onProgress?.('사진 넣는 중…');
  const blobs = new Map<string, Blob>(), out: { key: string; blob: Blob; folder?: boolean }[] = [];
  for (const p of pack.photos ?? []) {
    const blob = p.data ? fromB64(p.data) : p.same ? blobs.get(p.same) : undefined;
    if (!blob) continue;
    blobs.set(p.key, blob); out.push({ key: p.key, blob, folder: !!p.folder });
  }
  await putDevicePhotos(out);
  let real = false;
  if (pack.real?.length) { onProgress?.('실명 데이터 넣는 중…'); await importRealEntries(pack.real); real = true; }
  return { names: list.length, photos: pack.photos?.length ?? 0, real };
}
