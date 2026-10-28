# 商品与采购库存管理（阶段 3）

阶段 27–31 已补齐采购结果核对/分页、商品组合筛选、资料分页及输入保护，本轮 Admin 10 个业务场景、完整 Browser 和恢复通过，见 [最终验收](STAGE31.md)。接口与服务端权限、引用删除和履约门禁继续沿用现有说明。

阶段 9 起，运行验收统一使用 [独立测试入口](RUNBOOK.md)，不再允许直接向演示库运行旧脚本；下方历史结果保留当时的验收边界。

常驻模拟入口为 `http://127.0.0.1:8080/admin`（Vite 开发为 5173），使用独立管理员登录。普通会员与未登录访问者不能调用管理接口；绕过网关直接访问业务端口也受保护。所有修改请求沿用 Session + CSRF。

## 未保存输入

基础资料、仓库、采购需求和发货物流表单在取消、切换对象及站内离开前确认未保存输入；原生刷新/关闭提醒沿用浏览器规则。保存确认后清除修改基线，失败保留输入。普通放弃操作不清理商品创建、采购原请求或订单提交记录，结果未知继续按原接口核对。见 [STAGE30](STAGE30.md)。

## 基础资料查询与维护

分类、品牌、属性分组、属性可按名称或精确编号查询，每页 20 条；品牌按启用/隐藏，分组按分类，属性按分类/状态/类型组合筛选。分类显示完整路径、层级和父编号。筛选只影响列表，表单仍使用完整资料。保存后定位编号所在页；不匹配原筛选时提示并清除条件，删除后保留筛选并退到有效页。保存或删除已确认但刷新失败时标识旧数据并暂停修改；响应未知先查询核对，不自动重发，引用删除仍由原服务端事务拒绝。结果和全量 metadata 的容量边界见 [STAGE29](STAGE29.md)。

## 商品查找与返回

商品列表可组合名称/编号、分类、品牌和上下架状态，按 SPU 编号倒序分页；条件与页码保存在 URL。编辑、新建、同步页返回列表时恢复原条件，重登也保留合法管理地址。分类和品牌显示名称及编号；名称查询失败时保留编号与实际商品结果，并单独提供重试。状态 0 为草稿/已下架，1 已上架，2 仅筛选历史下架记录；当前上下架仍写 0/1，不批量改写历史。分页 1–1,000,000、单页 1–100、关键词最长 100 字、分类/品牌为正编号；后端保留旧 catelogId 别名与 0 表示全部的调用约定。非法参数返回 400。详见 [阶段 28](STAGE28.md)。

## 录入一个双 SKU 商品

1. 打开“商品管理 → 基础资料”，按需维护三级分类、品牌、属性分组、基础属性和销售属性。基础属性必须属于同分类分组；已被商品引用的资料不能删除。
2. 打开“新建商品”，可点击“填入双 SKU 示例”使用已有演示资料，再修改名称、介绍、重量和价格。
3. 上传 PNG/JPEG 图片，在每个 SKU 中选择图片和主图，也可勾选介绍图。多选图片使用原生多选框，Windows 可按 Ctrl 多选。
4. 为所有 SKU 选择同一组销售属性，再填写不同的属性值。组合不能重复；售价必须非负且最多两位小数。营销字段不启用，也不写优惠券/积分数据。
5. 保存后记录 SPU、SKU 编号。再次编辑会保留已有 SKU 编号与库存引用，允许新增 SKU，不允许删除已有 SKU 或将其移到其他 SPU。

新商品保存为草稿；已有商品编辑保留原上下架状态。阶段 4 已在商品列表增加上下架按钮和同步管理，详见 [SEARCH.md](SEARCH.md)。草稿可以采购入库，但不会出现在消费者列表中。

## 采购入库

1. 打开“采购与库存”，必要时在页面底部新增仓库。
2. 在“采购需求”中按商品名称或 SKU 编号查找商品，选择 SKU、仓库、数量及该需求的**采购总金额**（不是单价），创建需求。保存确认后表单绑定返回的需求编号；继续录下一 SKU 时点击“新建下一条需求”。数量必须为 1–1,000,000 的整数，金额非负且最多两位小数。
3. 选择同仓库的未分配需求，合并到新采购单或同仓库未领取采购单。
4. 在“采购单”中查看明细、领取，再逐项选择成功或失败；失败须填写原因。完整提交全部明细后，成功项入库，失败项保留原因且不加库存。
5. 切到“库存”，按仓库核对总库存、锁定库存和可用库存。普通业务页面不能直接覆盖库存数字。

采购单状态：0 新建、1 已分配、2 已领取、3 全部成功、4 存在失败。需求状态：0 未分配、1 已分配、2 采购中、3 成功、4 失败。只有未分配需求可编辑/删除；领取后才可完成。完成结果不可修改，相同结果重复提交返回成功，结果不同返回 409。

采购单与明细通过行锁校验状态；库存增加、需求结果、采购单结果在仓储本地事务中提交。库存 `(sku_id, ware_id)` 唯一，使用原子累加；同一采购单并发重复完成不会重复入库。这里尚未实现下单锁库、支付扣减或退款。

## 本地图片

- 上传：`POST /api/admin/thirdparty/images`，multipart 字段 `file`；返回 `url`。旧 `/api/admin/thirdparty/local/images` 保留为兼容别名。
- 访问：`GET /api/media/<32位随机名称>.png|jpg`，消费者无需登录。
- 限制：PNG/JPEG、2 MB、单边最多 4096 像素、总像素最多 800 万；校验真实图像内容后重新编码，不使用客户端文件名。SVG、伪造内容、路径穿越均被拒绝。
- 保存目录：`UPLOAD_DIR`，默认项目根下 `.data/uploads`。业务服务需从项目根目录启动；`services.ps1` 已如此处理。目录独立于 jar，服务或容器重启不会清空。
- 阶段 12 经统一校验/重新编码后调用 ImageStorage；本轮只实现 local，非 local 模式明确拒绝启动，不提供空壳 OSS 成功实现。
- 备份时同时备份数据库与上传目录。编辑器“移除此图片”只移除引用，不删除物理文件，以免破坏其他商品；当前没有孤立图片自动清理任务。

## API 约定

| 用途 | 接口 |
|---|---|
| 基础资料集合 | `GET /api/admin/product/admin/catalog` |
| 新增/修改资料 | `POST /api/admin/product/admin/catalog/{categories|brands|groups|attrs}`，修改带对应 ID |
| 删除未引用资料 | `DELETE /api/admin/product/admin/catalog/{kind}/{id}` |
| 商品列表 | `GET /api/admin/product/spuinfo/list` |
| 编辑聚合查询/保存 | `GET /api/admin/product/spuinfo/editor/{id}`、`POST /api/admin/product/spuinfo/editor` |
| 需求列表/新增/修改/删除 | `/api/admin/ware/purchasedetail/{list|save|update|delete}` |
| 采购单列表/明细 | `GET /api/admin/ware/purchase/list`、`GET /api/admin/ware/purchase/info/{id}` |
| 合并/领取/完成 | `POST /api/admin/ware/purchase/{merge|received|done}` |
| 仓库/库存 | `GET /api/admin/ware/{wareinfo|waresku}/list`、`POST /api/admin/ware/wareinfo/save` |
| 订单入口 | `GET /api/admin/order/order/list`，本阶段只读，发货在阶段 8 |

沿用 `R` / `PageUtils`，未登录 401、无权 403、参数错误 400、状态冲突 409、不存在 404。管理页面使用对应业务服务，不从浏览器拼接数据库操作。

## 已有数据库迁移

空数据卷的 `infra/mysql/001-schema.sql` 已包含新列与唯一索引。已有数据卷先备份并执行：

```sql
SELECT sku_id, ware_id, COUNT(*)
FROM gulimall_wms_demo.wms_ware_sku
GROUP BY sku_id, ware_id HAVING COUNT(*) > 1;
SHOW INDEX FROM gulimall_wms_demo.wms_ware_sku;
SHOW COLUMNS FROM gulimall_wms_demo.wms_purchase_detail LIKE 'failure_reason';
```

只有重复查询为空、索引及列都不存在时，才执行一次 `infra/migrations/002-procurement.sql`。发现重复先核对真实库存，不自动删除或合并。不要重跑初始化脚本，也不要重复执行迁移。当前本机演示库已完成迁移。

## 可重复验收

先构建并通过 `scripts/services.ps1 Start` 启动十个业务服务，等待 Nacos 注册和 Smoke 成功。Windows 重建 jar 前先 Stop。加载本机工具与 `.env` 后：

```powershell
node --test scripts/baseline.test.mjs scripts/product-ui.test.mjs
./scripts/scripts.test.ps1
./scripts/test.ps1 -Suite Admin
./scripts/test.ps1 -Suite Auth
./scripts/test.ps1 -Suite Product
```

当前管理验收由 test.ps1 自动提供 `.tools/test/admin-access.json`，只允许独立 `_test` 配置，不需要演示管理员的明文密码。脚本通过业务 API 创建独立资料、双 SKU、图片、仓库和采购单，检查非法输入、会员拒绝、编辑保留编号、并发入库、部分失败和重试；最后清理自己创建的记录。运行器自动启用故障场景，重启 third-party 验证图片哈希不变；商品验收会重启 ware。不要并行运行这些故障验收。

2026-10-25 的构建、运行验收及浏览器操作结果见实施检查点。本机 `.tools/stage3-*` 保存私有日志与截图，不进入 Git。

## 阶段 23–25 页面补齐

新建商品携带稳定 creationRequestId，GET `/api/admin/product/spuinfo/creation/{requestId}` 查询原结果；正常重试返回同一商品，已保存请求内容冲突 409。未知时保留 Session Storage 快照并锁定输入；明确校验失败可修正，但复用标识。既有库升级必须先冷备份并执行 `infra/migrations/006-product-creation.sql`，不要重跑初始化。

采购页从“仓库维护”页签新增/查询/编辑仓库，资料更新不改编号、库存或采购引用；选仓支持分页和名称/编号查找。库存页使用精确 SKU 和仓库组合筛选。原“新增仓库”折叠入口由该页签替代。基础资料新增结果未知须先核对，已保存但刷新失败绑定原编号并标记旧数据。详见 [本轮记录](STAGES22-26.md) 和 [迁移/恢复](STAGE26.md)。

## 阶段 27：采购结果核对与分页

SKU 与未领取合并目标分别独立分页，切页保留已选编号；主列表支持采购单编号、需求 SKU/采购单编号查询。明细加载或失败时不能操作旧单。保存返回编号后绑定原需求，新增结果未知先查询候选并人工确认；合并/领取/完成按原编号和提交内容核对，必要时明确重试原请求。刷新仍保留本标签页的待核对记录，关闭标签页不保证保留；这不是服务端采购新增幂等键。

GET 需求 info/{id} 不存在返回 404；采购列表分页最大 1,000,000、limit 最多 100，编号为正数，状态限定 0–4。所有管理员和 CSRF 保护保留。实际复现、接口及验收见 [阶段 27](STAGE27.md)。
