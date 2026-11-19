import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { photosPlugin } from './vite-photos';
import { buildIdPlugin } from './vite-build-id';

// 배포용 빌드 (PUBLIC_ONLY=1): 실명 데이터(data/) 대신 빈 폴더를 끼워 절대 묶이지 않게 한다
//  BASE: 배포 주소 경로 (GitHub Pages 는 /pitch-boss/)
const publicOnly = process.env.PUBLIC_ONLY === '1';

// Windows: 드라이브 문자를 대문자로 맞춘다. Git Bash 처럼 소문자 'c:' 경로에서 켜면 data 경로가 '../../c:/...' 로 깨져
// 파일을 못 찾고 메모리 부족으로 꺼졌다 (2026-11-12). 어디서 켜든 같은 경로가 되게
// (테스트(vitest)에서는 하지 않는다: 작업 폴더를 바꾸면 테스트 파일을 못 찾는다)
const testing = !!process.env.VITEST;
const upper = (p: string) => (testing ? p : p.replace(/^[a-z]:/, (d) => d.toUpperCase()));
if (!testing && /^[a-z]:/.test(process.cwd())) process.chdir(upper(process.cwd()));
const here = upper(__dirname);

export default defineConfig({
  ...(testing ? {} : { root: here }),
  base: process.env.BASE ?? '/',
  // 선수 사진: 내 PC 의 data/photos (개발 서버 전용, vite-photos.ts)
  plugins: [react(), tailwindcss(), buildIdPlugin(),...(publicOnly ? [] : [photosPlugin(path.resolve(here, '../data'), path.resolve(here, '../tools'))])],
  resolve: { alias: { '@': path.resolve(here, 'src'), '@data': path.resolve(here, publicOnly ? 'empty-data' : '../data'), '@pub': path.resolve(here, '../data-public') } },
  // 게임 데이터는 저장소 루트의 data/ 폴더를 그대로 읽는다
  // data/_pipeline (위키백과 캐시 · 백업 · 보고서, 수만 개 파일)은 감시하지 않는다 — 감시하다 메모리 부족으로 꺼짐
  // hmr: false — 켜 둔 채 코드를 고치면 상태 모듈(store/game.ts)이 두 주소(?t=)로 갈라져 두 벌이 생기고,
  //  새 게임이 타이틀로 튕기거나 불러오기가 안 됐다 (새로 고침해도 그대로, 2026-11-16). 고친 뒤에는 새로 고침으로 반영
  // 빌드: 공개 데이터가 시즌 · 구단 파일마다 조각(5천 개 넘음)이라, 조각마다 gzip 크기를 재서 보여 주는 단계가
  //  메모리 4GB 를 넘겨 GitHub Actions 빌드가 꺼졌다 (종료 코드 134, 2026-11-19). 크기 표시는 배포와 상관없으므로 끈다
  build: { reportCompressedSize: false },
  // JSON 은 코드로 풀지 않고 JSON.parse("…") 문자열로 (빌드 메모리 · 시간 ↓, 브라우저에서도 더 빨리 읽음)
  json: { stringify: true },
  server: { hmr: false, fs: { allow: ['..'] }, watch: { ignored: ['**/data/_pipeline/**', '**/tools/**'] } },
  // 시즌을 통째로 돌리는 테스트가 많아 기본 제한 시간을 넉넉히
  test: { include: ['src/**/*.test.ts'], testTimeout: 20000 },
});
