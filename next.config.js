/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the frontend to call the Express API on port 3001
  async rewrites() {
    return []   // No rewrites needed — frontend calls API_URL directly
  },
  // Suppress the @xenova/transformers warning (not used in this version)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    return config
  },
  optimizeFonts: false,
}

module.exports = nextConfig
