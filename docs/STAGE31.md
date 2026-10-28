# 阶段 31：本轮定向回归、恢复兼容与交付

基线 b903a3d，分支 codex/stage31。阶段 27–30 的页面、查询和输入保护在本轮集中回归；沿用 Java 8、Boot 2.1.8、同源 /api、Session/CSRF、单管理员、开发验证码、本地图片和 LOCAL_TEST 持久模拟支付。未接真实第三方或公网，未新增业务表、迁移、API、订单/库存/支付状态或期限。

## 定向覆盖与修正

复用现有串行 Browser 套件，保留采购明细延迟/失败切换、一次写入及响应丢失核对、SKU/采购单分页、商品组合筛选、管理订单详情和 URL 返回、四类资料分页和保存/删除定位。故障注入只延迟、断开或丢弃真实响应，不伪造成功，不通过直接改库构造终态。

新增 Chromium/Edge 各两项：分类读取失败不能显示为空分类，重试后恢复完整分类和窄屏操作；空地址表单取消不误拦，脏表单明确放弃并退出后只发送一次退出请求，原会话失效，受保护地址页回登录，不把输入持久化。原输入保护测试另补确认放弃后浏览器返回不复活草稿，以及脏仓库表单切换对象时保留/放弃的实际结果。已有未知商品创建、采购请求和结算令牌仍逐字保留。

首次 All 在 Search 专项失败：旧测试只从同步任务前 100 条查找目标，已有近 500 条持久任务时，状态排序变化使目标离开首屏，读取 version 失败；后续 ES 故障项连带失败。已改为遍历真实 API 分页，不清理持久夹具、不修改业务实现。第二轮索引重建及检索已通过，但旧种子库存断言只按 SKU 查询，混入其他测试仓库的合法库存；改为同时限定原仓库 900001，不删除其他库存。两轮失败日志分别保留，不计通过。第三轮 Search 已全部通过，但执行 Order 时验收运行中断，后续发现验收进程与 Docker 均已停止；该轮仅算中断记录，不计 All 通过，恢复环境后重新执行。

新增 Browser 首轮 6 通过、1 失败、41 未运行：退出登录已成功，但新测试错误地要求匿名 /auth/me 返回 200；既有契约为 401。已改为断言当前身份和受保护订单接口均 401，不改认证实现。失败轮单独保留，重跑全套后才计通过。

## 本次实际验收

以下均为本次实际运行结果，私有 summary、独立提交及冻结 manifest 对应同一代码基线。

| 检查 | 最终结果 |
|---|---|
| 构建、默认检查 | 13 项目构建与前端 build/lint；Java 33、Node 47、PowerShell 自检 |
| 历史忽略 | 旧 9 类、17 个手工方法继续忽略，不计通过 |
| All | 74 个业务场景：原 68 + 阶段 22–26 新增 4 + 阶段 27–28 新增 2；原始 82 节点含 8 个父节点 |
| Diagnostics | ES、RabbitMQ、仓储服务、模拟支付网关四类故障与恢复 |
| Browser | 48 项（原 44 + 新增 4），Chromium 两轮完整页面交易和 Edge；桌面 1280px/窄屏 375px，新增窄屏截图已查看 |
| Test Recovery | 错误校验和先拒绝，独立 MySQL/Redis、原 Session/图片/订单/模拟台账、创建请求防重、空 vhost 事件补发及搜索重建 |
| Demo 恢复 | 旧快照、两代新容器与卷、业务启动前增量迁移、整份检查点 SQL 对比、创建请求重放、消息补偿和恢复后继续交易 |
| 原环境 | 18 项诊断及 Simulation 预检；原 3 笔订单和收货快照、6 条库存、71 表、全部图片和私有配置/密钥/支付台账核对一致 |

本机独立 Test 已有数百条持久同步任务，Search 故障恢复与全量索引重建可能需要十余分钟；按脚本输出的真实任务数和预算等待，不清空夹具或用手工成功状态跳过。库存快照会定期重入队，成功数不是单调进度条。本轮未扩大原等待预算。

自然 30 分钟关单沿用阶段 13：本轮未改状态机或期限。主动退出/另一标签退出只证明会话销毁和重登恢复，未验自然 Session TTL。

## Demo 兼容核对

虽然本轮不改持久化写入，阶段 30 适配了恢复浏览器入口，因此本次重新执行完整 Demo 恢复，不只沿用阶段 26。输入为 `.data/backups/round6-before` 和匹配私有签名配置：源备份、原库、原配置不改写。恢复期间暂停原环境，只在受项目/工作区/资源归属保护的副本启动业务，不并行访问原数据库。

两代导入后、业务启动前执行既有 006 增量迁移，原商品字段保持一致；第二代重导出完整 71 表检查点 SQL 并核对 SHA256。旧交易金额、收货快照、库存工作单、图片及支付台账保留。新增商品的 creationRequestId 冷恢复后重试仍返回同一 SPU/SKU。空 RabbitMQ 从持久事件补发释放，重复扣减/释放共 4 条消息 ACK，库存仅处理一次；恢复后再完成一笔页面交易，验收商品最终库存 3、锁定 0。

退出只清理本次创建的容器/卷/网络。原环境暂停前后 SQL 字节相同，恢复原 LOCAL_TEST，18 项健康。详情与故障退出办法见 [DEMO-RESTORE](DEMO-RESTORE.md)。

## 复验与证据

```powershell
# 构建前停止本工作区业务；失败也恢复原模式。
./scripts/simulation.ps1 Stop
try { ./scripts/dev.ps1 Build } finally { ./scripts/simulation.ps1 Start }
npm --prefix gulimall-web run lint
$checks = @(Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
node --test @checks
./scripts/scripts.test.ps1
./scripts/test.ps1 -Suite All
./scripts/test.ps1 -Suite Diagnostics
./scripts/test.ps1 -Suite Browser
./scripts/test.ps1 -Suite Recovery
# 完整 Demo 恢复使用已审核 Git 索引快照；先暂存本次源码改动。
./scripts/demo-restore.ps1 -Backup '.data/backups/round6-before' -PaymentConfig '.tools/simulation/payment-config.json'
./scripts/simulation.ps1 Diagnose -Json
./scripts/preflight.ps1 -Mode Simulation -Json
```

所有生命周期命令串行，测试实际库名必须为 _test；恢复 Demo 使用独立受保护副本，不放宽 Test 保护。不要与人工交易或备份并行。Windows 构建先停 JVM；日志/私有配置放 Git 忽略目录。

本轮私有总索引 `.tools/stage31-evidence.json`，摘要 `.tools/stage31-summary.json`，冻结清单 `.tools/stage31-final/manifest.json` 保存版本、脱敏报告/截图、失败记录和 SHA256；恢复运行目录由 `.tools/stage31-demo-location.json` 定位。Java 反射 DEBUG 环境整行不归档，归档扫描私有密码、密钥及控制令牌；SQL、备份、台账和密钥继续私有独立保管。阶段 27–30 的既有冻结归档哈希也已重新核对，不改写历史证据。

独立提交，不自动推送/合并。独立机器、第二位操作者、实体手机/触摸、Firefox/Safari、自然 Session TTL、容量/高可用及在线热备仍待补验；真实支付宝/公网通知、短信和 OSS 继续后置。采购新增只保证当前标签页原请求锁定与核对，跨标签/清除原记录后的服务端持久幂等仍需另立范围。会员资料/密码找回、退款售后、营销、角色权限、报表、首页运营、物流轨迹及盘点调拨不在本轮。
