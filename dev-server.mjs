import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import net from 'net';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

import register from './api/auth/register.js';
import login from './api/auth/login.js';
import notices from './api/notices/index.js';
import noticeById from './api/notices/[id].js';

const BASE_PORT = Number(process.env.PORT || 3000);

function isPortFree(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

async function findFreePort(startPort, tries = 20) {
  for (let p = startPort; p < startPort + tries; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isPortFree(p);
    if (ok) return p;
  }
  throw new Error(`사용 가능한 포트를 찾지 못했습니다. (시도: ${startPort} ~ ${startPort + tries - 1})`);
}

async function main() {
  const port = await findFreePort(BASE_PORT, 50);
  const app = express();
  const server = http.createServer(app);

  // Vercel 서버리스 핸들러는 raw req/res 스트림을 읽습니다.
  // 따라서 여기서는 body parser를 붙이지 않고 그대로 전달합니다.
  app.all('/api/auth/register', (req, res) => register(req, res));
  app.all('/api/auth/login', (req, res) => login(req, res));
  app.all('/api/notices', (req, res) => notices(req, res));
  app.all('/api/notices/:id', (req, res, next) => {
    // Vercel 스타일(req.query.id)에 맞추기 위해 보정
    req.query = { ...(req.query || {}), id: req.params.id };
    return noticeById(req, res, next);
  });

  // 로컬 통합 dev 서버는 HTTP로 동작합니다.
  // vite.config.js의 https/basicSsl 설정이 middleware 모드에 영향을 주며
  // 일부 환경에서 빈 응답(연결 종료)을 유발할 수 있어 dev-server에서는 config를 로드하지 않습니다.
  const vite = await createViteServer({
    configFile: false,
    server: {
      middlewareMode: true,
      // HMR websocket을 현재 HTTP 서버에 붙입니다.
      hmr: { server, port },
    },
    appType: 'custom',
  });

  app.use(vite.middlewares);

  // 멀티 페이지 라우팅 (index/notice/webxr-ar)
  app.use('*', async (req, res, next) => {
    try {
      const url = req.originalUrl || '/';
      let htmlFile = 'index.html';
      if (url.startsWith('/notice')) htmlFile = 'notice.html';
      if (url.startsWith('/webxr-ar')) htmlFile = 'webxr-ar.html';

      const filePath = path.resolve(process.cwd(), htmlFile);
      const raw = await fs.readFile(filePath, 'utf-8');
      const html = await vite.transformIndexHtml(url, raw);
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
    } catch (e) {
      next(e);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[dev] http://localhost:${port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

