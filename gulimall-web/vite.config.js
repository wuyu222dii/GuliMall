import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 网关路由
      '/api': {
        target: 'http://localhost:88',
        changeOrigin: true,
      },
      // 商品服务 - 分类 JSON、首页
      '/index': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
      // 认证中心
      '/auth-api': {
        target: 'http://localhost:20000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
      },
      // 订单服务
      '/order-api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/order-api/, ''),
      },
      // 优惠券/营销
      '/coupon-api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/coupon-api/, ''),
      },
      // 搜索服务
      '/search-api': {
        target: 'http://localhost:12000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/search-api/, ''),
      },
    },
  },
})
