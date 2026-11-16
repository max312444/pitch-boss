// 내 데이터 (이 기기 브라우저에만 저장, 어디로도 전송하지 않음): 바꾼 이름 (선수 · 구단 · 감독) · 직접 넣은 사진
//  - main.tsx 가 게임보다 먼저 bootCustom() 으로 읽어 둔다 → db.ts 의 이름 함수 · 사진 훅이 바로 쓴다
//  - 사진은 넣을 때 칸 비율(5:6)로 잘라 줄인 JPEG 로 저장 (시즌 지정 없으면 모든 시즌에)
//  - 형식 · 일괄 넣기(CSV · 여러 사진) · 한 파일로 옮기기(.pitchboss)는 customIO.ts

export type NameKind = 'players' | 'clubs' | 'managers';
export interface CustomName { name: string; short?: string }
export type CustomNames = Record<NameKind, Record<string, CustomName>>;
export interface DevicePhoto { key: string; blob: Blob; url: string }

const DB = 'pitchboss-custom';
const KV = 'kv', PHOTOS = 'photos';

export const custom: { names: CustomNames; photos: Map<string, DevicePhoto>; folder: Set<string>; ok: boolean } = {
  names: { players: {}, clubs: {}, managers: {} }, photos: new Map(), folder: new Set(), ok: false,
};
/** PC 사진 폴더(data/photos)에서 넣은 사진 키 (따로 빼기용, 직접 넣은 사진과 구분) */
const FOLDER = 'folderKeys';
const listeners = new Set<() => void>();
/** 이름 · 사진이 바뀌면 (화면 다시 그리기) */
export const onCustomChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const changed = () => listeners.forEach((l) => l());

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(KV); req.result.createObjectStore(PHOTOS); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
const done = (t: IDBTransaction) => new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
const ask = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** 게임 시작 전에 읽기 */
export async function bootCustom() {
  try {
    const db = await open();
    const s = db.transaction([KV, PHOTOS]);
    const names = (await ask(s.objectStore(KV).get('names'))) as CustomNames | undefined;
    const folder = (await ask(s.objectStore(KV).get(FOLDER))) as string[] | undefined;
    const [keys, vals] = await Promise.all([ask(s.objectStore(PHOTOS).getAllKeys()), ask(s.objectStore(PHOTOS).getAll())]);
    db.close();
    if (names) custom.names = { players: names.players ?? {}, clubs: names.clubs ?? {}, managers: names.managers ?? {} };
    custom.folder = new Set((folder ?? []).filter((k) => keys.includes(k)));
    keys.forEach((k, i) => { const blob = vals[i] as Blob; custom.photos.set(String(k), { key: String(k), blob, url: URL.createObjectURL(blob) }); });
    custom.ok = true;
  } catch { custom.ok = false; }   // 사생활 보호 모드 등: 내 데이터 없이
}

async function saveNames() {
  const db = await open();
  const t = db.transaction(KV, 'readwrite');
  t.objectStore(KV).put(custom.names, 'names');
  await done(t);
  db.close();
}

/** 이름 바꾸기 (name 이 비면 원래 이름으로) */
export async function setCustomName(kind: NameKind, id: string, v: CustomName | null) {
  const name = v?.name.trim();
  if (!name) delete custom.names[kind][id];
  else custom.names[kind][id] = { name, ...(v?.short?.trim() ? { short: v.short.trim() } : {}) };
  await saveNames();
  changed();
}
/** 여러 개 한꺼번에 (CSV 올리기 · 파일 가져오기) */
export async function setCustomNames(list: { kind: NameKind; id: string; name: string; short?: string }[]) {
  for (const x of list) {
    if (!x.name.trim()) continue;
    custom.names[x.kind][x.id] = { name: x.name.trim(), ...(x.short?.trim() ? { short: x.short.trim() } : {}) };
  }
  await saveNames();
  changed();
}

export const customName = (kind: NameKind, id: string): CustomName | undefined => custom.names[kind][id];

/** 이 선수 · 시즌의 기기 사진 (시즌 사진 → 모든 시즌 사진) */
export const devicePhoto = (id: string, season: string) => custom.photos.get(`${id}|${season}`) ?? custom.photos.get(id) ?? null;

/** 사진 저장 (season 없으면 모든 시즌) */
export async function putDevicePhoto(id: string, season: string | null, blob: Blob) {
  const key = season ? `${id}|${season}` : id;
  const db = await open();
  const t = db.transaction([PHOTOS, KV], 'readwrite');
  t.objectStore(PHOTOS).put(blob, key);
  if (custom.folder.delete(key)) t.objectStore(KV).put([...custom.folder], FOLDER);
  await done(t);
  db.close();
  const old = custom.photos.get(key);
  if (old) URL.revokeObjectURL(old.url);
  custom.photos.set(key, { key, blob, url: URL.createObjectURL(blob) });
  changed();
}
/** 사진 여러 장 한꺼번에 저장 (key = 'id' 또는 'id|시즌') */
export async function putDevicePhotos(list: { key: string; blob: Blob; folder?: boolean }[]) {
  if (!list.length) return;
  for (const x of list) { if (x.folder) custom.folder.add(x.key); else custom.folder.delete(x.key); }
  const db = await open();
  const t = db.transaction([PHOTOS, KV], 'readwrite');
  for (const { key, blob } of list) t.objectStore(PHOTOS).put(blob, key);
  t.objectStore(KV).put([...custom.folder], FOLDER);
  await done(t);
  db.close();
  for (const { key, blob } of list) {
    const old = custom.photos.get(key);
    if (old) URL.revokeObjectURL(old.url);
    custom.photos.set(key, { key, blob, url: URL.createObjectURL(blob) });
  }
  changed();
}
export async function removeDevicePhoto(key: string) {
  const db = await open();
  const t = db.transaction([PHOTOS, KV], 'readwrite');
  t.objectStore(PHOTOS).delete(key);
  if (custom.folder.delete(key)) t.objectStore(KV).put([...custom.folder], FOLDER);
  await done(t);
  db.close();
  const old = custom.photos.get(key);
  if (old) URL.revokeObjectURL(old.url);
  custom.photos.delete(key);
  changed();
}

/** PC 사진 폴더에서 넣은 사진만 빼기 (직접 넣은 사진 · 이름은 그대로). 뺀 장 수 */
export async function removeFolderPhotos(): Promise<number> {
  const keys = [...custom.folder];
  const db = await open();
  const t = db.transaction([PHOTOS, KV], 'readwrite');
  for (const k of keys) t.objectStore(PHOTOS).delete(k);
  t.objectStore(KV).delete(FOLDER);
  await done(t);
  db.close();
  for (const k of keys) { const p = custom.photos.get(k); if (p) URL.revokeObjectURL(p.url); custom.photos.delete(k); }
  custom.folder.clear();
  changed();
  return keys.length;
}

/** 내 데이터 모두 지우기 */
export async function clearCustom() {
  const db = await open();
  const t = db.transaction([KV, PHOTOS], 'readwrite');
  t.objectStore(KV).clear();
  t.objectStore(PHOTOS).clear();
  await done(t);
  db.close();
  for (const p of custom.photos.values()) URL.revokeObjectURL(p.url);
  custom.photos.clear();
  custom.folder.clear();
  custom.names = { players: {}, clubs: {}, managers: {} };
  changed();
}

export const customStats = () => ({
  players: Object.keys(custom.names.players).length, clubs: Object.keys(custom.names.clubs).length,
  managers: Object.keys(custom.names.managers).length, photos: custom.photos.size, folderPhotos: custom.folder.size,
});

/** 그림 파일 → 칸 비율(가로 5 : 세로 6)로 잘라 줄인 JPEG. crop 이 없으면 가운데 · 위쪽 기준 (얼굴이 보통 위에) */
export async function bakePhoto(file: Blob, crop?: { x: number; y: number; w: number }): Promise<Blob> {
  const img = await createImageBitmap(file);
  const W = 300, H = 360;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  let sx: number, sy: number, sw: number, sh: number;
  if (crop) { sw = crop.w * img.width; sh = sw * (H / W); sx = crop.x * img.width; sy = crop.y * img.height; }
  else {
    const r = Math.max(W / img.width, H / img.height);
    sw = W / r; sh = H / r;
    sx = (img.width - sw) / 2; sy = Math.max(0, (img.height - sh) * 0.15);
  }
  g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  img.close?.();
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('사진을 만들지 못했습니다'))), 'image/jpeg', 0.86));
}
