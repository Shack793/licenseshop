/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  async rewrites() {
    // The hosted bot UI is a single static page in /public. It contains no
    // strategy logic — every decision is fetched from /api/engine/decide, which
    // checks the license — so serving the page itself openly is fine.
    return [{ source: '/app', destination: '/app.html' }];
  },
  async headers() {
    return [
      {
        source: '/app.html',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

module.exports = nextConfig;
