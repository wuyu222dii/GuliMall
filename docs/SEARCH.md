# Elasticsearch 搜索与商品同步（阶段 4）

阶段 9 起，运行验收统一使用 [独立测试入口](RUNBOOK.md)，不再允许直接向演示库运行旧脚本；下方历史结果保留当时的验收边界。

搜索页 `http://127.0.0.1:5173/search` 使用 `GET /api/search`，结果来自 Elasticsearch 7.10.2。首页推荐仍使用商品库消费者列表。搜索失败时显示错误与重试入口，不回退到数据库查询或继续显示旧结果。详情、加购和结算前的实时可售性校验继续由商品/仓储服务负责。

## 初始化与已有库迁移

空数据卷基线已包含 `pms_search_sync`。已有库先备份 `gulimall_pms_demo`，确认 `SHOW TABLES LIKE 'pms_search_sync'` 为空，再执行一次 `infra/migrations/003-search-sync.sql`；当前本机已执行，勿重复。原表与记录不删除、不覆盖。

启动基础设施后，在项目根目录运行：

```powershell
. ./scripts/env.ps1
./scripts/search-index.ps1
# 启动业务服务与前端后，管理员进入 /admin/products/sync
# 点击“从商品库全量重建”，刷新直到相关任务全部“已同步”
```

索引固定为 `gulimall-products-v1`，映射唯一来源为 `gulimall-search/src/main/resources/elasticsearch/products.json`。初始化脚本可重复执行，保留已有文档，并校验 schema 标记及 nested 属性；遇到其他映射拒绝覆盖。

名称/标题使用内置 `cjk` 分析器，品牌/分类编号精确匹配，价格为两位小数的 scaled_float，`attrs` 为 nested，包含编号、名称与值。无需下载 IK 插件。使用单分片、零副本对应本机演示配置。CJK 的行为见 [ES 7.10 语言分析器](https://www.elastic.co/guide/en/elasticsearch/reference/7.10/analysis-lang-analyzer.html#cjk-analyzer)。

## 消费者接口

返回 `R.page`，沿用 PageUtils：`list`、`totalCount`、`totalPage`、`currPage`、`pageSize`。商品卡片包含真实 SKU ID、名称、标题、价格、图片及库存快照，不插入高亮 HTML。

| 参数 | 规则 |
|---|---|
| keyword | 名称/标题全文匹配，最多 100 字；纯数字也匹配 SKU 编号 |
| catalogId | 三级分类编号，空或 0 不限制 |
| brandId | 品牌编号；接口可接收重复参数/逗号列表，最多 20 个；页面选择单品牌 |
| min、max | 非负金额，最多两位小数，包含边界；max=0 生效 |
| hasStock | 空不限制，1 有货，0 无货；这是索引中的库存快照 |
| sort | default（相关度）、price_asc、price_desc；最终按 SKU ID 稳定排序 |
| page、limit | 默认 1 / 12，limit 1–100，仅允许前 10000 项的分页窗口 |
| attrs | 可重复的 `属性编号_值`；每对在同一 nested 属性内精确匹配，最多 20 项 |

非法参数返回 HTTP 400。ES 不可用、索引缺失、超时或分片失败返回 503。`/list.html` 为同一 JSON 接口的兼容路径，不再返回未渲染的模板名；浏览器统一使用 `/api/search`。

## 上下架、编辑与重试

管理员在商品列表直接上架/下架，在“同步与索引重建”页面查看每个 SPU 的目标状态、任务状态、版本、尝试次数与失败提示。

| 接口 | 用途 |
|---|---|
| GET `/api/admin/product/search-sync?page=1&limit=20` | 分页任务列表 |
| POST `/api/admin/product/search-sync/{spuId}/publish?status=1` | 上架；status=0 下架 |
| POST `/api/admin/product/search-sync/{spuId}/retry` | 按数据库最新资料立即重试 |
| POST `/api/admin/product/search-sync/rebuild` | 持久化全部 SPU 的重建任务 |

修改请求验证管理员身份及 CSRF，直接访问业务端口同样受保护。内部 `/internal/search/*` 不配置浏览器路由，另需内部令牌。

上下架目标与同步任务在商品本地事务内一起保存；新增商品仍为草稿。目标状态保存后执行一次同步，成功才提示“目标状态与搜索索引已同步”；失败返回 HTTP 503，明确提示目标已保存，任务仍可重试。下架目标立即禁止购买，索引删除失败也不能从旧详情购买。

聚合商品编辑、SKU 名称/价格/主图修改、规格修改、品牌/分类/属性改名，都在对应本地事务中排入已上架商品的同步任务。编辑保存成功表示商品资料落库，索引更新结果须在同步页确认。旧 SPU 裸保存入口拒绝创建不完整商品，旧 update 仅作为目标上下架状态兼容入口。

任务以 SPU 为主键合并，版本单调增加。执行时锁定 SPU 和任务，再读取最新资料；失败保存 state=2、尝试次数和错误，成功 state=1，待执行 state=0。每 15 秒扫描最多 20 个到期任务，失败后约 30 秒再试，进程重启不丢任务；手动重试无需等待。失败项不因后台库存扫描被覆盖。

ES 使用相同 SKU ID、外部版本及批量写入，批量任一项失败保留任务。写入/删除使用 `refresh=wait_for`，确认成功后可搜索。删除版本保留遵循 ES `gc_deletes` 窗口；本实现只重建最新数据库快照，不持久化或无限重放旧请求体。协议依据见 [ES 外部版本](https://www.elastic.co/guide/en/elasticsearch/reference/7.10/docs-index_.html)、[刷新可见性](https://www.elastic.co/guide/en/elasticsearch/reference/7.10/docs-refresh.html)、[删除版本窗口](https://www.elastic.co/guide/en/elasticsearch/reference/7.10/docs-delete.html)。

写入经 `gulimall-products-write` 别名并要求 `require_alias=true`。索引在检查与写入之间丢失时，本次同步失败并重试，避免 ES 自动创建没有中文/nested 映射的索引。

## 索引重建与库存边界

全量重建将当前商品库的全部 SPU 加入任务：已上架商品覆盖文档，下架商品删除对应 SKU 文档，索引缺失时自动按固定映射创建。提交接口只确认任务落库，不把“已提交”当“已完成”；中断后继续处理剩余任务，失败可逐商品重试。重建期间搜索可能逐步恢复，不承诺无停机切换。

日常商品/SKU 禁止物理删除，因此可从当前 SKU 恢复索引；重建不会销毁现有索引、改变映射，或猜测清理人工直接写入的孤立 ES 文档。改映射、清理外部污染或切换索引需单独迁移，不直接删除生产数据。

库存未知时同步失败，不写“默认有货”。当前每分钟分批扫描最多 100 个已上架 SPU，重新读取真实仓储状态更新快照；超过 100 个会分批轮转，存在延迟，可手动立即同步。阶段 6–7 接入库存事件后应替换此轮询。搜索“有货”不锁库存，也不保证指定数量可购买。

## 可重复验收

启动十个业务服务与前端，并通过 Smoke 后运行：

```powershell
./scripts/test.ps1 -Suite Search
./scripts/test.ps1 -Suite Auth
./scripts/test.ps1 -Suite Product
./scripts/test.ps1 -Suite Admin
```

当前入口仅用于独立 gulimall-test / `_test` 环境。搜索验收创建三 SKU 商品和库存，测试中文、组合筛选、价格零上限、属性、分页、上下架与版本重放。运行器自动启用故障场景，停止测试 ES 容器、重启本工作区商品服务，验证任务与最新价格恢复，并删除测试派生索引 `gulimall-products-v1`，再从测试商品库恢复。**不要在共享或生产环境执行故障验收。** finally 下架并清理自己的商品、库存与任务，不修改种子商品或库存。其他验收会重启仓储/图片服务，需顺序运行。

默认构建新增 SearchQueryTest：零价格上限与 nested 配对、非法排序/分页窗口、真实返回分页结果；不连接数据库或 ES。运行与浏览器记录见实施检查点，本机私有日志/截图在 `.tools/stage4-*`。
