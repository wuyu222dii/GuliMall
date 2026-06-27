# Gulimall (gulimall001)

A microservices e-commerce project built on Spring Boot 2.1.8 + Spring Cloud Greenwich + Nacos.

## Module Overview

| Module | Description | Default Port | Standalone Runnable |
|------|------|----------|----------------|
| `gulimall-common` | Shared utilities and common dependencies | — | No (no main class) |
| `gulimall-product` | Product service | 10000 | Yes |
| `gulimall-coupon` | Coupon service | 7001 | Yes |
| `gulimall-member` | Member service | 8000 | Yes |
| `gulimall-order` | Order service | 9000 | Yes |
| `gulimall-search` | Search service | 12000 | Yes |
| `gulimall-ware` | Warehouse service | 11000 | Yes |
| `gulimall-gateway` | API gateway | 88 | Yes |
| `gulimall-third-party` | Third-party services (OSS, etc.) | 30000 | Yes |
| `gulimall-auth-server` | Authentication center | 20000 | Yes |
| `renren-generator` | Code generator | 80 | Yes |
| `gulimall-web` | **React frontend** | 5173 | Yes (`npm run dev`) |

> **Note**: `gulimall-common` is a shared dependency library and **cannot** be started with `mvn spring-boot:run`. Start services from individual business module directories.

## React Frontend

The frontend project is located at `gulimall-web/`, built with React + Vite, and connects to the microservices gateway and business APIs.

```bash
cd gulimall-web
npm install
npm run dev    # http://localhost:5173
```

Main pages: home, product search, product detail, shopping cart, checkout, login/register, my orders, shipping address management.

See [gulimall-web/README.md](gulimall-web/README.md) for details.

## Environment Requirements

| Component | Version / Notes |
|------|-----------|
| JDK | 1.8 (required; the project is not compatible with newer JDK versions) |
| Maven | 3.6+ |
| MySQL | 8.x; create the following databases in advance |
| Redis | Required by product, auth, and other services; default `127.0.0.1:6379` |
| Nacos | Service registry and config center; default `127.0.0.1:8848` (optional; some services can still run without Nacos, but registration failure logs will be printed) |

### MySQL Databases

The project uses the following databases (username/password in each module's `application.yml`, default `root` / `Wuyujian`):

```
gulimall_pms   # Product
gulimall_sms   # Coupon / marketing
gulimall_ums   # Member
gulimall_oms   # Order
gulimall_wms   # Warehouse
gulimall_admin # Admin (if applicable)
```

### Starting Redis

```bash
# Option 1: Start directly (recommended; no brew install required)
redis-server --daemonize yes

# Option 2: Managed via Homebrew (requires brew install redis first)
brew install redis
brew services start redis
```

### Starting Nacos (Optional)

```bash
# Docker
docker run -d --name nacos -p 8848:8848 -e MODE=standalone nacos/nacos-server:v2.1.0
```

## Building the Project

Run from the project root:

```bash
# Switch to JDK 8
jdk8

# Full compile and package (skip tests)
mvn clean install -DskipTests
```

## Starting Services

Navigate to the corresponding module directory and run:

```bash
jdk8
mvn spring-boot:run -DskipTests
```

### Module Startup Examples

```bash
# Product service (depends on Redis)
cd gulimall-product && mvn spring-boot:run -DskipTests

# Warehouse service
cd gulimall-ware && mvn spring-boot:run -DskipTests

# Coupon service
cd gulimall-coupon && mvn spring-boot:run -DskipTests

# Member service
cd gulimall-member && mvn spring-boot:run -DskipTests

# Order service
cd gulimall-order && mvn spring-boot:run -DskipTests

# Code generator (specify port to avoid port 80 conflicts)
cd renren-generator && mvn spring-boot:run -DskipTests -Dspring-boot.run.arguments=--server.port=8088
```

### Recommended Startup Order

For full end-to-end integration, start infrastructure and business services in this order:

1. MySQL, Redis, Nacos
2. `gulimall-product`, `gulimall-member`, `gulimall-ware`, `gulimall-coupon`
3. `gulimall-order`, `gulimall-search`, `gulimall-third-party`, `gulimall-auth-server`
4. `gulimall-gateway` (the gateway depends on other services being registered in Nacos)

## Fixed Issues (feature-gulimall_p27)

This fix brings the project to a **compilable and runnable** state. Main changes:

### 1. Compilation Error Fixes

- **gulimall-order**: Added missing `AlipayTemplate` Alipay configuration class
- **gulimall-order**: Completed `OrderService` interface methods (`confirmOrder`, `submitOrder`, `getOrderPay`, `getMemberOrderPage`) and their implementations
- **JUnit tests**: Migrated JUnit 5 tests in `gulimall-order`, `gulimall-member`, `gulimall-ware`, and `gulimall-coupon` to JUnit 4 to align with Spring Boot 2.1.8

### 2. Configuration Fixes

- **gulimall-coupon**: Restored commented-out `application.yml` (database connection, port 7001)
- **gulimall-order**: Added Alipay sandbox configuration placeholders in `application.yml`

### 3. Common Startup Errors

| Error | Cause | Resolution |
|------|------|------|
| `No plugin found for prefix 'spring-boot'` | Running in non-Boot modules like `gulimall-common` | Switch to a specific business module directory |
| `Unable to connect to Redis` | Redis is not running | Run `redis-server --daemonize yes` |
| `nacos registry ... register failed` | Nacos is not running | Start Nacos, or ignore (some services can still run) |
| `Address already in use` | Port is already in use | Change `server.port` in the corresponding module's `application.yml` |

## Pending Features

The following features are currently **placeholder implementations**; full business logic is not yet integrated:

- **Order confirmation/submission** (`confirmOrder`, `submitOrder`): Requires Feign remote calls, Redis anti-replay tokens, inventory locking, RabbitMQ, etc.
- **Alipay payment**: Keys in `AlipayTemplate` are placeholder values; replace with real Alipay sandbox configuration

## Tech Stack

- Spring Boot 2.1.8.RELEASE
- Spring Cloud Greenwich.SR3
- Spring Cloud Alibaba 2.1.0.RELEASE
- MyBatis-Plus 3.2.0
- Nacos (service discovery + config center)
- Redis / Redisson
- RabbitMQ (order module)
- Seata (distributed transactions in order module)
- Thymeleaf (page rendering in some modules)

## Directory Structure

```
gulimall001/
├── gulimall-common/        # Common module (not runnable)
├── gulimall-product/       # Product service
├── gulimall-coupon/        # Coupon service
├── gulimall-member/        # Member service
├── gulimall-order/         # Order service
├── gulimall-search/        # Search service
├── gulimall-ware/          # Warehouse service
├── gulimall-gateway/       # Gateway
├── gulimall-third-party/   # Third-party services
├── gulimall-auth-server/   # Authentication center
├── renren-generator/       # Code generator
└── pom.xml                 # Parent POM
```
