# 服务端购物车（阶段 5）

阶段 9 起，运行验收统一使用 [独立测试入口](RUNBOOK.md)，不再允许直接向演示库运行旧脚本；下方历史结果保留当时的验收边界。

新增 `gulimall-cart`，Java 8 / Spring Boot 2.1.8，端口 18000，只监听本机，注册到 Nacos。沿用共享 Redis Session、内部 Feign 令牌、R 返回格式和统一 `/api` 网关；无需新增数据库表或迁移，不更换技术栈。

## 页面与接口

商城详情加入购物车后，访客保存到本机；会员保存到 Redis。`/cart` 提供数量增减、单项勾选、删除、清空、刷新及重试合并。阶段 6 已在 `/checkout` 接入真实确认下单与锁库，详见 [ORDERS.md](ORDERS.md)；只有确认待付款后才按条目版本清理本次购买项。

| 方法与路径 | 输入及用途 |
|---|---|
| GET `/api/cart` | 当前会员的全部条目、最新资料、可售状态和勾选合计 |
| POST `/api/cart/items` | `{skuId,count}`，同 SKU 数量原子增加 |
| PUT `/api/cart/items/count` | `{skuId,count}`，设置绝对数量 |
| PUT `/api/cart/items/checked` | `{skuId,checked}`，单项勾选 |
| DELETE `/api/cart/items/{skuId}` | 删除自己的条目；重复删除成功 |
| DELETE `/api/cart` | 清空自己的已保存条目，保留合并去重凭据 |
| POST `/api/cart/merge` | `{mergeId:UUID,items:[{skuId,count,checked}]}`，原子合并访客快照 |
| GET `/api/cart/selected` | 重新校验已勾选商品；无勾选或不可售拒绝结算 |

身份始终从 Session 取得。客户端的 `memberId`、身份请求头、名称和价格不能作为身份或结算依据。管理员不能使用会员购物车。写请求验证 CSRF，业务服务直接访问也受相同保护。

前端额外发送 `X-Cart-Owner`，仅用于检测浏览器其他标签页切换账号造成的会话错位：它须与当前 Session 会员一致，否则返回 409，不更改任何账号的数据。它不是登录凭证，不决定 Redis 目标会员。旧标签页收到会话变化提示后应刷新页面恢复当前身份。

输入边界：每个 SKU 数量为 1–999 的整数，每个购物车最多 100 种 SKU，单次合并 1–100 项。数量 0 不隐式删除，应使用 DELETE。合并内同 SKU 聚合数量，勾选状态取任一已勾选；合并后超出数量/容量上限时，整批不写入，可调整服务端数量或删除部分条目后用原 mergeId 重试。

数量设置、勾选和删除是可重复的目标值操作；加购是增量操作。加购遇到网络结果未知时，应先刷新购物车确认，前端不会自动重发加购。访客合并则始终复用原批次编号安全重试。

## 可信商品与可售性

购物车仅保存 SKU、数量和勾选状态，不保存会员传入的名称或价格。读取时通过受内部令牌保护的 `/internal/product/cart-items` 批量查询最新 SKU / SPU，再批量查询仓储状态；内部接口没有浏览器路由。

| 条目状态 | 展示及行为 |
|---|---|
| AVAILABLE | 当前上架、价格有效且至少有可用库存，可选入结算 |
| OFF_SHELF | 保留条目，显示下架，不可结算 |
| DELETED | 保留 SKU 与数量，显示不存在，不可结算 |
| OUT_OF_STOCK | 保留条目，显示缺货，不可结算 |
| STOCK_UNKNOWN | 保留最新商品资料，库存未知，不可结算 |
| PRICE_UNAVAILABLE | 无效价格不用于合计或结算 |
| SERVICE_UNAVAILABLE | 商品服务失败时保留数量/勾选，价格未知，不使用缓存价格伪装成功 |

GET 购物车在商品资料失败时仍可返回真实保存的条目，并通过状态明确标记未知；Redis/购物车服务失败则返回错误，不返回空购物车。前端保留原条目，将旧价格与合计标为不可用，禁用结算，提供刷新入口。网关对尚缓存的停止实例可能返回 500，注册移除后可能返回 503，两者均按服务不可用处理。

会员勾选合计由服务端以 BigDecimal 计算；只要勾选项中有不可售或未知状态，合计为 null、readyToCheckout=false。未勾选的无效商品保留显示，不阻止其他有效商品的结算预览。

**本阶段不锁库存。** 数量上限是购物车输入限制，有货状态不保证所需数量一定充足；下单时的数量校验与原子锁库属于阶段 6。金额用于当前预览，阶段 6 会在提交时重新计算并保存快照。

## 访客合并、重试与账号隔离

本机 `gulimall-cart` 存储仅含访客条目和待合并快照；旧版 Zustand 的访客数据会迁移。会员条目和价格不写入 localStorage。未知或损坏格式报错，不自动覆盖原数据。

登录/注册/会话恢复后，先确认会员购物车可读取，再在浏览器 Web Locks 保护下将访客快照绑定该会员及固定 UUID。数据移动到本地 pending 区，副本仍在；服务端明确确认合并成功后，才删除对应 pending 副本。并发标签页读取同一已保存快照，使用同一编号；刷新、响应丢失或重登录均可重试。

待合并副本绑定首次合并的会员。会员 A 合并失败后切换 B，不会将 A 的副本合并到 B；回到 A 可继续重试。用户在此期间新增的访客条目使用新的批次，不被旧批次的确认操作删除。合并失败在购物车显示原因；其他页面的页头也提示购物车需要处理。

合并使用 Redis Lua，将全量边界检查、数量更新和请求摘要记录放在一次执行中，任何边界错误发生在写入之前。同 mergeId、同规范化内容只生效一次；同 mergeId 不同内容返回 409。服务端只按最新商品资料展示，不信任访客快照价格。

Redis Key：`gulimall:cart:{会员ID}:items` 与 `gulimall:cart:{会员ID}:merges`，与 Session 共用演示 Redis DB 0，按会员隔离，无自动过期。清空/删除条目不删除去重凭据，避免延迟重试恢复已经移除的商品。每会员最多 10000 条合并凭据，到达上限拒绝新合并并保留本地副本；现阶段不自动裁剪会破坏幂等性的历史。需要大量长期用户时再设计归档与清理协议。

自动安全合并需要浏览器 Web Locks（本机 Chromium 已验证）。不支持时保留本地数据并明确报错，不采用可能重复合并的降级写法。浏览器存储本身损坏、被用户手动删除、Redis 数据卷被删除或关闭持久化不属于成功恢复保证。

## 启动、持久化与验收

```powershell
./scripts/dev.ps1 Up
./scripts/dev.ps1 Build
./scripts/services.ps1 Start
# 单独管理购物车：
./scripts/services.ps1 Stop -Modules cart
./scripts/services.ps1 Start -Modules cart
```

当前启动脚本默认启动十个业务服务，Maven 聚合包含十三个项目。Redis 沿用 Compose 的 AOF 持久化卷；服务/Redis 正常停止重启后购物车、勾选与合并记录均恢复。备份时连同 Redis 数据卷备份，不执行 `down -v` 或 FLUSHDB。

```powershell
node --test scripts/baseline.test.mjs scripts/product-ui.test.mjs scripts/cart-ui.test.mjs
./scripts/scripts.test.ps1
./scripts/test.ps1 -Suite Cart
# 其他阶段验收按顺序运行，勿与故障验收并发：
./scripts/test.ps1 -Suite Auth
./scripts/test.ps1 -Suite Product
./scripts/test.ps1 -Suite Admin
./scripts/test.ps1 -Suite Search
```

当前运行验收只用于独立 gulimall-test / `_test` 环境，创建专用会员与商品，finally 清理自己的 Redis Key、SQL 记录和索引文档。覆盖认证/CSRF/归属、真实价格、勾选、并发数量、重复/冲突合并、超限整批回滚、缺货/删除/下架与故障恢复。运行器自动启用故障场景，重启商品、仓储、购物车和测试 Redis；其他用户同时操作时不要运行。

新增 3 项默认 Java 检查覆盖合并归一化、金额/勾选及服务失败不清空；2 项 Node 检查覆盖访客格式迁移、pending 绑定/确认边界、金额和数量验证。默认测试不连接外部业务数据。浏览器已验证失败保留、换号隔离、恢复合并、刷新不重复、数量/勾选/删除、已选结算预览及桌面/窄屏布局。本机私有日志与截图在 `.tools/stage5-*`，详见实施检查点。

## 阶段 25 操作补齐

访客和会员均可全选、直接输入 1–999 整数并点击更新或 Enter；未更新草稿会阻止结算。显式刷新成功才放弃未提交草稿，写请求失败保留输入。勾选是异步持久化，保存中禁用重复操作；部分失败按待刷新处理，不跳过可售性校验。清空需要确认，取消不改数据；待合并副本仍按原规则处理。详见 [本轮验收](STAGES22-26.md)。
