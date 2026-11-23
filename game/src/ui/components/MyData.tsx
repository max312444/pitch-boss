// 데이터베이스 → 내 데이터: 이름 바꾸기 (CSV) · 사진 여러 장 · 다른 기기로 옮기기 (.pitchboss) · 지우기
//  모두 이 기기 브라우저에만 저장 (custom.ts), 어디로도 보내지 않음
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clearCustom, customStats, removeFolderPhotos } from '../../data/custom';
import { downloadNamesCsv, downloadSample, exportPack, importNamesFile, importPack, importPhotoFiles, importPhotoFolder, realExportable, SAMPLE_CSV } from '../../data/customIO';
import { setDataset } from '../../data/db';

const Code = ({ children }: { children: ReactNode }) => <code className="rounded bg-ink-800 px-1 py-0.5 text-[11px] text-mid">{children}</code>;
const Btn = ({ children, onClick, primary, disabled }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled} className={`h-9 rounded-lg px-3 text-[12px] font-semibold disabled:opacity-50 ${primary ? 'bg-neon text-ink-950 hover:bg-[#5bff3d]' : 'bg-ink-700 text-hi hover:bg-ink-750'}`}>{children}</button>
);

export function MyData() {
  const [st, setSt] = useState(customStats());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [withReal, setWithReal] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null), photoRef = useRef<HTMLInputElement>(null), packRef = useRef<HTMLInputElement>(null), dirRef = useRef<HTMLInputElement>(null);
  useEffect(() => { dirRef.current?.setAttribute('webkitdirectory', ''); }, []);
  const run = async (job: () => Promise<string>) => {
    setMsg(null);
    try { setMsg({ t: await job() }); } catch (e) { setMsg({ t: (e as Error).message || '실패했습니다', bad: true }); }
    setBusy(null); setSt(customStats());
  };
  const skippedText = (xs: string[]) => (xs.length ? ` · 건너뜀 ${xs.length}개 (${xs.slice(0, 3).join(', ')}${xs.length > 3 ? ' …' : ''})` : '');

  return (
    <section>
      <div className="text-[15px] font-semibold">내 데이터 (이름 · 사진)</div>
      <div className="mt-0.5 text-[12px] text-lo">
        바꾼 이름 선수 {st.players} · 구단 {st.clubs} · 감독 {st.managers} · 넣은 사진 {st.photos}장 — 이 브라우저에만 저장 (어디로도 보내지 않음)
      </div>

      {/* 1. 이름 */}
      <div className="mt-3 rounded-lg bg-ink-900 px-4 py-3 text-[12px] leading-relaxed text-mid">
        <div className="font-semibold text-hi">1. 이름 바꾸기 (엑셀 CSV)</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-lo">
          <li><b className="text-mid">한 명씩</b>: 선수 정보 · 구단 창 · 감독 이름 옆 <b className="text-mid">✎</b></li>
          <li><b className="text-mid">한꺼번에</b>: 목록 내려받기 → 엑셀에서 <b className="text-mid">'바꿀 이름'</b> 칸만 채우고 저장 → 올리기 (비운 줄은 그대로)</li>
          <li><Code>id</Code> 칸은 고치지 마세요. <Code>짧은 이름</Code> 은 경기장 위에 보이는 이름 (비우면 마지막 단어)</li>
        </ul>
        <details className="mt-1.5 text-lo">
          <summary className="cursor-pointer text-[11px] hover:text-mid">파일 모양 보기</summary>
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-ink-950 px-3 py-2 text-[11px] leading-relaxed text-mid">{SAMPLE_CSV}</pre>
          <div className="mt-1 text-[11px]">엑셀 기본 저장(CSV) · UTF-8 · JSON 모두 읽습니다.</div>
        </details>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Btn primary disabled={!!busy} onClick={() => { setBusy('names'); run(async () => { await downloadNamesCsv((m) => setBusy(m)); return '이름 목록을 내려받았습니다 (pitchboss-이름목록-날짜.csv)'; }); }}>이름 목록 내려받기</Btn>
          <Btn disabled={!!busy} onClick={() => nameRef.current?.click()}>고친 목록 올리기</Btn>
          <Btn disabled={!!busy} onClick={downloadSample}>예시 파일</Btn>
          <input ref={nameRef} type="file" accept=".csv,.txt,.json,text/csv,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setBusy('names-in'); run(async () => { const r = await importNamesFile(f); return `이름 ${r.applied}개를 바꿨습니다${skippedText(r.skipped)}`; }); } }} />
        </div>
      </div>

      {/* 2. 사진 */}
      <div className="mt-3 rounded-lg bg-ink-900 px-4 py-3 text-[12px] leading-relaxed text-mid">
        <div className="font-semibold text-hi">2. 사진 넣기</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-lo">
          <li><b className="text-mid">한 명씩</b>: 선수 정보의 사진 칸(없으면 '+ 사진') → 사진 고르기 → 끌어서 얼굴 맞추기</li>
          <li><b className="text-mid">여러 장</b>: 파일 이름을 아래처럼 바꾸고 한꺼번에 고르기 (jpg · png · webp, 얼굴 쪽으로 알아서 자름)</li>
        </ul>
        <pre className="mt-2 overflow-x-auto rounded-md bg-ink-950 px-3 py-2 text-[11px] leading-relaxed text-mid">{'p00000a1.jpg            ← 선수 id (가장 정확, 이름 목록에 있음)\n모하메드 살라흐.jpg       ← 게임에 보이는 이름 (같은 이름이 여럿이면 건너뜀)\np00000a1_2017-18.jpg    ← 그 시즌에만'}</pre>
        <div className="mt-1 text-lo"><b className="text-mid">PC 사진 폴더</b>: PC에서 모아 둔 <Code>data/photos</Code> 폴더를 고르면 그대로 넣습니다.</div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Btn primary disabled={!!busy} onClick={() => photoRef.current?.click()}>사진 여러 장 고르기</Btn>
          <Btn disabled={!!busy} onClick={() => dirRef.current?.click()}>PC 사진 폴더 고르기</Btn>
          {st.folderPhotos > 0 && (
            <button disabled={!!busy} onClick={() => { if (confirm(`PC 사진 폴더에서 넣은 사진 ${st.folderPhotos}장을 이 기기에서 뺄까요? (직접 넣은 사진 · 바꾼 이름 · PC 원본 폴더는 그대로)`)) { setBusy('folder-rm'); run(async () => `PC 사진 폴더 사진 ${await removeFolderPhotos()}장을 뺐습니다`); } }}
              className="h-9 rounded-lg px-3 text-[12px] text-lo ring-1 ring-line hover:text-red disabled:opacity-40">PC 폴더 사진 빼기 ({st.folderPhotos}장)</button>
          )}
          <input ref={dirRef} type="file" multiple hidden onChange={(e) => { const fs = e.target.files; if (fs?.length) { const list = [...fs]; e.target.value = ''; setBusy('photo-dir'); run(async () => { const r = await importPhotoFolder(list, (d, t) => setBusy(`사진 넣는 중… ${d}/${t}`)); return `사진 ${r.ok}장을 넣었습니다${r.missing ? ` · 파일 없음 ${r.missing}개` : ''}`; }); } }} />
          <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (fs.length) { setBusy('photos'); run(async () => { const r = await importPhotoFiles(fs, (d, t) => setBusy(`사진 넣는 중… ${d}/${t}`)); return `사진 ${r.ok}장을 넣었습니다${skippedText(r.skipped)}`; }); } }} />
        </div>
      </div>

      {/* 3. 옮기기 */}
      <div className="mt-3 rounded-lg bg-ink-900 px-4 py-3 text-[12px] leading-relaxed text-mid">
        <div className="font-semibold text-hi">3. 다른 기기로 옮기기 (PC → 휴대폰)</div>
        <div className="mt-1 text-lo"><b className="text-mid">내보내기</b> → 나온 파일 하나를 휴대폰으로 보내기 (메신저 · 클라우드 등) → 휴대폰의 이 화면에서 <b className="text-mid">가져오기</b>. 바꾼 이름 · 사진{realExportable() ? ' (원하면 실명 데이터까지)' : ''}이 그대로 들어갑니다.</div>
        {realExportable() && (
          <label className="mt-2 flex items-center gap-2 text-mid">
            <input type="checkbox" checked={withReal} onChange={(e) => setWithReal(e.target.checked)} className="accent-[#39ff14]" />실명 데이터도 함께 (파일 약 15MB)
          </label>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2">
          <Btn primary disabled={!!busy} onClick={() => { setBusy('pack'); run(async () => { await exportPack(withReal, (m) => setBusy(m)); return '내 데이터 파일을 내려받았습니다'; }); }}>내 데이터 내보내기</Btn>
          <Btn disabled={!!busy} onClick={() => packRef.current?.click()}>가져오기</Btn>
          <input ref={packRef} type="file" accept=".pitchboss,application/octet-stream,application/gzip,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setBusy('pack-in'); run(async () => { const r = await importPack(f, (m) => setBusy(m)); if (r.real && confirm('실명 데이터도 들어 있었습니다. 지금 실명 데이터로 바꿀까요? (게임이 다시 불러와집니다)')) setDataset('real'); return `가져왔습니다: 이름 ${r.names}개 · 사진 ${r.photos}장${r.real ? ' · 실명 데이터' : ''}`; }); } }} />
          <button disabled={!!busy || (!st.players && !st.clubs && !st.managers && !st.photos)} onClick={() => { if (confirm('바꾼 이름과 넣은 사진을 이 기기에서 모두 지울까요?')) { setBusy('clear'); run(async () => { await clearCustom(); return '내 데이터를 지웠습니다'; }); } }}
            className="h-9 rounded-lg px-3 text-[12px] text-lo ring-1 ring-line hover:text-red disabled:opacity-40">내 데이터 지우기</button>
        </div>
      </div>
      {busy && busy.length > 8 && <div className="mt-2 text-[12px] text-mid">{busy}</div>}
      {msg && <div className={`mt-2 text-[12px] ${msg.bad ? 'text-red' : 'text-neon'}`}>{msg.t}</div>}
    </section>
  );
}
