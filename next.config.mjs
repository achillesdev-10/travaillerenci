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
      // Le dashboard admin utilise /api/cz7tk/* côté client mais les
      // routes API existent sous /api/admin/*.
      {
        source: '/api/cz7tk/:path*',
        destination: '/api/admin/:path*',
      },
    ];
  },
};

export default nextConfig;
