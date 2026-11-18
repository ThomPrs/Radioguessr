import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

/**
 * En développement, sert les fonctions de /api (signature Web Request → Response)
 * directement depuis Vite, sans la CLI Vercel. Sans variables Upstash, le stockage est en mémoire.
 */
function devApi(): Plugin {
  const routes: [RegExp, string][] = [
    [/^\/api\/rooms\/?$/, '/api/rooms/index.ts'],
    [/^\/api\/rooms\/[^/]+\/?$/, '/api/rooms/[code].ts'],
  ];
  return {
    name: 'radioguessr-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const file = routes.find(([re]) => re.test(url.pathname))?.[1];
        if (!file) return next();
        try {
          const mod = (await server.ssrLoadModule(file)) as Record<string, (r: Request) => Promise<Response>>;
          const handler = mod[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(url, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [preact(), devApi()],
});
