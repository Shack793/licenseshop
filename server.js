/**
 * Custom server entry point, required by Namecheap cPanel's "Setup Node.js
 * App" (Passenger) — it needs an explicit startup file rather than running
 * `next start` directly. This just wraps Next's own request handler, so
 * middleware, API routes, and everything else still run exactly as they
 * do under `next start`. Not needed (and not used) when deploying to
 * Vercel — that path still runs the framework's own server.
 *
 * Passenger sets process.env.PORT itself; don't hardcode a port.
 */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl).catch((err) => {
      console.error('Error handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    });
  }).listen(port, () => {
    console.log(`> Ready on port ${port}`);
  });
});
