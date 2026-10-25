# 谷粒商城 GuliMall

Spring Boot 2.1.8 / Spring Cloud Greenwich 微服务商城，配套 React 18 / Vite 前端。

阶段 0–6 已验收。已接入认证、商品与采购后台、搜索、会员购物车，以及真实下单、服务端金额、原子锁库与失败恢复；沙箱支付及待付款超时关单留待阶段 7，当前待付款订单保留库存锁定。

- [开发环境、构建与启动说明](docs/DEVELOPMENT.md)
- [阶段进度与验收检查点](docs/implementation-plan.md)
- [认证接口、管理员配置与安全验收](docs/AUTHENTICATION.md)
- [商品浏览接口与阶段 2 验收](docs/CATALOG.md)
- [商品管理、图片上传与采购入库](docs/ADMINISTRATION.md)
- [搜索接口、同步任务与索引恢复](docs/SEARCH.md)
- [服务端购物车、访客合并与运行验收](docs/CART.md)
- [真实下单、库存锁定与故障恢复](docs/ORDERS.md)
- [前端现状](gulimall-web/README.md)

## 快速开始

需要 JDK 8、Maven 3.6+、Node/npm、Docker Desktop Linux 容器引擎及 Compose v2。

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 Check
./scripts/dev.ps1 Up
./scripts/search-index.ps1
./scripts/dev.ps1 Build
./scripts/services.ps1 Start
```

setup.ps1 为 .env 生成随机密码，不覆盖已有配置。默认数据库使用独立的 _demo 后缀，SQL 初始化仅用于空数据卷。停止使用 `./scripts/dev.ps1 Down`，保留数据卷。

services.ps1 在后台启动本项目的十个 jar，日志在 .tools/runtime；停止使用 services.ps1 Stop。也可用 dev.ps1 Run 逐终端运行。前端进入 gulimall-web，执行 npm run dev，浏览器打开 http://127.0.0.1:5173。完整步骤见开发文档。

管理员在 `/admin/products/sync` 从商品库全量重建后可搜索演示商品；“任务已提交”与“已同步”分别展示。已有数据卷先按搜索说明执行一次增量迁移，勿重跑空库初始化。

## 模块

| 模块 | 内容 | 演示配置端口 |
|---|---|---:|
| gulimall-product | 分类、品牌、SPU/SKU、详情与缓存 | 10001 |
| gulimall-member | 会员与地址 | 8000 |
| gulimall-coupon | 积分、折扣、优惠券等营销数据 | 7001 |
| gulimall-ware | 仓库、采购和库存 | 11000 |
| gulimall-order | 订单快照、确认令牌、幂等下单、锁库协调与恢复 | 9000 |
| gulimall-cart | Redis 会员购物车、幂等访客合并、勾选与商品实时刷新 | 18000 |
| gulimall-search | Elasticsearch 索引与检索 | 12000 |
| gulimall-auth-server | 注册、会员/管理员登录、Session 和开发验证码 | 20000 |
| gulimall-third-party | 本地图片上传；云短信/OSS 默认关闭 | 30000 |
| gulimall-gateway | API 网关 | 88 |
| gulimall-common | 公共工具及传输对象，不能独立启动 | — |
| renren-generator | 代码生成工具，非商城必要启动项 | 8088 |
| gulimall-web | React 商城前端 | 5173 |

## 本地自检

```powershell
node --test scripts/baseline.test.mjs
./scripts/scripts.test.ps1
./scripts/dev.ps1 Build
```

旧的手工集成演示测试已隔离，避免默认写库或调用付费 API。新增检查与未验证项详见开发文档。构建通过不等于运行、持久化或交易一致性验收通过。
