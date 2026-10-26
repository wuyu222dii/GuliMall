# 本地开发与运行验收

阶段 0–17 本地验收已通过，真实第三方继续后置。日常演示统一使用 `./scripts/simulation.ps1 Start|Stop|Status|Diagnose`，浏览器 8080，持久模拟支付网关 18170；准备好构建产物后无需手工替换支付配置，见 [SIMULATION.md](SIMULATION.md)。独立测试与备份恢复见 [RUNBOOK.md](RUNBOOK.md)，中文交接见 [DEMO-HANDOFF.md](DEMO-HANDOFF.md)。下单见 [ORDERS.md](ORDERS.md)，支付与消息边界见 [PAYMENTS.md](PAYMENTS.md)，履约见 [FULFILLMENT.md](FULFILLMENT.md)，整体进度见 [implementation-plan.md](implementation-plan.md)。

## 工具与配置

首次交接先看 [干净目录与预检](HANDOFF-SETUP.md)：不依赖其他人的私有 .tools，Build/Environment/Simulation 分别检查构建、本地基础环境和启动条件；同机隔离验收不代表独立机器通过。

需要 JDK **8**、Maven 3.6+、Node 20.19+/npm，以及 Docker Desktop Linux 容器引擎和 Compose v2（支持 `up --wait`）。设置 `JAVA_HOME`，将 Maven、Node/npm 和 Docker 加入 PATH。

本次实际验证：Temurin 8u504、Maven 3.8.1、Node 24.22.1、npm 10.9.2。Docker Desktop 4.96.3（CLI/Engine 29.9.2、Compose 5.6.1）和 WSL 3.0.3 已安装，重启后 Linux 引擎与五个容器均正常。系统 Java 没有改动，本机隔离工具不随 Git 分发。当前机器说明见 [DOCKER-SETUP.md](DOCKER-SETUP.md)。

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 Check
```

`setup.ps1` 仅在 `.env` 不存在时创建配置，随机生成数据库、Redis、RabbitMQ 密码和内部调用令牌，再次执行不覆盖凭据。旧配置需按 `.env.example` 补齐新字段。`.env`、`.tools/`、`.data/` 不进入 Git。上传目录预留为 `.data/uploads`，实际上传接口在阶段 3 实现。

配置使用 `NAME=value`，不能写 shell 表达式。带 `$` 的 BCrypt 摘要用单引号包裹。加载器保留字面值；调用者已设置的进程环境变量优先于 `.env`。直接从 IDE 启动时，也必须配置这些环境变量。

## 基础设施

```powershell
./scripts/dev.ps1 Up
./scripts/dev.ps1 Status
```

Compose 项目名为 `gulimall-demo`，端口仅绑定本机，数据使用独立命名卷。

| 服务 | 镜像基线 | 本机端口 | 持久化卷 |
|---|---|---:|---|
| MySQL | `mysql:8.0.36` | 3307 | mysql-data |
| Redis | `redis:6.2.16-alpine` | 6380 | redis-data，AOF |
| Nacos | `nacos/nacos-server:v2.1.0` | 18848、19848 | nacos-data、nacos-logs |
| Elasticsearch | `elasticsearch:7.10.2` | 19200 | es-data |
| RabbitMQ | `rabbitmq:3.13.7-management-alpine` | 5673、15673 | rabbitmq-data |

端口与常见本机安装隔离。MySQL、Redis、AMQP 端口可以在 `.env` 配置；Nacos 主端口和 gRPC 端口映射必须保持偏移一致。配置中心默认关闭，服务发现启用，不再依赖其他机器上的 namespace/data-id。

## 数据库与演示数据

MySQL 镜像仅在**空数据卷首次初始化**时执行：

1. `infra/mysql/001-schema.sql`：五个 `_demo` 数据库、71 张表（68 张实体表、商品同步任务、订单提交记录与交易事件），以及本地应用用户授权。
2. `infra/mysql/002-demo.sql`：两个会员、三级分类、品牌、规格、一个双 SKU 商品、仓库、库存与收货地址。

数据库为 `gulimall_pms_demo`、`gulimall_sms_demo`、`gulimall_ums_demo`、`gulimall_oms_demo`、`gulimall_wms_demo`。应用用 `gulimall` 用户，不使用 root，密码来自 `.env`。

基线根据实体重建，不是原数据库的完整导出。会员模块中还存在营销表实体，因此 UMS 演示库也包含这些实体所需表；本阶段没有调整源码中的业务归属。

演示 SPU 为 900001；SKU 900001 为 1999.00、库存 10，SKU 900002 为 2099.00、库存 1。演示图片在前端 `/demo-product.svg`。会员 `demo_a`、`demo_b` 的预置 BCrypt 密码均为 `Demo12345!`，可真实登录演示环境。

**禁止对已有数据库执行初始化脚本。** 基线不使用 DROP、TRUNCATE、INSERT IGNORE 或 CREATE TABLE IF NOT EXISTS 掩盖冲突。已有数据必须先备份、对比真实结构，再用独立增量迁移；新增唯一约束先检查重复记录。

已有数据卷修改 `.env` 密码不会自动修改数据库用户密码。初始化失败先查看 `docker compose logs mysql`，不要删卷重试。仓库旧的 `dump.rdb` 不自动导入。

## 构建与安全检查

```powershell
$checks = @(Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
node --test @checks
./scripts/scripts.test.ps1
./scripts/dev.ps1 Build
```

`Build` 执行 Maven install（编译、测试、打包），再执行前端 npm ci 和 npm run build。不要求 Docker 引擎，也不通过跳过整个测试阶段掩盖问题。

原有 9 个 `*ApplicationTests` 为手工集成演示，其中有写 MySQL/Redis、发送短信和上传 OSS 的行为，已添加 `@Ignore`。先改为使用独立测试库、服务替身和断言，再启用；不要直接取消忽略。

新增检查包括：

- Java：认证、商品、图片、搜索、购物车、订单与锁库，以及 RSA2、金额边界、履约门禁、测试环境保护、管理员摘要工具、网关来源限制、短信失败清理、存储替换及安全处理进度，共 29 项。
- Node：基线、商品、购物车、支付、安全回跳、订单、真实库名保护、静态部署、模拟台账/重试、诊断、错误边界、trace 脱敏、启动前拒绝、备份审计、原子配置拒绝及阶段 19 Edge 预检/确认页回跳，共 32 项。先安装锁定的前端开发依赖，默认检查仍不连接业务库。
- PowerShell：脚本语法、随机凭据、非覆盖初始化、字面值加载、环境优先级和非法配置拒绝。

这些默认检查不连接数据库。阶段 9 起统一以 `./scripts/test.ps1 -Suite All` 运行 68 个业务场景，使用独立 Compose 项目、卷和五个 `_test` 库；会暂停演示环境，结束后恢复。直接向演示库运行 acceptance 脚本会被拒绝。支付使用独立测试密钥与 RabbitMQ 虚拟主机，真实沙箱尚待开通后验收。故障验收必须串行运行，详见 [RUNBOOK.md](RUNBOOK.md)。

阶段 2 已修复 ProductCard props 校验，前端 lint 通过，未关闭规则。生成器 Oracle/SQL Server 驱动在 `legacy-database-drivers` 可选 profile 内，本次未验证该 profile。

订单模块未使用的 Seata starter 已移除，符合本轮采用本地事务和补偿的决策，不要求额外启动 Seata 服务。

2026-10-24 已验证九个业务服务实际启动、Nacos 健康注册、网关商品查询、真实注册登录与权限隔离；MySQL、Redis 和上传目录的专用标记在容器停止重建后保留。

## 启动业务服务

完成 Up 和 Build 后，每个服务单独开终端运行：

```powershell
./scripts/dev.ps1 Run -Module gulimall-product
# 依次启动 member、coupon、ware，再启动 search、order、auth-server、third-party
./scripts/dev.ps1 Run -Module gulimall-gateway
```

Windows 也可统一后台启动，使用已构建的 jar，日志写入 `.tools/runtime`：

```powershell
./scripts/services.ps1 Start
./scripts/dev.ps1 Smoke
./scripts/services.ps1 Stop
# 仅操作单个服务：
./scripts/services.ps1 Start -Modules ware
# 购物车服务：
./scripts/services.ps1 Start -Modules cart
```

Start 只表示进程已创建，需等待 Nacos 注册与 Smoke 成功。Stop 仅匹配本工作区标记与完整 jar 路径，不停止其他项目/IDE JVM；通过 IDE 或 dev.ps1 Run 启动的进程应在各自终端停止。阶段 2 的自动故障验收要求仓储服务由 services.ps1 启动。

模块参数使用完整名称，如 `gulimall-member`。默认业务端口：商品 **10001**（`.env` 的 PRODUCT_PORT，避开已发现的 10000 端口占用）、会员 8000、营销 7001、库存 11000、搜索 12000、订单 9000、购物车 18000、认证 20000、第三方 30000、网关 88。业务服务默认仅监听本机。生成器为 8088，不是必要启动项。

```powershell
cd gulimall-web
npm run dev
```

前端仅监听 `127.0.0.1:5173`，浏览器全部请求 `/api`，Vite 统一代理到网关 `127.0.0.1:88`；没有业务服务直连代理，也不加载根目录秘密到前端。请统一使用 `127.0.0.1`，避免与 localhost 的 Cookie 混用。

云 OSS/真实短信默认关闭，避免启动时就要求付费账号。只有显式设置 OSS_ENABLED=true / SMS_ENABLED=true 并提供凭据才加载。阶段 1 验证码需同时启用 `dev` profile 和 `AUTH_SMS_MODE=development`，页面明确显示开发模式；真实短信仍待后续接入。本地图片上传已在阶段 3 完成，目录由 `UPLOAD_DIR` 控制，默认 `.data/uploads`，不随 jar 重建清除。

阶段 3 已有库必须先核对重复库存，再执行一次 `infra/migrations/002-procurement.sql`；当前机器已迁移，不要重复运行。空库基线已包含该变更。录入、采购流程和验收命令见 [ADMINISTRATION.md](ADMINISTRATION.md)。

阶段 4 新增商品库同步任务表，已有库确认表不存在并备份后执行一次 `infra/migrations/003-search-sync.sql`，当前机器已完成；当前演示库共 69 张表。运行 `./scripts/search-index.ps1` 创建/检查映射，再由管理员在 `/admin/products/sync` 排入全量重建任务。脚本保留已有文档；索引丢失可重建，不删除商品数据。搜索故障验收会停止 ES 并删除/恢复本项目派生索引，限独立本机演示环境，详见 [SEARCH.md](SEARCH.md)。

阶段 5 新增 `gulimall-cart`：当前聚合构建十三个项目、后台启动十个业务服务；购物车使用已有 Redis AOF 卷，无新增 SQL 表。共享 Session 和网关保护，详情/加购/结算按最新商品状态处理。合并协议、运行验收及恢复边界见 [CART.md](CART.md)。

阶段 6 新增订单提交记录与订单/库存约束，当前演示库为 70 张表。已有数据先备份并执行一次 `infra/migrations/004-order-creation.sql`，不要重跑空库初始化。订单状态、确认令牌、故障恢复和验收见 [ORDERS.md](ORDERS.md)。

阶段 7 新增交易事件表和支付/库存结果字段，当前为 71 张表。已有库停服务、备份并检查重复交易号后执行一次 `infra/migrations/005-payments-events.sql`。支付宝配置和公网验收待账号开通；本地测试模式必须显式启用，并与沙箱明确区分，见 [PAYMENTS.md](PAYMENTS.md)。

阶段 8 复用已有物流、收货时间和订单历史字段，无新增迁移，仍为 71 张表、十个业务服务。管理后台按订单号/状态查询并填写物流，会员查看详情、确认收货或取消待付款订单；取消复用阶段 7 的支付关闭确认与库存释放，不直接改状态或释放未知结果库存。当前验收入口为 `./scripts/test.ps1 -Suite Fulfillment`，范围见 [FULFILLMENT.md](FULFILLMENT.md)。

阶段 9 提供静态部署 `deploy.ps1 Build/Start/Stop`，浏览器访问 `127.0.0.1:8080`，无需 Vite；浏览器仅走同源 `/api`。`test.ps1 -Suite Success/Failure/Recovery` 提供两套真实业务接口演示及全新实例恢复验证。冷备份、Redis AOF 导入、消息重放、图片与搜索恢复步骤见 [运行手册](RUNBOOK.md)。不新增业务表，不改已有演示库。

阶段 10–13 新增常驻模拟入口、持久支付台账与五秒通知重试，保留原支付协议；测试与备份结束恢复原模拟模式。短信提取 SmsSender，图片提取 ImageStorage，统一校验和重新编码后写本地；通用上传 `/api/admin/thirdparty/images` 和旧 local/images 均可用。未实现的真实短信或非 local 存储模式明确拒绝启动。无新增业务表或第三方依赖，不升级技术栈。浏览器和自然期限验收保留独立命名的演示商品、会员与订单，原始种子库存不变。

Windows 上重建 jar 前须先停止对应业务服务，避免正在运行的 jar 被占用。当前机器可使用 `. ./.tools/enter-dev.ps1` 加载工具；启动和停止统一使用已提交的 `scripts/services.ps1`。`.tools/enter-dev.ps1` 仅供此机器使用，其他机器应配置自己的 JAVA_HOME 和 PATH。

## Docker 就绪后的阶段 0 验收

```powershell
./scripts/dev.ps1 Check
./scripts/dev.ps1 Up
# 启动商品和网关，等待 Nacos 注册
./scripts/dev.ps1 Smoke
```

Smoke 经网关查询演示分类及 SKU 900001 的价格，不修改数据库。

1. 核对商品与库存；在 Redis 写专用验收键，在 `.data/uploads` 写验收文件。
2. 执行 `./scripts/dev.ps1 Down`，再 Up；Down 不删除数据卷。
3. 重启业务服务，再次 Smoke，核对数据库、Redis 键与上传文件。
4. 检查全部容器健康和日志，记录实际结果后再将阶段 0 标记通过。

不要运行 `docker compose down -v`。2026-10-24 已完成重启、全服务运行及持久化验收，阶段 0 通过，详情见实施检查点。
