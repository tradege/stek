/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable WebSocket proxy for development
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3000/socket.io/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
