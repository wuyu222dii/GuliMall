# 阶段 39：现有本地模拟主线集中验收

基线 `c9e9733`，2026-11-12 在 main 完成。执行用户确认的[阶段 39–44 计划](03-增长迭代/迭代计划-v8.md)，本阶段不加入后续持久回执、聚合或分页功能。

初始工作区干净，LOCAL_TEST 18 项 Diagnose 健康，工具链与旧 Demo 备份存在。先核对原业务及私有文件，再串行构建与默认检查、All、Diagnostics、Browser、Test Recovery 和旧 Demo 两代恢复；保留各阶段真实结果与失败日志，不使用历史通过数冒充新执行。

Java42、Node56、All78、Browser78 均通过，旧9类/17个手工方法忽略不增加、不计通过。本阶段没有修改业务代码、持久结构、状态机或期限；沿用阶段35自然 Session 连续闲置7205秒和阶段13自然30分钟关单证据，没有重复自然等待。

首轮默认检查通过，All 在搜索故障场景外部中断：Auth10、Product6、Admin12 及搜索前4个子场景有完成记录，但不是完整 All 通过。中断日志另存 `.tools/stage39-interrupted1/`，核实没有活动测试进程后，按 Compose 标签及工作目录停止遗留 Test 容器，恢复 LOCAL_TEST 18项健康并复核原数据。第二轮从头完整重跑 All 并通过，没有使用分段结果替代本轮全量；已通过且未修改的默认检查保留原结果。

## 验收结果

| 检查 | 本轮结果与证据 |
|---|---|
| 后端 | 13 模块构建成功；Java 42 项通过、零失败/错误，9 个旧手工测试类继续忽略；`.tools/stage39-build.log`、`stage39-java.json` |
| Node | 56 项通过、零失败/忽略；`.tools/stage39-node.log` |
| PowerShell | 语法、随机配置、不覆盖、字面值、环境优先级和非法输入检查通过；`.tools/stage39-powershell.log` |
| 迁移 | 006/007 各重复执行两次、原字段、重复预检及含删除记录的唯一约束检查通过；`.tools/stage39-migration.log` |
| 前端 | lint 零错误零警告，生产构建通过；`.tools/stage39-frontend.log`、`stage39-build.log` |
| 历史证据 | 阶段 35–38 的 515 份冻结文件哈希一致；`.tools/stage39-prior-evidence-verified.json` |
| 完整 All | 第二轮完整执行通过：Auth10、Product6、Admin12、Search6、Cart7、Order12、Payment15、Fulfillment10，共 78 个叶子场景（含 8 个父节点时为 86），零失败/忽略；`.tools/stage39-business-result.json`、`stage39-business/*.log` |
| Diagnostics | 独立 Test 中停止 ES、RabbitMQ、仓储及模拟网关均能准确定位，恢复后正常；未通过诊断写入业务数据；`.tools/stage39-diagnostics.log`、`stage39-diagnostics-result.json` |
| 完整 Browser | 78 项通过，Chromium/Edge 各 39、零失败，13.2 分钟；包含 Chromium 两轮完整交易、Edge 关键交易、未知请求及原令牌、返回/刷新/会话边界、375px 键盘和输入保护；`.tools/stage39-browser.log`、`stage39-browser-result.json`，成功截图/脱敏轨迹单独保留 |
| Test Recovery | 单代新 MySQL/Redis、保存的 Session、图片、已完成订单、持久模拟台账、新消息空间的库存释放及搜索重建通过；商品/采购创建请求恢复，已删除需求不复活；损坏备份在停止服务和创建恢复容器之前被拒绝；`.tools/stage39-recovery.log`、`stage39-test-recovery-result.json` |
| Demo 两代恢复 | 旧 `stage20-demo-source` 备份通过两代全新五项基础设施恢复；每代业务启动前执行006/007增量迁移，原商品/采购字段一致；完整71表冷检查点 SQL 逐字节相同；原订单、金额、库存、图片和台账保留；空 broker 补发、4条重复消息 ACK 不重复改库存，新增采购只入库一次，恢复后完成两笔模拟交易；`.tools/stage39-demo.log`、`stage39-demo-location.json` |
| 原数据与最终环境 | 3个订单及地址快照、6行库存、4条原采购业务字段、71张表、5份配置/密钥/台账/图片文件核对一致；LOCAL_TEST 18/18 Diagnose 和 Simulation 预检通过；`.tools/stage39-original-verified.json`、`stage39-demand-fields.json`、`stage39-final-health.json`、`stage39-final-preflight.json` |

所有套件串行执行，成功后恢复调用前的常驻模式。搜索重建保留既有 Test 任务，使用当前完整队列计算等待预算；没有删除历史任务、手动改业务状态或用历史验收替代本轮结果。

All 第二轮搜索故障后自动重试通过，丢失索引后的后台重建实际等待 2127 秒，完整 Search 套件约 2532 秒。原商品之前的任务逐步处理，无手动跳队、清队列或修改状态；最终查询及种子库存断言通过。All 结束后，原 LOCAL_TEST 模式已恢复，再进入独立 Diagnostics。

Test Recovery 完整结束并恢复 LOCAL_TEST。Demo 恢复前，原订单/地址快照、库存、采购字段及私有文件再次核对一致；一次并行只读核对中的 Diagnose 报告 Docker 查询超时，保留 `stage39-before-demo-health-timeout.json`，直接查询确认 Linux/overlayfs 及五容器健康，重新 Diagnose 18/18 通过。没有为消除此记录重置 Docker、服务或数据，也未修改诊断阈值。

Demo 两代各有5个容器，10个容器编号均不同；原基础设施在隔离期间保持停止，新资源不挂载原数据卷。原数据库完整 SQL 在恢复前后相同，原 `.env`、签名配置和支付台账哈希一致；结束仅清理本次创建且归属已核实的资源。结果 `passed`、`resourcesCleaned`、`standingRestored` 均为 true。

## 复现与证据

默认构建/检查入口见 [运行手册](RUNBOOK.md)。在已配置工具链的工作目录中依次执行，不并行启动生命周期脚本：

```powershell
./scripts/test.ps1 -Suite All
./scripts/test.ps1 -Suite Diagnostics
./scripts/test.ps1 -Suite Browser
./scripts/test.ps1 -Suite Recovery
./scripts/demo-restore.ps1 -Backup .data/backups/stage20-demo-source -PaymentConfig .tools/simulation/payment-config.json
./scripts/simulation.ps1 Diagnose -Json
./scripts/preflight.ps1 -Mode Simulation -Json
```

旧 Demo 入口仅适用于本机已有且密钥匹配的私有备份，不随源码分发；其他操作者按[恢复说明](DEMO-RESTORE.md)提供自己的冷备份。汇总 `.tools/stage39-summary.json` 对实际日志、数量、结果、原数据和最终就绪状态逐项断言；冻结副本及 SHA-256 清单位于 `.tools/stage39-final/manifest.json`，包含中断轮、Docker超时记录、成功轮、浏览器脱敏材料、Test/Demo恢复摘要及515份历史证据的复核结果。私有文件不提交 Git；新提交版本记录在清单的 `commit` 字段。

## 后续边界

阶段40–44仍待依次实施；当前地址、仓库创建和普通增量加购的持久防重尚未新增，未知结果仍按既有页面核对流程处理。本阶段不接真实支付宝、短信、OSS，不开放公网；独立机器、第二操作者、实体手机、其他浏览器内核、辅助技术、容量、高可用和在线热备仍待补验。
