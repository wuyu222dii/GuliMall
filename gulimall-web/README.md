# Gulimall React Frontend

A single-page application built with React + Vite, connecting to the gulimall microservices backend.

## Tech Stack

- React 18 + Vite 5
- React Router 6
- Axios
- Zustand (shopping cart / login state persistence)

## Page Routes

| Route | Page | Backend API |
|------|------|----------|
| `/` | Home (categories + recommended products) | product `/index/catalog.json` |
| `/search` | Product search | product `/api/product/skuinfo/list` |
| `/product/:skuId` | Product detail | product + ware inventory |
| `/cart` | Shopping cart | Frontend localStorage (cart service missing) |
| `/checkout` | Order confirmation | member addresses + order (placeholder) |
| `/login` | Login | auth-server (mock login) |
| `/register` | Register | auth-server SMS verification |
| `/member/orders` | My orders | order `/order/order/list` |
| `/member/address` | Shipping addresses | member CRUD |

## Getting Started

```bash
# 1. Ensure backend services are running (at least product + gateway + member + ware)
# 2. Install dependencies
cd gulimall-web
npm install

# 3. Start the dev server
npm run dev
```

Visit http://localhost:5173

## Proxy Configuration

In development, `vite.config.js` proxies requests to microservices:

| Prefix | Target |
|------|------|
| `/api` | Gateway `localhost:88` |
| `/index` | Product service `localhost:10000` |
| `/auth-api` | Auth server `localhost:20000` |
| `/order-api` | Order service `localhost:9000` |
| `/coupon-api` | Coupon service `localhost:7001` |
| `/search-api` | Search service `localhost:12000` |

## Backend Dependencies

- **Shopping cart**: Backend `gulimall-cart` module is missing; the cart is implemented using browser localStorage
- **Login/Register**: auth-server SSO is not fully implemented; login is mocked on the frontend; registration SMS API works normally
- **Checkout**: order service `submitOrder` is a placeholder; the checkout page runs in demo mode
- **Search**: Currently uses the product service SKU list API for keyword search; ES search requires a JSON API to be added on the backend

## Build

```bash
npm run build
npm run preview
```
