# 谷粒商城 React 前端

基于 React + Vite 的单页应用，对接 gulimall 微服务后端。

## 技术栈

- React 18 + Vite 5
- React Router 6
- Axios
- Zustand（购物车 / 登录态持久化）

## 页面路由

| 路由 | 页面 | 对接后端 |
|------|------|----------|
| `/` | 首页（分类 + 推荐商品） | product `/index/catalog.json` |
| `/search` | 商品搜索 | product `/api/product/skuinfo/list` |
| `/product/:skuId` | 商品详情 | product + ware 库存 |
| `/cart` | 购物车 | 前端 localStorage（cart 服务缺失） |
| `/checkout` | 订单确认 | member 地址 + order（占位） |
| `/login` | 登录 | auth-server（模拟登录） |
| `/register` | 注册 | auth-server 短信验证码 |
| `/member/orders` | 我的订单 | order `/order/order/list` |
| `/member/address` | 收货地址 | member CRUD |

## 启动

```bash
# 1. 确保后端服务已启动（至少 product + gateway + member + ware）
# 2. 安装依赖
cd gulimall-web
npm install

# 3. 启动开发服务器
npm run dev
```

访问 http://localhost:5173

## 代理配置

开发环境通过 `vite.config.js` 代理到各微服务：

| 前缀 | 目标 |
|------|------|
| `/api` | 网关 `localhost:88` |
| `/index` | 商品服务 `localhost:10000` |
| `/auth-api` | 认证中心 `localhost:20000` |
| `/order-api` | 订单服务 `localhost:9000` |
| `/coupon-api` | 优惠券服务 `localhost:7001` |
| `/search-api` | 搜索服务 `localhost:12000` |

## 后端依赖说明

- **购物车**：后端 `gulimall-cart` 模块缺失，购物车使用浏览器 localStorage 实现
- **登录/注册**：auth-server SSO 未完整实现，登录为前端模拟；注册短信接口可正常调用
- **下单**：order 服务 `submitOrder` 为占位实现，结算页为演示模式
- **搜索**：当前使用 product 服务的 SKU 列表接口按关键字搜索；ES 搜索需后端补充 JSON API

## 构建

```bash
npm run build
npm run preview
```
