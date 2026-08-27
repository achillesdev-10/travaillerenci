/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      // Le dashboard admin utilise /api/achilles/* côté client mais les
      // routes API existent sous /api/admin/*.
      {
        source: '/api/achilles/:path*',
        destination: '/api/admin/:path*',
      },
    ];
  },
};

export default nextConfig;
