// 패러디 세이브 → 실명 바꾸기 (실명 데이터 data/ 가 있는 PC 에서만)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { convertToReal, type PublicMap } from './convertReal';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const ROOT = path.resolve(__dirname, '../../..');
const MAP = path.join(ROOT, 'data', 'canonical', 'public-map.json');
const has = fs.existsSync(MAP) && fs.existsSync(path.join(ROOT, 'data', 'seasons', '2025-26', 'eng1'));
const load = (base: string, season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(ROOT, base, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });

describe.skipIf(!has)('패러디 세이브 → 실명', () => {
  it('번호 · 이름 · 생일이 실명 데이터와 같아지고, 구단 · 선수 수는 그대로', () => {
    const pub = createWorld(load('data-public', '2025-26', ['eng1']), 'c83d96l', 4);
    pub.dataset = 'public';
    pub.date = '2025-09-10';
    const map: PublicMap = JSON.parse(fs.readFileSync(MAP, 'utf8'));
    const real = load('data', '2025-26', ['eng1']);
    const { world: w, ids, named } = convertToReal(pub, map, real.leagues[0].clubs);
    console.log('바꾼 번호', ids, '· 실제 이름', named);
    expect(w.dataset).toBe('real');
    expect(w.userClubId).toBe(Object.entries(map.clubs).find(([, v]) => v === 'c83d96l')![0]);
    expect(Object.keys(w.clubs).length).toBe(Object.keys(pub.clubs).length);
    expect(Object.keys(w.players).length).toBe(Object.keys(pub.players).length);
    // 실명 시즌 파일의 선수 · 구단이 모두 그대로 있고, 이름 · 생일이 실제 값
    for (const f of real.leagues[0].clubs) {
      expect(w.clubs[f.club]).toBeTruthy();
      for (const sp of f.squad) { expect(w.players[sp.id]?.name).toBe(sp.name); expect(w.players[sp.id].birth).toBe(sp.birth); }
    }
    // 일정 · 순위의 구단 번호도 실명
    const comp = w.competitions.eng1;
    expect(comp.fixtures.every((f) => w.clubs[f.home] && w.clubs[f.away])).toBe(true);
    expect(JSON.stringify(w)).not.toContain('c83d96l');
  });
});
