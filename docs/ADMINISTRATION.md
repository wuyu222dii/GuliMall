# 商品与采购库存管理（阶段 3）

入口为 `http://127.0.0.1:5173/admin`，使用独立管理员登录。普通会员与未登录访问者不能调用管理接口；绕过网关直接访问业务端口也受保护。所有修改请求沿用 Session + CSRF。

## 录入一个双 SKU 商品

1. 打开“商品管理 → 基础资料”，按需维护三级分类、品牌、属性分组、基础属性和销售属性。基础属性必须属于同分类分组；已被商品引用的资料不能删除。
2. 打开“新建商品”，可点击“填入双 SKU 示例”使用已有演示资料，再修改名称、介绍、重量和价格。
3. 上传 PNG/JPEG 图片，在每个 SKU 中选择图片和主图，也可勾选介绍图。多选图片使用原生多选框，Windows 可按 Ctrl 多选。
4. 为所有 SKU 选择同一组销售属性，再填写不同的属性值。组合不能重复；售价必须非负且最多两位小数。营销字段不启用，也不写优惠券/积分数据。
5. 保存后记录 SPU、SKU 编号。再次编辑会保留已有 SKU 编号与库存引用，允许新增 SKU，不允许删除已有 SKU 或将其移到其他 SPU。

新商品保存为草稿；已有商品编辑保留原上下架状态。阶段 4 已在商品列表增加上下架按钮和同步管理，详见 [SEARCH.md](SEARCH.md)。草稿可以采购入库，但不会出现在消费者列表中。

## 采购入库

1. 打开“采购与库存”，必要时在页面底部新增仓库。
2. 在“采购需求”中按商品名称或 SKU 编号查找商品，选择 SKU、仓库、数量及该需求的**采购总金额**（不是单价），创建需求。数量必须为 1–1,000,000 的整数，金额非负且最多两位小数。
3. 选择同仓库的未分配需求，合并到新采购单或同仓库未领取采购单。
4. 在“采购单”中查看明细、领取，再逐项选择成功或失败；失败须填写原因。完整提交全部明细后，成功项入库，失败项保留原因且不加库存。
5. 切到“库存”，按仓库核对总库存、锁定库存和可用库存。普通业务页面不能直接覆盖库存数字。

采购单状态：0 新建、1 已分配、2 已领取、3 全部成功、4 存在失败。需求状态：0 未分配、1 已分配、2 采购中、3 成功、4 失败。只有未分配需求可编辑/删除；领取后才可完成。完成结果不可修改，相同结果重复提交返回成功，结果不同返回 409。

采购单与明细通过行锁校验状态；库存增加、需求结果、采购单结果在仓储本地事务中提交。库存 `(sku_id, ware_id)` 唯一，使用原子累加；同一采购单并发重复完成不会重复入库。这里尚未实现下单锁库、支付扣减或退款。

## 本地图片

- 上传：`POST /api/admin/thirdparty/local/images`，multipart 字段 `file`；返回 `url`。
- 访问：`GET /api/media/<32位随机名称>.png|jpg`，消费者无需登录。
- 限制：PNG/JPEG、2 MB、单边最多 4096 像素、总像素最多 800 万；校验真实图像内容后重新编码，不使用客户端文件名。SVG、伪造内容、路径穿越均被拒绝。
- 保存目录：`UPLOAD_DIR`，默认项目根下 `.data/uploads`。业务服务需从项目根目录启动；`services.ps1` 已如此处理。目录独立于 jar，服务或容器重启不会清空。
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
$env:GULIMALL_ACCEPTANCE='1'
$env:GULIMALL_FAULTS='1'
node --test scripts/admin.acceptance.mjs
node --test scripts/auth.acceptance.mjs
node --test scripts/product.acceptance.mjs
```

管理验收使用 `.tools/admin-access.json` 或 `ADMIN_TEST_PASSWORD` / `ADMIN_USER`；只允许本机 `_demo` 配置。脚本通过业务 API 创建独立资料、双 SKU、图片、仓库和采购单，检查非法输入、会员拒绝、编辑保留编号、并发入库、部分失败和重试；最后清理自己创建的记录。故障开关会重启 third-party 验证图片哈希不变；商品验收会重启 ware。不要并行运行这些故障验收。

2026-10-25 的构建、运行验收及浏览器操作结果见实施检查点。本机 `.tools/stage3-*` 保存私有日志与截图，不进入 Git。
