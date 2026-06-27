import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Gateway routes
      '/api': {
        target: 'http://localhost:88',
        changeOrigin: true,
      },
      // Product service - category JSON, home page
      '/index': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
      // Auth center
      '/auth-api': {
        target: 'http://localhost:20000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
      },
      // Order service
      '/order-api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/order-api/, ''),
      },
      // Coupon / marketing
      '/coupon-api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/coupon-api/, ''),
      },
      // Search service
      '/search-api': {
        target: 'http://localhost:12000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/search-api/, ''),
      },
    },
  },
})
