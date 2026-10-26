# 阶段 21：全量回归与本地模拟交付

基线为 `0f1fa31`，已包含阶段 18–20。本轮继续 Java 8、Spring Boot 2.1.8、现有 React、开发验证码、本地图片和单进程持久模拟支付；不接真实第三方或公网。

复用既有入口串行执行，不清理人工演示交易，不删除既有分支。每次运行后恢复原常驻模拟模式，遇到失败先保留日志并修复实际原因，再决定需要复跑的范围。

## 验收入口

```powershell
# 先确认工具和原模拟环境：
./scripts/preflight.ps1 -Mode Simulation
./scripts/simulation.ps1 Diagnose
./scripts/backup.ps1 -Environment Demo -Destination .data/backups/本轮新目录

# Windows 重建前先停止占用 jar 的业务进程，完成后恢复模拟模式：
./scripts/simulation.ps1 Stop
try {
  ./scripts/dev.ps1 Build
  npm --prefix gulimall-web run lint
  if ($LASTEXITCODE -ne 0) { throw '前端 lint 失败' }
  $checks = @(Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
  node --test @checks
  if ($LASTEXITCODE -ne 0) { throw 'Node 检查失败' }
  ./scripts/scripts.test.ps1
} finally {
  ./scripts/simulation.ps1 Start
}

# 以下保持串行，使用既有 Test/恢复保护：
./scripts/test.ps1 -Suite All
./scripts/test.ps1 -Suite Diagnostics
./scripts/test.ps1 -Suite Browser
./scripts/test.ps1 -Suite Recovery
./scripts/demo-restore.ps1 -Backup .data/backups/本轮新目录 -PaymentConfig .tools/simulation/payment-config.json
./scripts/simulation.ps1 Diagnose
```

构建失败也应恢复原模式；若产物未生成或配置预检失败，先排障，不强行启动缺失产物。Browser 复用锁定的 Chromium 和本机 Edge；缺依赖时在暂停环境前拒绝，详见 [浏览器回归](BROWSER-REGRESSION.md)。两类恢复的目标及密钥要求见 [Demo 完整恢复](DEMO-RESTORE.md) 和 [运行手册](RUNBOOK.md)。

旧忽略类的源码、方法数、替代覆盖及未验证能力见 [LEGACY-TESTS.md](LEGACY-TESTS.md)，不将 skipped 计入通过。

## 实际发现及修复

完整 All 首轮在搜索重建等待处失败，独立 Search 复查也暴露相同窗口问题。测试库保留了 35–36 个历史任务；后台每 15 秒取最多 20 个任务，逐项同步还会等待 ES refresh，原固定 50 次轮询不适合跨批队列。

只修改搜索验收脚本的两个后台同步等待点：依据持久任务总量、20 个一批、15 秒调度与 30 秒失败退避计算有界轮询预算。本次 36 项任务对应约 100 秒；其他就绪检查保持原窗口，商品同步、事务和重试实现未变，也没有清空旧测试数据或手工重试当前商品来绕过自动恢复。

专项复验 5 个业务场景通过，索引丢失后的自动重建实际 66.9 秒，覆盖旧窗口无法通过的情况；仍要求真实同步状态、SKU、价格与种子库存正确。失败轮次不计入通过。状态机和业务期限没有变化，不重新等待自然 30 分钟。

随后在购物车重启场景发现，脚本用一份响应确认 AVAILABLE，却再次分别请求数量和价格；冷启动时后一次请求可保守返回 SERVICE_UNAVAILABLE 与空价格。改为保留达到 AVAILABLE 的同一份真实响应，核对其数量和最新价格，不将多个时刻的字段拼成一个断言。生产购物车的失败降级及可售性判定未变。

## 交付边界

独立 Windows 机器/第二位操作者的交接仍待资源；本机干净目录不能代替该项。真实支付宝/短信/OSS、公网、实体设备与其他浏览器内核、容量、高可用及在线热备继续未验证。自然订单期限沿用既有证据，只有本轮修改状态机或期限时才重新等待 30 分钟。

## 本轮执行结果（2026-10-27）

| 范围 | 本轮实际结果 |
|---|---|
| 聚合构建 | 13 项目成功；JDK 1.8.0_504 / Maven 3.8.1 |
| 默认 Java | 29 通过，0 失败/错误；9 个旧类跳过，内部 17 个方法未执行 |
| 默认 Node | 36 通过，0 失败/跳过 |
| PowerShell / 前端 | 自检、npm ci、lint 和生产 build 通过 |
| All | 8 套 68 个业务场景通过；原始 76 个节点中的 8 个父节点不计业务场景 |
| 专项复验 | Search 5 场景、Cart 7 场景通过；与 All 重复，不累计进 68 之外 |
| Diagnostics | ES、RabbitMQ、仓储及模拟网关停止/恢复四类通过 |
| Browser | Chromium 两轮 25.9s / 17.3s，Edge 两项 11.1s / 17.2s；四项全部通过，约 1.2 分钟 |
| Test Recovery | 损坏备份拒绝、新实例、Session、图片、支付台账、AOF、事件补偿及 ES 重建通过 |
| Demo 完整恢复 | 两代新依赖；原交易保留、两笔新交易到收货、未消费释放补偿、4 条重复消息 ACK 及恢复后继续交易通过 |
| 中文及冷检查点 | 全部 71 表 SQL 重导出哈希一致；收货快照及中文页面正确，两轮恢复浏览器 15.2s / 8.3s |
| 原数据及模式 | 原 3 笔人工交易、6 条库存记录、全部本地图片、.env、模拟密钥和支付台账核对保留；18 项最终诊断健康，Simulation 预检通过 |

有效 Demo 目录为 `.tools/demo restore 8e65a9c7`，本轮原始冷备份为 `.data/backups/stage21-demo-source`。Demo 切换期间原库 SQL 冷转储前后相同；全轮原交易、收货快照、库存及五份原图片/配置/台账文件指纹相同。Redis TTL 按真实时间推进，不将键数视为永久基线，不复活已过期会话。

桌面和 375px Edge 截图已查看，恢复后中文收货与关闭原因也已核对。未修改业务 Java、表、前端或状态机；只有 Search/Cart 验收脚本发生逻辑变更。两个失败的 All 轮次与 Search 调查轮保留排查记录，不计通过；最终完整 All 及四套运行入口均正常退出、恢复原模式。

## 证据及交接入口

总索引 `.tools/stage21-evidence.json` 记录实际提交、环境版本、通过数、两个修复、原数据和最终诊断，并指向本轮私有冻结归档；归档 manifest 对每份文件记录 SHA256。包含构建/回归日志、四份浏览器报告、两类恢复结果、SQL 比对和截图，不复制签名私钥、会话 Cookie 或账号文件。SQL 含会员资料及密码摘要，归档不得作为公开源码附件。

日常操作继续使用 [交接表](DEMO-HANDOFF.md) 和 [模拟手册](SIMULATION.md)。本轮未重新执行阶段 18 的干净目录演练，也未重新等待自然订单 30 分钟；前者沿用阶段 18 证据，后者因状态机/期限未变沿用阶段 13。自然 Session TTL、第二人/独立机器、跨内核/实体设备、真实服务/公网、容量、高可用与在线热备仍为待补或后置。
