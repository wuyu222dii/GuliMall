# Gulimall React Frontend

React 18 / Vite 5 / React Router 6 / Axios / Zustand。阶段 1–5 的认证、商品浏览、管理后台、搜索及服务端购物车已完成；真实下单仍待阶段 6 完成。

## 启动

先按 [开发说明](../docs/DEVELOPMENT.md) 启动基础设施与十个后端服务，然后：

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
| `/search` | ES 中文检索、分类、品牌、价格、库存、排序和分页；失败不回退到数据库 |
| `/product/:skuId` | 图片、销售属性切换、分组参数、介绍、可售与库存状态 |
| `/login`、`/register` | 真实会员登录/注册，开发验证码有明确标识 |
| `/admin/login`、`/admin` | 独立管理员登录，后台默认进入商品列表 |
| `/admin/products`、`/admin/products/new`、`/admin/products/:id/edit` | SPU、多 SKU、图片、销售属性与规格编辑，保留已有 SKU 编号 |
| `/admin/products/catalog` | 分类、品牌、属性分组和属性维护 |
| `/admin/products/sync` | 搜索同步状态、失败手动重试、从商品库全量重建 |
| `/admin/procurement` | 需求、合并、领取、完成入库、仓库与库存查询 |
| `/admin/orders` | 订单只读列表；支付及发货留待后续阶段 |
| `/member/address` | 当前会员地址增删改查，服务端验证归属 |
| `/member/orders` | 当前会员订单列表，服务端过滤会员 ID |
| `/cart` | 会员数据来自 Redis；访客保存在本机，登录后幂等合并，支持数量/勾选/删除及刷新 |
| `/checkout` | 从会员已勾选接口读取最新商品与金额；提交按钮禁用，真实下单留待阶段 6 |

Session Cookie 为 HttpOnly；Zustand 仅存当前页面身份，刷新通过 `/api/auth/me` 恢复。localStorage 中旧模拟身份会清除，不能作为登录凭证。修改请求自动携带从 `/api/auth/csrf` 取得的 Token，退出由服务端销毁会话。

会员演示账号 `demo_a` / `demo_b`，密码 `Demo12345!`。管理员凭据与开发验证码限制见 [认证说明](../docs/AUTHENTICATION.md)。

## 检查

```powershell
npm run build
npm run lint
```

生产构建与 lint 均已通过，原有 ProductCard 校验错误已修复。浏览器已验证筛选、SKU 切换、加购前校验、下架后的购物车/结算拦截，以及库存未知、缺货、商品不存在、服务停止和恢复后的提示。1200px 和 375px CSS 视口已检查；未进行实体手机测试。

详情和结算预览使用消费者 `/api/product/items`、`/api/product/categories`、`/api/product/brands`，不直接请求管理 CRUD。库存未知时禁止购买，不使用假库存；结算占位提交不会清空购物车。接口及边界见 [商品说明](../docs/CATALOG.md)。

阶段 3 已通过浏览器完成双 SKU 创建与改价、上传图片、创建仓库、采购需求合并/领取/完成及库存核对，并检查 1200px / 375px CSS 视口。操作步骤、接口、图片限制与已有库迁移见 [管理说明](../docs/ADMINISTRATION.md)。新商品保存为草稿，商品列表提供上下架，失败时保留目标状态并提示到同步页处理。

阶段 4 浏览器验证上架后中文组合筛选、库存与排序、ES 停止报错、恢复后重试、任务结果、全量重建提交及下架后结果归零；桌面和窄屏页面无横向溢出。搜索协议与恢复步骤见 [SEARCH.md](../docs/SEARCH.md)。库存字段为定期更新的快照，购买前仍实时检查。

阶段 5 会员购物车不写入 localStorage，切换身份先清除显示缓存。访客副本确认合并成功才清理，失败批次绑定首次会员，其他账号不可见；Web Locks 与稳定 UUID 保护并发标签页。服务失败保留条目、价格标为未知、禁用结算，恢复后可重试。浏览器已验证失败保留/换号隔离/恢复合并、刷新不重复、数量/勾选/删除、已选结算预览和桌面/窄屏布局，详见 [CART.md](../docs/CART.md)。
