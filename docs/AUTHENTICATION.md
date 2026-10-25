# 阶段 1：身份、权限与运行验收

## 当前行为

会员真实注册，用户名或手机号登录；密码使用 BCrypt（cost 10），拒绝超过 72 UTF-8 字节的密码。用户名和手机号在数据库中有唯一约束。响应和 Session 仅保存必要身份字段，不返回密码、摘要或社交令牌。

所有 Servlet 业务服务共享 Redis **DB 0** 的 `gulimall:session` 会话，空闲有效期 2 小时。登录/注册成功更换会话 ID 和 CSRF Token，退出销毁服务端会话。Cookie 名 `GULIMALLSESSION`，HttpOnly、SameSite=Lax、Path=/；本机 HTTP 使用 Secure=false。未来 HTTPS 部署需设置 `gulimall.session.secure=true`。

## 浏览器接口

| 方法与网关路径 | 内容 |
|---|---|
| GET `/api/auth/csrf` | 创建匿名会话，返回 csrfToken |
| POST `/api/auth/sms/code` | `{phone}`，仅开发模式，返回明确标识的 developmentCode |
| POST `/api/auth/register` | `{username, phone, password, code}`，成功后登录 |
| POST `/api/auth/login` | `{username, password}`，username 也可填手机号 |
| POST `/api/auth/admin/login` | 同上，独立管理员身份 |
| GET `/api/auth/me` | 当前身份 `{id, username, admin}`，匿名 401 |
| POST `/api/auth/logout` | 销毁 Session |
| GET/POST/DELETE `/api/member/addresses` | 当前会员列表、新增、批量删除（ID 数组） |
| GET/PUT `/api/member/addresses/{id}` | 当前会员地址详情、修改 |
| GET `/api/order/mine`、`/api/order/mine/{id}` | 当前会员订单列表、详情 |
| GET `/api/order/pay?orderSn=...` | 旧支付表单入口已增加归属校验；真实支付验收在阶段 7 |

沿用 `R` / `PageUtils`；同时设置真实 HTTP 状态：401 未登录、403 越权或 CSRF、400 参数错误、409 唯一冲突、429 频率限制。客户端必须保存 Cookie，修改请求携带 `X-CSRF-Token`；成功登录后用响应中的新 Token。

地址和订单忽略客户端会员 ID，以 Session 为准。旧生成式 CRUD 只允许管理员使用，管理路径为 `/api/admin/{service}/...`。普通会员不能上传管理图片、写商品或库存。管理业务页面在阶段 3 开发。

## 开发验证码与管理员

`.env` 中同时满足 `SPRING_PROFILES_ACTIVE=dev` 与 `AUTH_SMS_MODE=development` 才启用开发验证码；激活 prod/production 时拒绝启用。验证码 10 分钟有效、60 秒发送间隔、最多 5 次错误校验；注册成功后原子消费。用户名冲突不会消费有效验证码；并发重复注册由数据库唯一约束兜底。登录账号每分钟最多 10 次尝试。

管理员账号由 `ADMIN_USER`、`ADMIN_PASSWORD_HASH`（BCrypt 摘要）配置。空摘要拒绝登录，不内置默认管理员密码。摘要含 `$`，在 `.env` 中使用单引号包裹；只把摘要放进服务配置，明文仅保存在个人密码管理器。本机此次生成的随机管理员凭据保存在 Git 忽略的 `.tools/admin-access.json`，文件与 `.env` 已限制为当前用户、SYSTEM 和 Administrators 访问。不要提交或分享该文件。

`setup.ps1` 为全新配置生成随机 `INTERNAL_API_TOKEN`，至少 32 字符。所有 Servlet 服务与 Feign 调用使用同一令牌；网关会移除外部 `X-Internal-Token` 和伪造身份头。`/internal/member/*` 不配置网关路由，直接业务端口也必须提供内部令牌。业务服务本身检查 Session/权限，不能只依赖前端或网关。

内部会员认证、搜索写索引和云短信发送均置于 `/internal/...`，不配置浏览器路由，管理员 Session 也不能代替内部令牌。内部令牌视为服务凭据，不提供给浏览器。所有业务和基础设施端口只绑定本机。此配置用于本机演示，后续部署时保持业务端口不可被外部直接访问。

## 现有数据库升级

全新空演示卷的基线已包含唯一索引。已有卷先备份，并执行以下只读检查，存在重复时先人工核对，不自动删除/合并账号：

```sql
SELECT username, COUNT(*) FROM gulimall_ums_demo.ums_member
WHERE username IS NOT NULL GROUP BY username HAVING COUNT(*) > 1;
SELECT mobile, COUNT(*) FROM gulimall_ums_demo.ums_member
WHERE mobile IS NOT NULL GROUP BY mobile HAVING COUNT(*) > 1;
SHOW INDEX FROM gulimall_ums_demo.ums_member;
```

仅在重复检查为空且 `uk_member_username` / `uk_member_mobile` 不存在时执行 `infra/migrations/001-member-identity.sql`。本机迁移已经执行，不要重复执行 ALTER，也不要对已有数据运行初始化脚本。

## 可重复验收

默认 Maven 测试不连接演示库；包含 BCrypt、私密字段序列化、开发配置限制和 Feign 契约检查。额外运行验收须启动五个容器与十个业务服务，再在项目根目录：

```powershell
. ./scripts/env.ps1
$env:GULIMALL_ACCEPTANCE = '1'
# 其他机器临时设置 ADMIN_TEST_PASSWORD，与已配置 BCrypt 摘要对应；本机可读取私有 admin-access.json。
node --test scripts/auth.acceptance.mjs
Remove-Item Env:GULIMALL_ACCEPTANCE
```

该脚本只操作本机 Compose 的 `_demo` 数据库，生成专用随机账号、订单、地址和品牌，finally 清理自己的记录，不删除种子数据。不可用于生产。9 项（含父用例）验证：开发验证码频率/尝试次数、注册唯一性与并发、错误密码、用户名/手机号登录、会话更换、安全响应、地址/订单隔离、支付归属、伪造头、直连服务权限、管理员 CSRF 与退出后旧 Cookie 失效。

浏览器回归已验证 demo_a 登录、地址归属、刷新恢复、退出后的路由跳转、错误密码和开发验证码提示，以及管理员登录与刷新恢复。购物车和真实订单现已分别接入阶段 5/6；沙箱支付及发货尚未实现，不能把认证验收视为交易闭环验收。
