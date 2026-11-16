// 이름 목록 CSV 읽기: 따옴표 · 쉼표 · 줄바꿈 · 탭 · 빈 줄
import { describe, expect, it } from 'vitest';
import { parseCsv, SAMPLE_CSV } from './csv';

describe('이름 목록 CSV', () => {
  it('예시 파일 · 따옴표 안 쉼표 · 빈 칸', () => {
    const rows = parseCsv(SAMPLE_CSV);
    expect(rows[0]).toEqual(['id', '구분', '소속', '지금 이름', '바꿀 이름', '짧은 이름']);
    expect(rows[1]).toEqual(['p00000a1', '선수', '리버풀', '모하메드 살라흐', '모하메드 살라', '살라']);
    expect(rows[2][4]).toBe('');
    const q = parseCsv('id,바꿀 이름\r\nc1,"브라이턴 앤드 호브 앨비언, FC"\r\n\r\np2,"이름 ""별명"""\n');
    expect(q).toEqual([['id', '바꿀 이름'], ['c1', '브라이턴 앤드 호브 앨비언, FC'], ['p2', '이름 "별명"']]);
    expect(parseCsv('id\t바꿀 이름\np3\t홍길동')).toEqual([['id', '바꿀 이름'], ['p3', '홍길동']]);   // 엑셀에서 복사한 탭 구분
  });
});
