// 이름 목록 CSV (게임 데이터를 부르지 않는 순수 함수 · 테스트용으로 분리)
/** 예시 파일 (형식 설명용 4줄, 번호는 없는 예시 번호라 올려도 바뀌는 것 없음) */
export const SAMPLE_CSV = [
  'id,구분,소속,지금 이름,바꿀 이름,짧은 이름',
  'p00000a1,선수,리버풀,모하메드 살라흐,모하메드 살라,살라',
  'p00000a2,선수,리버풀,버질 판데이크,,',
  'c00000a1,구단,,리버풀,리버풀 FC,',
  'm00000a1,감독,맨체스터 시티,펩 과르디올러,펩 과르디올라,과르디올라',
].join('\r\n');
/** CSV 한 줄씩 (따옴표 · 줄바꿈 처리) */
export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((c) => c.trim()));
}
