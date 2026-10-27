# 阶段 26：页面完善后的全量回归与恢复兼容

本轮从 `914be52` 实施阶段 22–26。阶段 22–25 独立提交为 `3496842`、`0cd9981`、`98ad7a0`、`08922c3`。继续本机 LOCAL_TEST 支付、开发验证码、本地图片；没有真实资金、真实第三方或公网。

## 迁移与恢复

既有数据库升级前先冷备份，再暂停业务，在目标 MySQL 执行 `infra/migrations/006-product-creation.sql`，构建并恢复模拟模式。该迁移只为 SPU 增加可空创建请求标识、摘要和唯一索引；重复执行不更新商品。发现重复请求标识时明确失败，不删除或合并原记录。空库初始化已包含这些字段，不对已有卷重跑初始化。

```powershell
./scripts/backup.ps1 -Environment Demo -Destination .data/backups/新的私有目录
./scripts/simulation.ps1 Stop
try {
    . ./scripts/env.ps1
    $migrationSql = Get-Content infra/migrations/006-product-creation.sql -Raw
    $migrationSql | docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -ugulimall --default-character-set=utf8mb4'
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed; inspect before continuing' }
    ./scripts/dev.ps1 Build
} finally { ./scripts/simulation.ps1 Start }
```

运行前应通过 Simulation 预检并离开 Test 模式；备份命令也会校验实际 Compose 归属。不要把命令指向远程或其他项目。失败时保留快照和诊断；旧表字段均保留，禁止通过重建库解决迁移问题。回退旧代码时保留新增列、索引及请求记录，不逆向清空数据结构。

`scripts/migration-check.ps1` 在无宿主端口、无源卷的新 MySQL 内验证：旧 UTF-8 字段不变、迁移重复执行、重复标识在建索引前拒绝、清除本测试夹具后唯一索引真正生效。仅清理自身 ID/标签匹配的临时容器及匿名卷，不读取业务凭据，临时 root 密码执行后恢复。

Demo 恢复继续使用独立入口，不放宽 Test 的数据库名、配置或实例保护。每代恢复先导入备份；第二代先对全部 71 表冷检查点做 SQL 字节比对，再执行迁移。迁移前后比较全部原商品字段，记录结构变化，启动业务前完成升级。源备份和原环境不写回。

恢复副本新增商品使用稳定创建标识；第二代重建 MySQL/Redis/ES/Nacos/RabbitMQ 后再次提交原快照，必须返回同一 SPU、同一 SKU。Test Recovery 同样验证成功/失败演示商品的创建请求与两个 SKU 恢复、防重；不直接改订单状态或库存来通过验收。

## 本轮验收入口

收口时补齐摘要输入边界：重量和 SKU 价格在规范化摘要前限制数值精度及 scale（绝对值不超过 64），避免异常指数先展开大字符串。正常数值的摘要格式不变；新增 Java 单元断言和真实管理接口的 400/明确错误消息检查。此修正后重新构建并运行最终业务回归，之前的轮次保留但不重复计数。

首次 Test Recovery 在商品创建重放、订单/库存/图片/台账核对通过后，遇到旧固定 90 秒搜索等待超时。改用现有搜索验收的任务量预算：20 条/批、15 秒调度、ES 刷新及 30 秒失败退避，仍有明确上限并要求真实搜索结果。失败轮日志保留、不计通过；本次只调整验收等待，不改业务调度。375px 仓库专项另外实际执行编辑与保存，再完整重跑 Browser。

串行执行，不与人工交易或另一轮测试并行：

```powershell
./scripts/migration-check.ps1
# Windows 构建 jar 前暂停服务，失败也恢复模拟模式：
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
# 匹配该快照的私有密钥必须独立保存：
./scripts/demo-restore.ps1 -Backup .data/backups/实际的Demo备份 -PaymentConfig .tools/simulation/payment-config.json
./scripts/simulation.ps1 Diagnose
```

原 68 个业务场景继续保留；新增地址默认并发、商品创建防重、仓库维护和会员订单筛选四个场景独立计数。Browser 保留 Chromium 两轮完整链、Edge 关键交易和边界，并增加两个浏览器的地址、商品、仓库、购物车、基础资料专项。它们重叠覆盖业务，不合并为额外订单场景数。旧 9 个类/17 个方法继续忽略，详见 [旧测试说明](LEGACY-TESTS.md)。

## 实际结果与证据

最终本地验收通过，代码版本为本文件所在阶段 26 独立提交；未推送或合并。前四阶段结果与提交见 [本轮实施记录](STAGES22-26.md)。

| 检查 | 最终结果 |
|---|---|
| 后端与前端 | 13 项目构建成功；Java 33 通过，旧 9 类/17 方法忽略；前端 lint/build 通过 |
| 默认检查 | Node 37 通过；PowerShell 自检通过 |
| All | 原 68 + 新增 4 = 72 个业务场景；80 个原始节点中的 8 个父节点不计入 |
| Diagnostics | ES、RabbitMQ、仓储、模拟支付网关四类故障及恢复通过 |
| Browser | 14 项通过；Chromium 两轮完整交易、Edge 关键链及双方页面专项；375px 实际编辑保存仓库 |
| Test Recovery | 新实例、原 Session/图片/台账、订单与释放事件、双 SKU 创建请求重放、ES 重建通过 |
| 迁移自检 | 全新无宿主端口 MySQL；两次执行、UTF-8 原字段、重复预检与唯一约束通过 |
| Demo Recovery | 旧备份增量迁移、两代完整冷恢复、原交易核对、请求防重、消息补偿与继续交易通过 |
| 最终环境 | LOCAL_TEST 常驻 18 项健康，Simulation 预检通过；原演示数据保留 |

Demo 输入 `.data/backups/round6-before` 确认不含新增字段，71 表；运行目录 `.tools/demo restore baaaade5`。每代业务启动前执行迁移，全部原商品字段相同。第二代导入前后完整检查点 SQL 字节哈希相同，新请求重放仍返回原 SPU/SKU。原 3 笔交易、6 条库存及 3 条支付台账保留；两笔新交易收货，待释放事件补偿及重复 4 消息 ACK 幂等，最终验收商品库存 3/锁定 0。恢复浏览器两轮 14.8 秒 / 10.3 秒。原环境隔离前后 SQL 哈希相同，本次容器/卷已清理，配置、密钥、图片和台账指纹一致。

首次恢复固定等待超时、最终构建前的旧轮次、一次只读 Docker 探测不可用及私有调用封装误读保留退出码的记录均保留，不计作最终通过。后续独立进程 PowerShell 自检、18 项健康及预检重新通过；最终生产代码不含临时暂停机制。没有用清理历史夹具或改写业务状态解决验收失败。

私有总索引 `.tools/round6-evidence.json`；阶段 26 冻结日志、报告、截图及 SHA256 清单 `.tools/stage26-final/manifest.json`，含 All、Browser、Test/Demo 报告和失败轮日志。阶段 22–25 的 88 份已冻结文件哈希亦复核一致。日志、备份和密钥继续私有保存；归档不复制密码、Cookie、短信验证码或签名私钥。

订单状态机、锁库/扣减/释放算法和期限未改变，自然 30 分钟沿用阶段 13 的既有证据。本轮不声称已验收独立机器、第二位操作者、实体手机、Firefox/Safari、真实第三方、公网、高可用、容量或在线热备。
