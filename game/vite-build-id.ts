// 업데이트 알림용 빌드 번호 (ui/components/UpdateBanner.tsx 가 주기적으로 비교)
//  - 개발 서버: GET /build.json → 게임 코드 · 데이터가 바뀔 때마다 새 번호 (HMR 을 꺼 두었으므로 새로 고침해야 반영)
//    사진 넣기(data/photos) · 수집 중간 파일은 제외 (게임 중에 사진을 넣을 때마다 알림이 뜨지 않게)
//  - 배포판: 빌드할 때 build.json 을 함께 만든다 (서비스 워커는 이 파일을 저장해 두지 않음, public/sw.js)
import type { Plugin } from 'vite';

const SKIP = /[\\/](photos|_pipeline|_audit|node_modules|\.git)[\\/]|[\\/]tools[\\/]/;

export function buildIdPlugin(): Plugin {
  let id = String(Date.now());
  return {
    name: 'pitchboss-build-id',
    configureServer(server) {
      const bump = (file: string) => { if (!SKIP.test(file)) id = String(Date.now()); };
      server.watcher.on('change', bump);
      server.watcher.on('add', bump);
      server.watcher.on('unlink', bump);
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/build.json') return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ id }));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ id }) });
    },
  };
}
