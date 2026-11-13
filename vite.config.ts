import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

/**
 * Local demo API: serves /api/* from the real handler against PGlite with
 * fictional content (see tools/demo/demoServer.ts). Only active for
 * `vite` dev serving; never part of a build. Disabled under `netlify dev`,
 * where the real Netlify Function handles /api/*.
 */
function demoApi(): Plugin {
  return {
    name: 'advent-demo-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      if (process.env.NETLIFY_DEV === 'true') return;
      type DemoServer = { handle: (request: Request) => Promise<Response> };
      let demo: Promise<DemoServer> | null = null;
      const load = () =>
        (demo ??= server
          .ssrLoadModule('/tools/demo/demoServer.ts')
          .then((m) =>
            (m.createDemoServer as (o: { dataDir: string; initialTime?: string }) => Promise<DemoServer>)({
              dataDir: process.env.DEMO_DATA_DIR ?? '.demo-data/dev',
              initialTime: process.env.DEMO_INITIAL_TIME,
            }),
          ));

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const request = await toRequest(req);
          const response = await (await load()).handle(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => {
            if (key !== 'set-cookie') res.setHeader(key, value);
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.error('[demo-api]', error);
          res.statusCode = 500;
          res.end('demo api error');
        }
      });
    },
  };
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-expect-error -- required by undici for streamed request bodies
    duplex: hasBody ? 'half' : undefined,
  });
}

export default defineConfig({
  plugins: [react(), tailwindcss(), demoApi()],
  build: {
    sourcemap: false,
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
});
