// 화면 점검: 여러 기기 (휴대폰 · 태블릿 · PC) 에서 모든 화면을 열고 문제를 찾는다
//   node scripts/screens.mjs [출력 폴더]   (개발 서버 http://localhost:5173 이 켜져 있어야 함)
// 찾는 것: 콘솔 오류 · 예외, 가로 넘침 (페이지 스크롤), 화면 밖으로 나간 요소, 다른 요소에 가려 누를 수 없는 버튼,
//          터치 화면에서 너무 작은 버튼 (24px 미만, .tap 으로 넓힌 버튼은 제외). 화면마다 스크린샷.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(import.meta.dirname, '../../tools/node_modules/playwright-core'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:5173/';
const OUT = process.argv[2] ?? path.join(os.tmpdir(), 'pitchboss-screens');
const LIVERPOOL = 'c83d96l';
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { name: 'phone-s', viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: 'phone-land', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'tablet-land', viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'pc', viewport: { width: 1440, height: 900 } },
  { name: 'pc-small', viewport: { width: 1280, height: 720 } },
];
const ONLY = process.env.DEVICES ? process.env.DEVICES.split(',') : null;

/** 페이지 안에서 문제 찾기 */
function inspect(touch) {
  const vw = innerWidth, vh = innerHeight;
  const out = { overflowX: document.documentElement.scrollWidth - vw, offscreen: [], covered: [], small: [], unreachable: [], hiddenRow: [] };
  const vis = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.title || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX + s.overflow)) return true; } return false; };
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !vis(el)) continue;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el) && getComputedStyle(el).position !== 'fixed') out.offscreen.push(`${el.tagName.toLowerCase()} "${label(el)}" ${Math.round(r.left)}~${Math.round(r.right)}`);
  }
  const clickables = [...document.querySelectorAll('button, a[href], [role=button], select, input:not([type=hidden]), summary')];
  for (const el of clickables) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !vis(el) || el.disabled) continue;
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) {
      // 화면 밖: 스크롤해서 닿는지 (가로로 넘치는 표 · 서랍 밖 · 숨긴 메뉴는 제외)
      if (r.top >= vh || r.bottom <= 0) {
        const saved = [...document.querySelectorAll('*')].filter((x) => x.scrollTop || x.scrollLeft).map((x) => [x, x.scrollTop, x.scrollLeft]);
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const q = el.getBoundingClientRect();
        if (q.top >= vh || q.bottom <= 0) out.unreachable.push(`"${label(el)}" top ${Math.round(q.top)}`);
        for (const x of document.querySelectorAll('*')) if (x.scrollTop) x.scrollTop = 0;
        for (const [x, t, l] of saved) { x.scrollTop = t; x.scrollLeft = l; }
        scrollTo(0, 0);
      }
      continue;
    }
    const blocked = () => {
      const q = el.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.min(Math.max(q.left + q.width / 2, 0), vw - 1), Math.min(Math.max(q.top + q.height / 2, 0), vh - 1));
      return hit && hit !== el && !el.contains(hit) && !hit.contains(el) ? hit : null;
    };
    let hit = blocked();
    // 열린 창 (화면 전체를 덮는 fixed 배경) 뒤의 버튼은 정상
    if (hit) { const ov = [...document.querySelectorAll('body *')].find((o) => getComputedStyle(o).position === 'fixed' && o.contains(hit) && !o.contains(el) && o.getBoundingClientRect().width >= vw - 2 && o.getBoundingClientRect().height >= vh - 2); if (ov) hit = null; }
    // 고정 바 밑으로 지나가는 버튼: 가운데로 스크롤해서 다시 본다 (끝까지 가려지면 문제)
    if (hit) {
      const saved = [...document.querySelectorAll('*')].filter((x) => x.scrollTop || x.scrollLeft).map((x) => [x, x.scrollTop, x.scrollLeft]);
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      hit = blocked();
      for (const x of document.querySelectorAll('*')) if (x.scrollTop) x.scrollTop = 0;
      for (const [x, t, l] of saved) { x.scrollTop = t; x.scrollLeft = l; }
      scrollTo(0, 0);
    }
    if (hit) out.covered.push(`"${label(el)}" ← ${hit.tagName.toLowerCase()}.${String(hit.className).split(' ').slice(0, 3).join('.')} "${label(hit)}"`);
    if (touch && (r.height < 24 || r.width < 24) && !el.closest('.tap') && !el.classList.contains('tap') && el.tagName !== 'INPUT') out.small.push(`"${label(el)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  // PC: 가로로 넘쳐 숨은 버튼 줄 (스크롤바가 안 보여 뒤에 더 있는지 모름). 표처럼 큰 영역은 제외
  if (!touch) for (const el of document.querySelectorAll('div, nav')) {
    const s = getComputedStyle(el);
    if (!/(auto|hidden|scroll)/.test(s.overflowX) || el.scrollWidth <= el.clientWidth + 4 || el.clientHeight > 80 || !vis(el)) continue;
    const btns = el.querySelectorAll(':scope > button');
    if (btns.length >= 3) out.hiddenRow.push(`"${label(btns[btns.length - 1])}" 등 ${btns.length}개 · ${el.scrollWidth - el.clientWidth}px 숨음`);
  }
  out.offscreen = out.offscreen.slice(0, 8);
  return out;
}

const report = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const d of DEVICES) {
  if (ONLY && !ONLY.includes(d.name)) continue;
  const ctx = await browser.newContext({ ...d, name: undefined });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem('pitchboss.intro', '1');
      localStorage.setItem('pitchboss.notice.v3', '1');
      localStorage.setItem('pitchboss.tutorial', 'v2');
      localStorage.setItem('pitchboss.dataset', 'public');
      if (!localStorage.getItem('pitchboss.update')) localStorage.setItem('pitchboss.update', JSON.stringify({ v: 'x', from: null, at: 0 }));
    } catch { /* */ }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`예외: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|photos|manifest\.json|404/.test(m.text())) errors.push(`콘솔: ${m.text().slice(0, 200)}`); });
  const touch = !!d.hasTouch;
  let n = 0;
  const check = async (screen) => {
    await page.waitForTimeout(700);
    const r = await page.evaluate(inspect, touch);
    const shot = `${d.name}-${String(++n).padStart(2, '0')}-${screen}.png`;
    await page.screenshot({ path: path.join(OUT, shot) });
    const errs = errors.splice(0);
    const row = { device: d.name, screen, shot, ...r, errors: errs };
    report.push(row);
    const bad = [r.overflowX > 1 && `가로 넘침 ${r.overflowX}px`, r.offscreen.length && `화면 밖 ${r.offscreen.length}`, r.covered.length && `가려짐 ${r.covered.length}`, r.small.length && `작은 버튼 ${r.small.length}`, r.unreachable.length && `닿지 않음 ${r.unreachable.length}`, r.hiddenRow.length && `잘린 줄 ${r.hiddenRow.length}`, errs.length && `오류 ${errs.length}`].filter(Boolean);
    console.log(`${d.name.padEnd(12)} ${screen.padEnd(22)} ${bad.length ? bad.join(' · ') : 'OK'}`);
  };
  const app = (fn, arg) => page.evaluate(async ([src, a]) => {
    const { useApp } = await import('/src/store/app.ts');
    const { useGame } = await import('/src/store/game.ts');
    return new Function('useApp', 'useGame', 'a', `return (async () => { ${src} })()`)(useApp, useGame, a);
  }, [fn, arg]);
  const closeModals = async () => { for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(100); } };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await check('title');
  for (const mode of ['base', 'my', 'wc']) {
    await app(`useApp.getState().setNewMode(a); useApp.getState().go('newgame');`, mode);
    await check(`newgame-${mode}`);
  }
  await app(`await useGame.getState().newGame('2025-26', 'eng1', '${LIVERPOOL}'); useApp.getState().go('hub');`);
  await page.waitForTimeout(1500);
  await closeModals();
  for (const tab of ['home', 'inbox', 'news', 'squad', 'tactics', 'schedule', 'table', 'transfers', 'finance', 'club']) {
    await app(`useApp.getState().setTab(a)`, tab);
    await check(`tab-${tab}`);
  }
  if (d.viewport.width < 1024) { await app(`useApp.getState().setDrawer(true)`); await check('drawer'); await app(`useApp.getState().setDrawer(false)`); }
  await app(`const w = useGame.getState().world; useApp.getState().openProfile(w.clubs[w.userClubId].squad[0]);`);
  await check('player');
  await app(`useApp.getState().openProfile(null); useApp.getState().openClub(Object.keys(useGame.getState().world.clubs).find((c) => c !== '${LIVERPOOL}'));`);
  await check('club');
  await app(`useApp.getState().openClub(null)`);
  // 경기: 다음 내 경기까지 → 준비 화면 → 경기
  await app(`useApp.getState().setTab('home')`);
  let phase = null;
  for (let i = 0; i < 8 && !phase; i++) {
    await app(`useGame.getState().continueGame()`);
    await page.waitForTimeout(800);
    await closeModals();
    phase = await app(`return useGame.getState().match?.phase ?? null`);
  }
  if (!phase) await check('stuck');
  if (phase) {
    await check('match-prep');
    await app(`useGame.getState().confirmLineup()`);
    await page.waitForTimeout(2500);
    await check('match-live');
  } else console.log(`${d.name.padEnd(12)} (경기 화면까지 못 감)`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.overflowX > 1 || r.offscreen.length || r.covered.length || r.small.length || r.unreachable.length || r.hiddenRow.length || r.errors.length);
console.log(`\n화면 ${report.length}개 · 문제 있는 화면 ${bad.length}개 → ${path.join(OUT, 'report.json')}`);
