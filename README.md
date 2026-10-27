# 谷粒商城 GuliMall

Spring Boot 2.1.8 / Spring Cloud Greenwich 微服务商城，配套 React 18 / Vite 前端。

阶段 0–28 的本地模拟验收已通过，当前提供中文商城、精简管理后台、运行诊断、Chromium/Edge 回归和完整隔离冷恢复；真实第三方接入继续后置。

阶段 28 后台专项已完成：商品分类/品牌/状态组合筛选和 URL 页码、订单独立详情与重登/返回恢复、同步重试时间和编辑入口。Java 33、Node 44、Product/Admin/Fulfillment 共 26 个业务场景、Browser 28 项通过；常驻 18 项健康，原数据及私有文件指纹保持一致。全量 All/Recovery 沿用阶段 26，详见 [阶段 28 验收](docs/STAGE28.md)。

阶段 27 采购专项已完成：先复现旧明细可操作及重复新增，再补齐请求核对、即时防重、SKU/采购单分页。Java 33、Node 40、Admin 10 个业务场景和 Browser 22 项通过，常驻 18 项健康；全量 All/Recovery 仍以阶段 26 为准，详见 [阶段 27 验收](docs/STAGE27.md)。

阶段 18 的干净目录构建、环境/配置预检和本机隔离交易及重启已通过；独立机器和第二位操作者验收仍待补，见 [交接准备](docs/HANDOFF-SETUP.md)。

阶段 19 保留 Chromium 两轮完整回归，补齐 Edge 关键交易、会话失效、返回刷新、同一确认多标签防重及窄屏键盘操作，见 [浏览器回归](docs/BROWSER-REGRESSION.md)。

阶段 20 已完成 Demo 冷备份的完整隔离恢复、原交易核对、消息补偿及恢复后继续交易；保留 Test 保护并复验 Recovery，见 [恢复说明](docs/DEMO-RESTORE.md)。常驻环境仍为本地模拟，不接真实第三方。

阶段 26 最终验收：Java 33 项、Node 37 项、72 个业务场景（原 68 + 新增 4）、四类诊断故障、14 项 Chromium/Edge 检查、Test Recovery 及旧 Demo 备份两代隔离恢复均通过。旧 9 个类、17 个手工方法继续忽略、不计通过；详见 [阶段 26 验收](docs/STAGE26.md)。独立机器与第二位操作者仍待补。

已实现管理员录入多 SKU 商品、采购入库、上下架与搜索、会员注册登录、购物车、幂等下单与原子锁库、支付处理、发货和确认收货。金额与归属由服务端校验；订单、库存通过本地事务、持久化事件、幂等消费与扫描补偿恢复。

短信使用明确标识的开发验证码，图片保存于本地持久目录，模拟付款走 SDK 表单、RSA2 通知和真实订单/库存流程。常驻 LOCAL_TEST 网关保存交易并重试通知，重启后可恢复；无真实资金。普通启动未配置支付凭据时仍不能付款，请使用下面的模拟入口。物流由管理员填写公司与运单号，不接轨迹服务。

- [开发环境、构建与启动说明](docs/DEVELOPMENT.md)
- [常驻模拟商城：启动、付款、恢复和未来接口替换](docs/SIMULATION.md)
- [中文演示检查表与交接步骤](docs/DEMO-HANDOFF.md)
- [干净目录构建、环境预检与本机隔离交接](docs/HANDOFF-SETUP.md)
- [Chromium / Edge 回归与确认页多标签行为](docs/BROWSER-REGRESSION.md)
- [Demo 冷备份完整隔离恢复与继续交易](docs/DEMO-RESTORE.md)
- [阶段 28 后台筛选、订单导航与同步可见性](docs/STAGE28.md)
- [阶段 27 采购结果核对、分页与实际验收](docs/STAGE27.md)
- [最新页面完善与分阶段结果](docs/STAGES22-26.md)
- [阶段 26 全量回归与恢复兼容](docs/STAGE26.md)
- [阶段 21 历史验收](docs/STAGE21.md)
- [9 个历史忽略类、17 个方法与替代覆盖](docs/LEGACY-TESTS.md)
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

阶段 22–26 已完成地址维护、商品创建防重与编辑恢复、会员订单筛选/独立详情、仓库维护及购物车交互，并验证增量迁移与恢复兼容。实现、各阶段提交和证据见 [本轮记录](docs/STAGES22-26.md) 与 [最终验收](docs/STAGE26.md)。

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
./scripts/simulation.ps1 Start
./scripts/simulation.ps1 Status
./scripts/simulation.ps1 Diagnose
```

setup.ps1 为 .env 生成随机密码，不覆盖已有配置。默认数据库使用独立的 _demo 后缀，SQL 初始化仅用于空数据卷。停止使用 `./scripts/dev.ps1 Down`，保留数据卷。

入口等待十个服务和 API 就绪后，访问 http://127.0.0.1:8080。静态部署无需 Vite，同源 `/api` 转发到本机网关；模拟支付只监听 127.0.0.1:18170。`simulation.ps1 Stop` 停业务和模拟网关并保留数据，基础设施可继续运行；另外执行 dev.ps1 Down 可停止容器且保留卷。模拟配置独立保存在 Git 忽略目录，不覆盖 `.env`。开发时仍可在 gulimall-web 执行 npm run dev，访问 5173。

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
$checks = @(Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
node --test @checks
./scripts/scripts.test.ps1
# Windows 重建 jar 前先停止服务。
./scripts/simulation.ps1 Stop
./scripts/dev.ps1 Build
./scripts/simulation.ps1 Start
# 串行运行，会暂时停止演示环境，结束后恢复：
./scripts/test.ps1 -Suite All
./scripts/test.ps1 -Suite Diagnostics
node gulimall-web/node_modules/@playwright/test/cli.js install chromium
# Browser 同时需要本机 Microsoft Edge；启动前先检查，缺失不会暂停常驻环境。
./scripts/test.ps1 -Suite Browser
./scripts/test.ps1 -Suite Recovery
# Demo 冷备份的完整恢复采用独立入口及原匹配密钥，见上面的恢复说明：
# ./scripts/demo-restore.ps1 -Backup .data/backups/实际目录 -PaymentConfig .tools/simulation/payment-config.json
```

默认检查不连接业务库：阶段 27 Java 33、Node 40、PowerShell 自检与前端 lint/build 通过；旧 9 类/17 方法忽略不计通过。阶段 27 运行 Admin 10 个业务场景及 Browser 22 项（含 Chromium 两轮完整链和 Edge），没有重跑完整 All、Diagnostics 故障套件或 Recovery；All 72 场景及两类隔离恢复继续引用阶段 26，最终只读诊断 18 项健康。自然 30 分钟沿用阶段 13，订单状态机与期限未变。测试仅使用独立 gulimall-test 和 _test 库；成功/失败均恢复原模式，不清理人工交易，不可与人工演示或另一轮测试并行。

成功/失败交易分别运行 `./scripts/test.ps1 -Suite Success` / `Failure`。演示库冷备份运行 `./scripts/backup.ps1 -Environment Demo`，模拟模式同时暂停网关并保存支付台账；匹配签名密钥须单独私有保管。恢复先在全新实例验证，具体步骤见 [运行手册](docs/RUNBOOK.md)。SQL、Redis、图片、台账与校验清单保存于 Git 忽略的私有目录，不覆盖源数据。

`./scripts/backup-audit.ps1 -Backup <备份目录>` 在临时 MySQL/Redis 中只读核对演示快照、交易关联和数据完整性，不启动业务补偿或覆盖原环境；报告保存在 .tools，结束清理本次实例与卷。

后置内容：真实沙箱与公网回调、真实短信/OSS、技术栈升级、自动退款售后、角色权限和运营报表。当前未提供高可用集群、在线热备或负载容量承诺。
