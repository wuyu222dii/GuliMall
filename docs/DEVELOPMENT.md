# 本地开发基线（阶段 0）

当前业务仍包含模拟登录和占位下单。构建通过不代表交易闭环已完成，进度见 [implementation-plan.md](implementation-plan.md)。

## 工具与配置

需要 JDK **8**、Maven 3.6+、Node 20.19+/npm，以及 Docker Desktop Linux 容器引擎和 Compose v2（支持 `up --wait`）。设置 `JAVA_HOME`，将 Maven、Node/npm 和 Docker 加入 PATH。

本次实际验证：Temurin 8u504、Maven 3.8.1、Node 24.22.1、npm 10.9.2。Docker Desktop 4.96.3（CLI 29.9.2、Compose 5.6.1）和 WSL 3.0.3 已安装，虚拟机平台需要重启后生效。系统 Java 没有改动，本机隔离工具不随 Git 分发。当前机器的续跑说明见 [DOCKER-SETUP.md](DOCKER-SETUP.md)。

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 Check
```

`setup.ps1` 仅在 `.env` 不存在时创建配置，随机生成数据库、Redis、RabbitMQ 密码，再次执行不覆盖凭据。`.env`、`.tools/`、`.data/` 不进入 Git。上传目录预留为 `.data/uploads`。

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

1. `infra/mysql/001-schema.sql`：五个 `_demo` 数据库、68 张与现有实体对应的表，以及本地应用用户授权。
2. `infra/mysql/002-demo.sql`：两个会员、三级分类、品牌、规格、一个双 SKU 商品、仓库、库存与收货地址。

数据库为 `gulimall_pms_demo`、`gulimall_sms_demo`、`gulimall_ums_demo`、`gulimall_oms_demo`、`gulimall_wms_demo`。应用用 `gulimall` 用户，不使用 root，密码来自 `.env`。

基线根据实体重建，不是原数据库的完整导出。会员模块中还存在营销表实体，因此 UMS 演示库也包含这些实体所需表；本阶段没有调整源码中的业务归属。

演示 SPU 为 900001；SKU 900001 为 1999.00、库存 10，SKU 900002 为 2099.00、库存 1。演示图片在前端 `/demo-product.svg`。会员 `demo_a`、`demo_b` 的预置 BCrypt 密码均为 `Demo12345!`；真实登录仍待阶段 1 实现。

**禁止对已有数据库执行初始化脚本。** 基线不使用 DROP、TRUNCATE、INSERT IGNORE 或 CREATE TABLE IF NOT EXISTS 掩盖冲突。已有数据必须先备份、对比真实结构，再用独立增量迁移；新增唯一约束先检查重复记录。

已有数据卷修改 `.env` 密码不会自动修改数据库用户密码。初始化失败先查看 `docker compose logs mysql`，不要删卷重试。仓库旧的 `dump.rdb` 不自动导入。

## 构建与安全检查

```powershell
node --test scripts/baseline.test.mjs
./scripts/scripts.test.ps1
./scripts/dev.ps1 Build
```

`Build` 执行 Maven install（编译、测试、打包），再执行前端 npm ci 和 npm run build。不要求 Docker 引擎，也不通过跳过整个测试阶段掩盖问题。

原有 9 个 `*ApplicationTests` 为手工集成演示，其中有写 MySQL/Redis、发送短信和上传 OSS 的行为，已添加 `@Ignore`。先改为使用独立测试库、服务替身和断言，再启用；不要直接取消忽略。

新增检查包括：

- Java：短信 Feign 参数契约、默认不加载付费云组件。
- Node：实体/SQL 覆盖、种子数据列匹配、数据库和凭据隔离。
- PowerShell：脚本语法、随机凭据、非覆盖初始化、字面值加载、环境优先级和非法配置拒绝。

这些本地检查没有执行 MySQL SQL，也没有验证库存并发或支付。

前端 lint 仍有原有的 ProductCard props 校验错误（6 条），记录为阶段 2 修复项，没有关闭规则掩盖错误。生成器 Oracle/SQL Server 驱动在 `legacy-database-drivers` 可选 profile 内，本次未验证该 profile。

订单模块未使用的 Seata starter 已移除，符合本轮采用本地事务和补偿的决策，不要求额外启动 Seata 服务。

已在禁用服务发现、使用随机本机端口的条件下验证网关、搜索、第三方服务能启动，随后停止进程，未发起业务请求。认证服务已越过原有 Feign 参数错误，但因为 Redis 尚未启动而失败；这不构成完整服务链验收。

## 启动业务服务

完成 Up 和 Build 后，每个服务单独开终端运行：

```powershell
./scripts/dev.ps1 Run -Module gulimall-product
# 依次启动 member、coupon、ware，再启动 search、order、auth-server、third-party
./scripts/dev.ps1 Run -Module gulimall-gateway
```

模块参数使用完整名称，如 `gulimall-member`。默认业务端口：商品 **10001**（`.env` 的 PRODUCT_PORT，避开已发现的 10000 端口占用）、会员 8000、营销 7001、库存 11000、搜索 12000、订单 9000、认证 20000、第三方 30000、网关 88。业务服务默认仅监听本机。生成器为 8088，不是必要启动项。

```powershell
cd gulimall-web
npm run dev
```

前端为 5173。Vite 分类代理只读取根目录 `.env` 的 PRODUCT_ 前缀，避免将数据库秘密加载到前端；各服务直连代理在阶段 1 统一收口。

云 OSS/真实短信默认关闭，避免启动时就要求付费账号。只有显式设置 OSS_ENABLED=true / SMS_ENABLED=true 并提供凭据才加载。这不代表开发验证码、本地上传或云服务已完成联调。

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
