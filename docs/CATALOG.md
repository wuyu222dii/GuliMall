# 阶段 2：商品浏览、详情与可售性

阶段 9 起，运行验收统一使用 [独立测试入口](RUNBOOK.md)，不再允许直接向演示库运行旧脚本；下方历史结果保留当时的验收边界。

验收日期：2026-10-25。保留现有 Java 8 / Spring Boot 2.1.8、MyBatis Plus 和 React 分层。本文记录商品库浏览与详情；阶段 4 已将搜索页接入 ES，见 [SEARCH.md](SEARCH.md)。

## 消费者接口

所有浏览器请求经 `/api` 网关，返回 `R` / `PageUtils`。

| 方法与路径 | 用途 |
|---|---|
| GET `/api/product/categories` | 已显示分类的三级树，含名称与 children |
| GET `/api/product/brands?catalogId=...` | 对应分类中有上架商品的可见品牌 |
| GET `/api/product/items` | 只列出 SPU publish_status=1 的 SKU |
| GET `/api/product/items/{skuId}` | 基本信息、图片、销售属性、同 SPU 的 SKU、分组参数、介绍、上架与库存状态 |
| GET `/api/product/items/{skuId}/purchase-check` | 即时重新检查商品与库存，成功返回最新 skuInfo |

旧 `/api/product/skuinfo/list` 和 `/info/...` 浏览器路由已移除。管理查询仍通过 `/api/admin/product/...`，内部商品查询继续使用受令牌保护的 Feign。保留旧分类目录 `/api/product/catalog` 作为只读兼容入口，前端已改接带名称的消费者分类树。

列表参数：

| 参数 | 规则 |
|---|---|
| keyword | 最多 100 字符，搜索 SKU 名称/标题；纯数字也匹配 SKU ID |
| catalogId、brandId | 三级分类与品牌编号；空或 0 表示不限制，负数拒绝 |
| min、max | 非负金额，最多两位小数；包含边界，min 不得高于 max；max=0 仅匹配免费商品 |
| page、limit | page 1–100000，limit 1–100，默认 1 / 12 |
| sort | default、price_asc、price_desc；同价按 SKU ID 稳定排序 |

保留旧管理参数 `key` / `catelogId` 的别名；前端旧 `catalog3Id` URL 会规范为 catalogId。非法参数返回 HTTP 400，排序字段不接受任意 SQL 字段。

示例：`/api/product/items?keyword=Demo&catalogId=900003&brandId=900001&min=1999&max=2100&sort=price_asc&page=1&limit=12`。

## 详情与购买边界

详情的 `item` 含 info、images、variants、saleAttr、groupAttrs、desc、spuDescription、onSale、hasStock。规格链接对应真实 SKU，切换后重新加载价格与库存。参数分组使用真实分组/属性 ID，名称相同的不同组不会合并。介绍按文字与图片展示，不执行存储的 HTML。

| 情况 | 详情行为 | purchase-check |
|---|---|---|
| SKU/SPU 不存在 | HTTP 404，明确提示和恢复入口 | 404 |
| 商品下架 | 保留可浏览详情，onSale=false，禁用购买 | 409 |
| 缺货或可用库存全被锁定 | hasStock=false，禁用购买 | 409 |
| 仓储失败、超时或结果不完整 | hasStock=null，显示库存未知，禁用购买 | 503 |
| 价格缺失或为负数 | 禁用购买，不使用虚构价格 | 409 |
| 已上架且有货 | 可以加购 | 返回当前价格与基本信息 |

加购点击会再次调用 purchase-check，已打开的旧页面也不能绕过下架检查。购物车进入结算与直接打开结算页均重新检查已勾选项；失败或结果未知时保留购物车。阶段 6 已接入服务端重新算价、订单快照和原子锁库，确认待付款后才按版本清理本次购买项；见 [ORDERS.md](ORDERS.md)。

**purchase-check 不锁库存，也不承诺购买数量一定有货。** 当前库存状态表示至少存在可用库存；最终数量校验、订单金额计算和并发锁库由阶段 6 完成。阶段 5 已接入服务端购物车与访客幂等合并，见 [CART.md](CART.md)。

图片支持本地绝对路径和 HTTP(S)，失败时使用本地“图片不可用”占位，不依赖外部占位服务。商品服务失败时，列表和详情有错误与重试入口；不静默切换为另一套数据。

## 分类缓存

树和兼容目录使用同一个 category 缓存分区。新增、修改、删除经过商品服务后清理缓存；RedisCacheManager 使用事务感知，在本地事务提交后执行失效。移除了无有效分区配置的 CachePut。TTL 为 60 秒，限制并发在途读取及直接改库导致的旧值存留；不宣称分布式线性一致。

删除仍有子分类或已有 SPU 的分类会返回 409。日常修改须走业务接口，不直接修改数据库；本轮验收没有覆盖或删除种子商品。

## 可重复验收

默认检查不连接演示数据库：

```powershell
mvn -B -Dfile.encoding=UTF-8 install
node --test scripts/baseline.test.mjs scripts/product-ui.test.mjs
./scripts/scripts.test.ps1
npm run lint --prefix gulimall-web
npm run build --prefix gulimall-web
```

Java 新增离线 Mapper 解析、缺失商品 404、库存失败不造假测试；商品前端纯函数测试覆盖可售性、分类名称和本地图片回退。

启动基础设施与十个业务服务，加载 `.env` 后，在根目录执行：

```powershell
. ./scripts/env.ps1
./scripts/services.ps1 Start
./scripts/dev.ps1 Smoke
./scripts/test.ps1 -Suite Product
./scripts/test.ps1 -Suite Auth
```

管理员密码使用临时 ADMIN_TEST_PASSWORD，或本机私有 `.tools/admin-access.json`，与 [认证说明](AUTHENTICATION.md) 一致。勿在命令历史、Git 或日志中写入真实密码。

当前 test.ps1 入口仅向独立 `_test` 库创建唯一标记的分类、品牌、SPU/SKU、属性与库存，finally 清理自己的记录与缓存。运行器自动启用故障场景，会停止并恢复本工作区标记的仓储 JVM；不可与人工演示或其他测试并行。

本轮 5 个商品业务用例全部通过（含父用例共 6 项），包括组合筛选/分页、完整详情、多销售属性与同名参数组、下架与锁定库存、分类缓存和仓储故障恢复；认证回归 8 个业务场景通过（共 9 项）。后端 9 项 Java 测试、5 项 Node 本地检查、PowerShell 自检、前端构建及 lint 均通过。旧手工集成演示继续隔离，不计入业务通过数。

浏览器验证了筛选、SKU 价格切换、正常加购、旧页面下架拦截、购物车与直接结算拦截、最新价格预览、缺货/库存未知/不存在/服务异常与恢复。使用临时 iframe 检查 1200px 和 375px CSS 视口，修复旧页头导航与网格的窄屏溢出；临时页面和浏览器测试商品均已清理，未进行实体手机或多浏览器兼容测试。

本机日志与截图位于 Git 忽略的 `.tools/stage2-*`；可运行的验收脚本保留在 scripts。商品后台及 ES 搜索的后续实现分别见 [ADMINISTRATION.md](ADMINISTRATION.md) 与 [SEARCH.md](SEARCH.md)。
