/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Changed: Enable type checking in production
  },
  images: {
    unoptimized: false, // Changed: Enable image optimization
    domains: ['placeholder.com'], // Add allowed image domains
    formats: ['image/webp', 'image/avif'],
  },
  // Enable React strict mode for better error detection
  reactStrictMode: true,
  
  // Optimize production builds
  swcMinify: true,
  
  // Security headers (also set in middleware, but good to have here)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
  
  // Optimize bundle
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
}

export default nextConfig
