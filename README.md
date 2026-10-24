# 谷粒商城 GuliMall

Spring Boot 2.1.8 / Spring Cloud Greenwich 微服务商城，配套 React 18 / Vite 前端。

阶段 0 环境验收和阶段 1 认证验收已通过。已接入真实注册登录、Redis Session、CSRF、会员地址/订单隔离和管理员接口保护；服务端购物车、真实下单及沙箱支付闭环仍待后续阶段完成。

- [开发环境、构建与启动说明](docs/DEVELOPMENT.md)
- [阶段进度与验收检查点](docs/implementation-plan.md)
- [认证接口、管理员配置与安全验收](docs/AUTHENTICATION.md)
- [前端现状](gulimall-web/README.md)

## 快速开始

需要 JDK 8、Maven 3.6+、Node/npm、Docker Desktop Linux 容器引擎及 Compose v2。

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 Check
./scripts/dev.ps1 Up
./scripts/dev.ps1 Build
./scripts/dev.ps1 Run -Module gulimall-product
```

setup.ps1 为 .env 生成随机密码，不覆盖已有配置。默认数据库使用独立的 _demo 后缀，SQL 初始化仅用于空数据卷。停止使用 `./scripts/dev.ps1 Down`，保留数据卷。

业务服务各开终端启动；前端进入 gulimall-web，执行 npm run dev。完整顺序和验收步骤见开发文档。

## 模块

| 模块 | 内容 | 演示配置端口 |
|---|---|---:|
| gulimall-product | 分类、品牌、SPU/SKU、详情与缓存 | 10001 |
| gulimall-member | 会员与地址 | 8000 |
| gulimall-coupon | 积分、折扣、优惠券等营销数据 | 7001 |
| gulimall-ware | 仓库、采购和库存 | 11000 |
| gulimall-order | 订单、支付和售后数据；下单仍为占位 | 9000 |
| gulimall-search | Elasticsearch 索引与检索 | 12000 |
| gulimall-auth-server | 注册、会员/管理员登录、Session 和开发验证码 | 20000 |
| gulimall-third-party | 云短信/OSS，默认关闭 | 30000 |
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
