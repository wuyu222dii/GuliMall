# 谷粒商城 GuliMall

Spring Boot 2.1.8 / Spring Cloud Greenwich 微服务商城，配套 React 18 / Vite 前端。

阶段 0–9 的本地验收已通过，当前保留可运行的演示版本；真实支付宝沙箱及公网回调仍为待补验项。

已实现管理员录入多 SKU 商品、采购入库、上下架与搜索、会员注册登录、购物车、幂等下单与原子锁库、支付处理、发货和确认收货。金额与归属由服务端校验；订单、库存通过本地事务、持久化事件、幂等消费与扫描补偿恢复。

短信使用明确标识的开发验证码，图片保存于本地持久目录，支付故障验收使用真实 RSA2 签名的 LOCAL_TEST 网关。真实支付宝沙箱及公网回调待账号开通补验；默认未配置支付凭据时不能付款。物流由管理员填写公司与运单号，不接轨迹服务。

- [开发环境、构建与启动说明](docs/DEVELOPMENT.md)
- [独立测试、演示部署、交易演示与备份恢复](docs/RUNBOOK.md)
- [阶段进度与验收检查点](docs/implementation-plan.md)
- [认证接口、管理员配置与安全验收](docs/AUTHENTICATION.md)
- [商品浏览接口与阶段 2 验收](docs/CATALOG.md)
- [商品管理、图片上传与采购入库](docs/ADMINISTRATION.md)
- [搜索接口、同步任务与索引恢复](docs/SEARCH.md)
- [服务端购物车、访客合并与运行验收](docs/CART.md)
- [真实下单、库存锁定与故障恢复](docs/ORDERS.md)
- [支付、消息、关单与本地/沙箱验收边界](docs/PAYMENTS.md)
- [订单查询、发货、收货与取消](docs/FULFILLMENT.md)
- [前端现状](gulimall-web/README.md)

## 快速开始

需要 JDK 8、Maven 3.6+、Node/npm、Docker Desktop Linux 容器引擎及 Compose v2。

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 Check
./scripts/dev.ps1 Up
./scripts/dev.ps1 Build
java '-Dloader.main=com.atguigu.gulimall.auth.tool.AdminPasswordTool' -cp gulimall-auth-server/target/gulimall-auth-server-0.0.1-SNAPSHOT.jar org.springframework.boot.loader.PropertiesLauncher
# 交互输入管理员密码，将输出的 BCrypt 摘要配置为 .env 的 ADMIN_PASSWORD_HASH，并设置 ADMIN_USER。
./scripts/search-index.ps1
./scripts/services.ps1 Start
./scripts/dev.ps1 Smoke
./scripts/deploy.ps1 Start
```

setup.ps1 为 .env 生成随机密码，不覆盖已有配置。默认数据库使用独立的 _demo 后缀，SQL 初始化仅用于空数据卷。停止使用 `./scripts/dev.ps1 Down`，保留数据卷。

等待服务注册并通过 Smoke 后，访问 http://127.0.0.1:8080。静态部署无需 Vite，同源 `/api` 转发到本机网关。services.ps1 管理十个 jar，日志在 .tools/runtime。停止依次使用 deploy.ps1 Stop、services.ps1 Stop、dev.ps1 Down，均保留业务数据。开发时仍可在 gulimall-web 执行 npm run dev，访问 5173。

管理员在 `/admin/products/sync` 从商品库全量重建后可搜索演示商品；“任务已提交”与“已同步”分别展示。已有数据卷先按搜索说明执行一次增量迁移，勿重跑空库初始化。

## 模块

| 模块 | 内容 | 演示配置端口 |
|---|---|---:|
| gulimall-product | 分类、品牌、SPU/SKU、详情与缓存 | 10001 |
| gulimall-member | 会员与地址 | 8000 |
| gulimall-coupon | 积分、折扣、优惠券等营销数据 | 7001 |
| gulimall-ware | 仓库、采购和库存 | 11000 |
| gulimall-order | 订单快照、支付、幂等下单、持久化事件与补偿 | 9000 |
| gulimall-cart | Redis 会员购物车、幂等访客合并、勾选与商品实时刷新 | 18000 |
| gulimall-search | Elasticsearch 索引与检索 | 12000 |
| gulimall-auth-server | 注册、会员/管理员登录、Session 和开发验证码 | 20000 |
| gulimall-third-party | 本地图片上传；云短信/OSS 默认关闭 | 30000 |
| gulimall-gateway | API 网关 | 88 |
| gulimall-common | 公共工具及传输对象，不能独立启动 | — |
| renren-generator | 代码生成工具，非商城必要启动项 | 8088 |
| gulimall-web | React 商城前端 | 静态 8080 / Vite 5173 |

## 本地自检

```powershell
node --test scripts/baseline.test.mjs scripts/product-ui.test.mjs scripts/cart-ui.test.mjs scripts/payment-ui.test.mjs scripts/order-ui.test.mjs scripts/deployment.test.mjs
./scripts/scripts.test.ps1
# Windows 重建 jar 前先停止服务。
./scripts/services.ps1 Stop
./scripts/dev.ps1 Build
./scripts/services.ps1 Start
# 串行运行，会暂时停止演示环境，结束后恢复：
./scripts/test.ps1 -Suite All
./scripts/test.ps1 -Suite Recovery
```

默认检查不连接业务库：26 项 Java、13 项 Node 及 PowerShell 自检；旧手工集成演示的 9 项忽略不计入通过。运行回归覆盖 68 个业务场景，另有成功交易、失败补偿和全新实例恢复演练。测试使用独立 gulimall-test 容器/卷和五个 `_test` 库；脚本核对实际数据库，拒绝演示库。不可与人工演示或另一轮测试并行。

成功/失败交易分别运行 `./scripts/test.ps1 -Suite Success` / `Failure`。演示库冷备份运行 `./scripts/backup.ps1 -Environment Demo`，恢复须先在全新实例验证，具体步骤见 [运行手册](docs/RUNBOOK.md)。SQL、Redis、图片与校验清单保存于 Git 忽略的私有目录，不覆盖源数据。

后置内容：真实沙箱与公网回调、真实短信/OSS、技术栈升级、自动退款售后、角色权限和运营报表。当前未提供高可用集群、在线热备或负载容量承诺。
