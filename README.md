# 谷粒商城（gulimall001）

基于 Spring Boot 2.1.8 + Spring Cloud Greenwich + Nacos 的微服务电商项目。

## 模块说明

| 模块 | 说明 | 默认端口 | 是否可独立运行 |
|------|------|----------|----------------|
| `gulimall-common` | 公共工具类、通用依赖 | — | 否（无启动类） |
| `gulimall-product` | 商品服务 | 10000 | 是 |
| `gulimall-coupon` | 优惠券服务 | 7001 | 是 |
| `gulimall-member` | 会员服务 | 8000 | 是 |
| `gulimall-order` | 订单服务 | 9000 | 是 |
| `gulimall-search` | 检索服务 | 12000 | 是 |
| `gulimall-ware` | 仓储服务 | 11000 | 是 |
| `gulimall-gateway` | API 网关 | 88 | 是 |
| `gulimall-third-party` | 第三方服务（OSS 等） | 30000 | 是 |
| `gulimall-auth-server` | 认证中心 | 20000 | 是 |
| `renren-generator` | 代码生成器 | 80 | 是 |
| `gulimall-web` | **React 前端** | 5173 | 是（`npm run dev`） |

> **注意**：`gulimall-common` 是公共依赖库，**不能**执行 `mvn spring-boot:run`。请在各业务模块目录下启动服务。

## React 前端

前端项目位于 `gulimall-web/`，使用 React + Vite 构建，对接微服务网关与各业务 API。

```bash
cd gulimall-web
npm install
npm run dev    # http://localhost:5173
```

主要页面：首页、商品搜索、商品详情、购物车、结算、登录/注册、我的订单、收货地址管理。

详见 [gulimall-web/README.md](gulimall-web/README.md)。

## 环境要求

| 组件 | 版本/说明 |
|------|-----------|
| JDK | 1.8（必须，项目不兼容高版本 JDK） |
| Maven | 3.6+ |
| MySQL | 8.x，需提前创建以下数据库 |
| Redis | 商品、认证等服务依赖，默认 `127.0.0.1:6379` |
| Nacos | 服务注册与配置中心，默认 `127.0.0.1:8848`（可选，未启动时部分服务仍可运行，但会打印注册失败日志） |

### MySQL 数据库

项目使用以下数据库（用户名/密码见各模块 `application.yml`，默认 `root` / `Wuyujian`）：

```
gulimall_pms   # 商品
gulimall_sms   # 优惠券/营销
gulimall_ums   # 会员
gulimall_oms   # 订单
gulimall_wms   # 仓储
gulimall_admin # 后台（如有）
```

### Redis 启动

```bash
# 方式一：直接启动（推荐，无需 brew 安装）
redis-server --daemonize yes

# 方式二：Homebrew 管理（需先 brew install redis）
brew install redis
brew services start redis
```

### Nacos 启动（可选）

```bash
# Docker 方式
docker run -d --name nacos -p 8848:8848 -e MODE=standalone nacos/nacos-server:v2.1.0
```

## 构建项目

在项目根目录执行：

```bash
# 切换到 JDK 8
jdk8

# 全量编译打包（跳过测试）
mvn clean install -DskipTests
```

## 启动服务

进入对应模块目录，执行：

```bash
jdk8
mvn spring-boot:run -DskipTests
```

### 各模块启动示例

```bash
# 商品服务（依赖 Redis）
cd gulimall-product && mvn spring-boot:run -DskipTests

# 仓储服务
cd gulimall-ware && mvn spring-boot:run -DskipTests

# 优惠券服务
cd gulimall-coupon && mvn spring-boot:run -DskipTests

# 会员服务
cd gulimall-member && mvn spring-boot:run -DskipTests

# 订单服务
cd gulimall-order && mvn spring-boot:run -DskipTests

# 代码生成器（避免 80 端口冲突时可指定端口）
cd renren-generator && mvn spring-boot:run -DskipTests -Dspring-boot.run.arguments=--server.port=8088
```

### 启动顺序建议

完整联调时建议按以下顺序启动基础设施和业务服务：

1. MySQL、Redis、Nacos
2. `gulimall-product`、`gulimall-member`、`gulimall-ware`、`gulimall-coupon`
3. `gulimall-order`、`gulimall-search`、`gulimall-third-party`、`gulimall-auth-server`
4. `gulimall-gateway`（网关依赖其他服务已注册到 Nacos）

## 已修复问题（feature-gulimall_p27）

本次修复使项目达到**可编译、可启动**状态，主要变更如下：

### 1. 编译错误修复

- **gulimall-order**：新增缺失的 `AlipayTemplate` 支付宝配置类
- **gulimall-order**：补全 `OrderService` 接口方法（`confirmOrder`、`submitOrder`、`getOrderPay`、`getMemberOrderPage`）及实现
- **JUnit 测试**：将 `gulimall-order`、`gulimall-member`、`gulimall-ware`、`gulimall-coupon` 的 JUnit 5 测试改为 JUnit 4，与 Spring Boot 2.1.8 保持一致

### 2. 配置修复

- **gulimall-coupon**：恢复被注释的 `application.yml`（数据库连接、端口 7001）
- **gulimall-order**：补充 `application.yml` 中支付宝沙箱配置占位项

### 3. 常见启动错误

| 错误 | 原因 | 处理 |
|------|------|------|
| `No plugin found for prefix 'spring-boot'` | 在 `gulimall-common` 等非 Boot 模块运行 | 切换到具体业务模块目录 |
| `Unable to connect to Redis` | Redis 未启动 | 执行 `redis-server --daemonize yes` |
| `nacos registry ... register failed` | Nacos 未启动 | 启动 Nacos，或忽略（部分服务仍可运行） |
| `Address already in use` | 端口被占用 | 修改对应模块 `application.yml` 中的 `server.port` |

## 待完善功能

以下功能当前为**占位实现**，完整业务逻辑尚未接入：

- **订单确认/提交**（`confirmOrder`、`submitOrder`）：需接入 Feign 远程调用、Redis 防重令牌、库存锁定、RabbitMQ 等
- **支付宝支付**：`AlipayTemplate` 中密钥为占位值，需替换为支付宝沙箱真实配置

## 技术栈

- Spring Boot 2.1.8.RELEASE
- Spring Cloud Greenwich.SR3
- Spring Cloud Alibaba 2.1.0.RELEASE
- MyBatis-Plus 3.2.0
- Nacos（服务发现 + 配置中心）
- Redis / Redisson
- RabbitMQ（订单模块）
- Seata（订单模块分布式事务）
- Thymeleaf（部分模块页面渲染）

## 目录结构

```
gulimall001/
├── gulimall-common/        # 公共模块（不可运行）
├── gulimall-product/       # 商品服务
├── gulimall-coupon/        # 优惠券服务
├── gulimall-member/        # 会员服务
├── gulimall-order/         # 订单服务
├── gulimall-search/        # 检索服务
├── gulimall-ware/          # 仓储服务
├── gulimall-gateway/       # 网关
├── gulimall-third-party/   # 第三方服务
├── gulimall-auth-server/   # 认证中心
├── renren-generator/       # 代码生成器
└── pom.xml                 # 父 POM
```
