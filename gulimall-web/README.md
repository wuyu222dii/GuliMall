# Gulimall React Frontend

React 18 / Vite 5 / React Router 6 / Axios / Zustand。阶段 1 认证、阶段 2 商品浏览和阶段 3 商品/采购后台均已完成；服务端购物车与下单仍待后续阶段完善。

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
| `/` | 消费者分类树与已上架商品推荐 |
| `/search` | 关键词、分类、品牌、价格、排序和分页；ES 搜索留待阶段 4 |
| `/product/:skuId` | 图片、销售属性切换、分组参数、介绍、可售与库存状态 |
| `/login`、`/register` | 真实会员登录/注册，开发验证码有明确标识 |
| `/admin/login`、`/admin` | 独立管理员登录，后台默认进入商品列表 |
| `/admin/products`、`/admin/products/new`、`/admin/products/:id/edit` | SPU、多 SKU、图片、销售属性与规格编辑，保留已有 SKU 编号 |
| `/admin/products/catalog` | 分类、品牌、属性分组和属性维护 |
| `/admin/procurement` | 需求、合并、领取、完成入库、仓库与库存查询 |
| `/admin/orders` | 订单只读列表；支付及发货留待后续阶段 |
| `/member/address` | 当前会员地址增删改查，服务端验证归属 |
| `/member/orders` | 当前会员订单列表，服务端过滤会员 ID |
| `/cart` | 仍为浏览器购物车，进入结算前重新检查商品；服务端合并留待阶段 5 |
| `/checkout` | 需会员登录；重新检查可售性并使用当前价格；提交按钮禁用，真实下单留待阶段 6 |

Session Cookie 为 HttpOnly；Zustand 仅存当前页面身份，刷新通过 `/api/auth/me` 恢复。localStorage 中旧模拟身份会清除，不能作为登录凭证。修改请求自动携带从 `/api/auth/csrf` 取得的 Token，退出由服务端销毁会话。

会员演示账号 `demo_a` / `demo_b`，密码 `Demo12345!`。管理员凭据与开发验证码限制见 [认证说明](../docs/AUTHENTICATION.md)。

## 检查

```powershell
npm run build
npm run lint
```

生产构建与 lint 均已通过，原有 ProductCard 校验错误已修复。浏览器已验证筛选、SKU 切换、加购前校验、下架后的购物车/结算拦截，以及库存未知、缺货、商品不存在、服务停止和恢复后的提示。1200px 和 375px CSS 视口已检查；未进行实体手机测试。

详情和结算预览使用消费者 `/api/product/items`、`/api/product/categories`、`/api/product/brands`，不直接请求管理 CRUD。库存未知时禁止购买，不使用假库存；结算占位提交不会清空购物车。接口及边界见 [商品说明](../docs/CATALOG.md)。

阶段 3 已通过浏览器完成双 SKU 创建与改价、上传图片、创建仓库、采购需求合并/领取/完成及库存核对，并检查 1200px / 375px CSS 视口。操作步骤、接口、图片限制与已有库迁移见 [管理说明](../docs/ADMINISTRATION.md)。新商品保存为草稿，阶段 4 再接入正式上下架与 ES 同步。
