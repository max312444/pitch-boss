import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { saleImpact } from './analysis';
import { overall } from './ratings';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const LIVERPOOL = 'c83d96l';
function loadSeason(season: string, league = 'eng1'): SeasonInput {
  const dir = path.join(DATA, 'seasons', season, league);
  const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8'));
  return { season, leagues: [{ id: league, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }] };
}

describe('받은 제안 판단 (saleImpact)', () => {
  it('자리 순위 · 경쟁자 · 팔면 약해지는 정도, 원래 선수단은 그대로', () => {
    const w = createWorld(loadSeason('2025-26'), LIVERPOOL, 1);
    const squad = [...w.clubs[LIVERPOOL].squad];
    const gks = squad.map((id) => w.players[id]).filter((p) => p.pos === 'GK').sort((a, b) => overall(b) - overall(a));
    const im = saleImpact(w, gks[0].id)!;
    expect(im.unit.key).toBe('GK');
    expect(im.rank).toBe(1);
    expect(im.starter).toBe(true);
    expect(im.rivals.map((r) => r.p.id)).not.toContain(gks[0].id);
    expect(im.rivals.length).toBe(gks.length - 1);
    expect(im.drop).toBeLessThan(0);   // 주전 골키퍼를 팔면 약해진다
    expect(w.clubs[LIVERPOOL].squad).toEqual(squad);
    // 골키퍼를 모두 팔면 골키퍼가 보강 1순위
    for (const g of gks.slice(1)) w.clubs[LIVERPOOL].squad = w.clubs[LIVERPOOL].squad.filter((id) => id !== g.id);
    const last = saleImpact(w, gks[0].id)!;
    expect(last.rivals).toHaveLength(0);
    expect(last.after[0].unit.key).toBe('GK');
    expect(last.newNeed).toBe(false);   // 팔기 전에도 이미 대신할 선수가 없어 보강 목록에 있었다
  });
});
