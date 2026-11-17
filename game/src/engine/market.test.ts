// 이적시장 매물: 일부 선수만 시장에 나온다
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, type SeasonInput } from './world';
import { saleTag } from './market';
import { askingPrice } from './transfer';
import { overall } from './ratings';
import type { ClubSeasonFile, LeagueSeasonFile } from '../data/types';

const DATA = path.resolve(__dirname, '../../../data-public');
const load = (season: string, ids: string[]): SeasonInput => ({ season, leagues: ids.map((id) => { const dir = path.join(DATA, 'seasons', season, id); const meta: LeagueSeasonFile = JSON.parse(fs.readFileSync(path.join(dir, '_league.json'), 'utf8')); return { id, clubs: meta.clubs.map((c) => JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8')) as ClubSeasonFile) }; }) });
const LIV = 'c83d96l';

describe('이적시장 매물', () => {
  const w = createWorld(load('2025-26', ['eng1']), LIV, 7);
  it('AI 구단 선수 중 일부만 시장에 (15 ~ 50%), 각 구단 최고 선수 대부분은 비매물', () => {
    const ai = Object.values(w.players).filter((p) => p.clubId && p.clubId !== LIV && !p.retired);
    const tags: Record<string, number> = {};
    for (const p of ai) { const t = saleTag(w, p) ?? 'none'; tags[t] = (tags[t] ?? 0) + 1; }
    const share = 1 - (tags.none ?? 0) / ai.length;
    console.log('매물 비율', (share * 100).toFixed(0) + '%', JSON.stringify(tags));
    expect(share).toBeGreaterThan(0.15); expect(share).toBeLessThan(0.5);
    const stars = Object.values(w.clubs).filter((c) => c.id !== LIV).map((c) => c.squad.map((id) => w.players[id]).sort((a, b) => overall(b) - overall(a))[0]);
    expect(stars.filter((p) => saleTag(w, p)).length / stars.length).toBeLessThan(0.4);
  });
  it('내 선수는 이적 명단에 올린 것만 · 시장에 나온 선수는 구단이 조금 싸게 부른다', () => {
    const mine = w.players[w.clubs[LIV].squad[0]];
    expect(saleTag(w, mine)).toBeNull();
    w.transferList = [mine.id];
    expect(saleTag(w, mine)).toBe('listed');
    const p = Object.values(w.players).find((x) => x.clubId && x.clubId !== LIV && saleTag(w, x) === 'surplus')!;
    const before = askingPrice(w, p);
    const c = w.clubs[p.clubId!];
    const keep = c.squad;
    c.squad = c.squad.slice(0, 18).concat(p.id).filter((v, i, a) => a.indexOf(v) === i);   // 인원을 줄이면 구단 판매에서 빠짐
    const fresh = { ...w };   // 새 객체 → 순위 캐시 새로
    expect(saleTag(fresh, p)).not.toBe('surplus');
    expect(askingPrice(fresh, p)).toBeGreaterThan(before);
    c.squad = keep;
  });
});
