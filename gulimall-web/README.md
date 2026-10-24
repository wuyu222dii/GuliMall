# Gulimall React Frontend

React 18 / Vite 5 / React Router 6 / Axios / Zustand。阶段 1 已接入真实认证；购物车与下单仍待后续阶段完善。

## 启动

先按 [开发说明](../docs/DEVELOPMENT.md) 启动基础设施与九个后端服务，然后：

```powershell
cd gulimall-web
npm ci
npm run dev
```

打开 `http://127.0.0.1:5173`。Vite 仅监听本机，所有请求经 `/api` 代理到网关 `127.0.0.1:88`。不再配置业务服务直连代理。

## 页面与数据来源

| 页面 | 当前行为 |
|---|---|
| `/` | `/api/product/catalog` 分类与商品推荐 |
| `/search` | 商品 SKU 列表，ES 搜索留待阶段 4 |
| `/product/:skuId` | 商品与库存接口，完整详情留待阶段 2 |
| `/login`、`/register` | 真实会员登录/注册，开发验证码有明确标识 |
| `/admin/login`、`/admin` | 独立管理员登录与身份确认；管理业务页面留待阶段 3 |
| `/member/address` | 当前会员地址增删改查，服务端验证归属 |
| `/member/orders` | 当前会员订单列表，服务端过滤会员 ID |
| `/cart` | 仍为浏览器购物车，服务端合并留待阶段 5 |
| `/checkout` | 需会员登录，提交仍为演示，占位下单留待阶段 6 |

Session Cookie 为 HttpOnly；Zustand 仅存当前页面身份，刷新通过 `/api/auth/me` 恢复。localStorage 中旧模拟身份会清除，不能作为登录凭证。修改请求自动携带从 `/api/auth/csrf` 取得的 Token，退出由服务端销毁会话。

会员演示账号 `demo_a` / `demo_b`，密码 `Demo12345!`。管理员凭据与开发验证码限制见 [认证说明](../docs/AUTHENTICATION.md)。

## 检查

```powershell
npm run build
npm run lint
```

生产构建已通过。lint 尚有原有 ProductCard props 校验 6 条错误，阶段 2 处理；未关闭规则。浏览器已验证登录、刷新恢复、退出、受保护页面跳转、错误密码提示和开发验证码提示。