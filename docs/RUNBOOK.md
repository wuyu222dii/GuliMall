# 本地验收、演示部署与备份恢复（阶段 9–31）

阶段 31 已完成本轮集中验收：Java 33、Node 47、74 个业务场景（原 68 + 阶段 22–26 新增 4 + 阶段 27–28 新增 2）、四类故障诊断、48 项 Chromium/Edge、Test Recovery 和旧 Demo 两代完整隔离恢复通过。旧 9 类/17 方法继续忽略；常驻 LOCAL_TEST、18 项诊断健康，原交易、库存、图片及私有配置/密钥/支付台账核对一致。详见 [阶段 31](STAGE31.md)。 下文按阶段保留历史过程；最新验收以阶段 31 为准。

保留 Java 8、Boot 2.1.8 和现有分层。真实支付宝沙箱及公网通知仍待账号开通补验；下述端到端交易使用明确标识的 LOCAL_TEST 网关和真实 RSA2 验签，不使用真实资金。短信为开发验证码，图片为本地文件。物流仅记录公司和运单号，不接轨迹、自动退款、多商户、集群或 Kubernetes。

日常模拟操作、付款失败/放弃、自然期限检查、数据路径和未来替换接口见 [SIMULATION.md](SIMULATION.md)。模拟启动配置独立保管，不修改根目录 `.env`；本轮没有真实服务或公网接入。

阶段 14–17 的中文操作检查表见 [DEMO-HANDOFF.md](DEMO-HANDOFF.md)。消费者主线、错误恢复与订单状态提示已统一中文；后台订单详情可查看白名单处理进度，模拟命令支持逐项 Diagnose 与 JSON。

阶段 21 的完整执行命令、两处验收脚本修复和实际结果见 [STAGE21.md](STAGE21.md)。本轮 13 项目构建、Java 29 项、Node 36 项、68 业务场景、4 类诊断故障、4 项 Chromium/Edge 场景、Test Recovery 和 Demo 完整恢复均通过。9 个历史忽略类包含 17 个方法，分类说明见 [LEGACY-TESTS.md](LEGACY-TESTS.md)。最终数据核对与 18 项健康诊断通过，私有冻结归档由 `.tools/stage21-evidence.json` 索引。

## 从空环境启动

在项目根目录配置 JDK 8、Maven、Node/npm 和 Docker Desktop Linux 引擎，然后：

```powershell
./scripts/setup.ps1
./scripts/dev.ps1 Check
./scripts/dev.ps1 Up
./scripts/dev.ps1 Build
java '-Dloader.main=com.atguigu.gulimall.auth.tool.AdminPasswordTool' -cp gulimall-auth-server/target/gulimall-auth-server-0.0.1-SNAPSHOT.jar org.springframework.boot.loader.PropertiesLauncher
# 在交互终端输入并确认管理员密码。将打印的 BCrypt 摘要用单引号放入 .env 的 ADMIN_PASSWORD_HASH，配置 ADMIN_USER；不要把明文写到参数、日志或聊天。
./scripts/search-index.ps1
./scripts/simulation.ps1 Start
./scripts/simulation.ps1 Status
```

浏览器访问 `http://127.0.0.1:8080`，不需要 Vite。管理员登录后在商品同步页面提交全量重建，使空索引包含演示商品。默认会员 demo_a / demo_b，密码 Demo12345!。所有业务服务、基础设施和静态服务器只监听本机；浏览器只走同源 `/api`。静态服务器只提供 `gulimall-web/dist`，支持 React 路由刷新、Cookie 转发、资源类型和文件路径校验，不提供项目目录或内部接口代理。

停止：`simulation.ps1 Stop`，如需停基础设施再执行 `dev.ps1 Down`。Down 保留卷，不使用 `down -v`。模拟入口等待服务注册和实际 API 就绪；原 services.ps1 Start 只表示进程创建，不能代替就绪检查。Windows 上重建 jar 前先停止业务服务。日志分别在 `.tools/runtime`、`.tools/static-demo*.log`、`.tools/simulation/gateway*.log`；Compose 用 `docker compose logs --tail 100 <服务>` 排查。

已有演示数据库按阶段迁移记录执行增量迁移，不重跑空库 SQL；当前基线 71 张表。阶段 9 没有新增业务表。初始化、已有库升级及本机工具说明见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 默认自动检查

```powershell
# 构建前停止本工作区业务 JVM，避免 Windows jar 占用。
./scripts/simulation.ps1 Stop
mvn -B clean install
npm --prefix gulimall-web run lint
npm --prefix gulimall-web run build
$checks = @(Get-ChildItem scripts -Filter '*.test.mjs' | Select-Object -ExpandProperty FullName)
node --test @checks
./scripts/scripts.test.ps1
./scripts/simulation.ps1 Start
```

默认 Java 检查为离线单元/契约测试。旧的 9 项手工集成演示继续忽略，另加 ActiveProfiles(test)；它们不计作业务成功，也不因本阶段重新启用。test profile 在应用上下文启动前要求显式 GULIMALL_TEST=1、COMPOSE_PROJECT_NAME=gulimall-test。五个数据服务提供仅在 test profile 存在、受内部令牌保护的环境检查；HTTP 验收会逐个核对实际 catalog，发现 `_demo` 或其他库立即拒绝。

## 独立业务回归

```powershell
./scripts/test.ps1 -Suite All
# 单项：Auth / Product / Admin / Search / Cart / Order / Payment / Fulfillment
./scripts/test.ps1 -Suite Fulfillment
./scripts/test.ps1 -Suite Diagnostics
node gulimall-web/node_modules/@playwright/test/cli.js install chromium
./scripts/test.ps1 -Suite Browser
```

脚本生成私有 `.tools/test/environment.json`（独立随机数据库/Redis/RabbitMQ 密码和内部令牌）、test_admin 测试管理员配置，以及派生的 `_test` 建表/种子脚本。测试管理员密码 Demo12345! 仅用于隔离的本机测试环境。test profile 指向 pms/sms/ums/oms/wms 五个 `_test` 库，源码中的默认 `_demo` 数据源不变。

测试使用独立 Compose 项目 **gulimall-test**、网络、六个持久卷、MySQL/Redis/Nacos/ES/RabbitMQ 容器和 `.data/test-uploads`，不复用演示数据。为适配本机资源并保留原脚本端口，运行期间暂停演示 JVM 和容器；如果原环境是模拟模式，也暂停静态入口和模拟网关，finally 恢复原模拟模式及调用者环境变量。不要与人工演示、另一轮验收或 IDE 启动的服务并行。未被 services.ps1 管理的 JVM 须自行停止，测试不能占用别的程序端口。

68 个既有业务场景串行执行，故障场景不跳过，日志在 `.tools/test/<suite>.log`。包括身份与地址归属、金额、并发锁库、支付验签和重复通知、付款/关单竞争、发货门禁、重复收货、响应丢失、杀进程、Redis/ES/RabbitMQ 停止及恢复。旧的直接 `node ...acceptance.mjs` 演示库入口已关闭，统一使用 test.ps1。

Diagnostics 另行验证 ES、RabbitMQ、仓储与模拟网关停止/恢复定位。Browser 串行运行两轮 Chromium 完整交易及两项 Edge 场景，用独立夹具核对库存、金额、隔离、终态查询、会话失效、同一确认多标签及 375px 键盘操作，见 [BROWSER-REGRESSION.md](BROWSER-REGRESSION.md)。依赖、脱敏 artifact 和恢复说明见 [SIMULATION.md](SIMULATION.md)。三类套件不连接演示库，不并行执行。

测试卷保留，便于排错和重复运行；业务脚本清理各自临时夹具。不要把测试配置复制到 .env。源码基线变化后如确需重建测试库，先保存诊断，仅对确认属于 gulimall-test 的测试卷处理；不要删除演示卷。

## 两套可重复演示

```powershell
./scripts/test.ps1 -Suite Success
./scripts/test.ps1 -Suite Failure
# 顺序执行两套演示并对失败补偿的中间状态做备份恢复演练：
./scripts/test.ps1 -Suite Recovery
```

成功交易：管理员上传图片、录入双 SKU、采购需求合并/领取/完成入库、上架并搜索；会员通过开发验证码真实注册、退出再登录、保存地址、加购并提交 ¥3.75 订单；LOCAL_TEST 网关验证 SDK 签名表单并发送 RSA2 回调；库存扣减确认后管理员发货，会员确认收货。输出 `.tools/test/demo-success.json`，期望 status=3、inventoryStatus=1，发货与收货历史各一条。

失败补偿：同样经真实业务接口建商品、入库、注册和下单；签发表单后模拟支付服务不可用，取消保持状态 8 和库存锁定。重启订单服务、停止 RabbitMQ，恢复支付查询后确认关闭，保留未消费的释放事件；此时冷备份 SQL/Redis/图片。恢复 RabbitMQ 后事件补发，订单 4 / 库存 2，库存恢复至采购数量 5。输出 `.tools/test/demo-failure.json` 和对应备份路径，不把网络超时当作已释放。

脚本演示数据保留在独立测试卷及私有报告中，方便核对；不会作为演示库的新商品或真实订单。脚本结束恢复调用前的运行模式。两套脚本共用独立 `.data/test-simulation/payment/trades.json`，对应私有配置 `.tools/test/demo-payment.json`；普通支付验收仍默认内存台账。真实平台账号、公钥、公网回调和买家操作仍须按 [PAYMENTS.md](PAYMENTS.md) 另行补验；本轮模拟通知仅使用本机 88，不需要公网地址。

## 一致备份

```powershell
./scripts/backup.ps1 -Environment Demo
# 可指定一个尚不存在的目录，已有备份拒绝覆盖：
./scripts/backup.ps1 -Environment Demo -Destination .data/backups/manual-20261025
```

脚本确认 Compose 项目，暂时停止本工作区业务 JVM；模拟模式还会停止网关及静态入口。在没有其他业务写入的维护窗口中保存五库 SQL、Redis RDB、完整上传目录及模拟支付台账，生成文件 SHA256 清单，然后恢复原运行模式。SQL 使用容器内 mysqldump 并直接复制文件，避免 PowerShell 管道破坏中文或二进制内容。失败不写有效 manifest，不覆盖源库或已有备份。

备份包含订单、明细、库存工作单、支付流水、持久化事件、操作历史、会员数据、购物车/Session 和图片，保留在 Git 忽略的 `.data/backups`。它包含会员资料和密码摘要，按私有文件保管；.env 或 `.tools/test/environment.json` 单独保管，不提交 Git。默认管理员摘要、真实支付配置和启动工具不由数据库备份替代。

ES 是可重建的派生索引；RabbitMQ 交换机/队列由应用声明，库存事件由未消费的 SQL outbox 重放，付款截止时间由数据库扫描补偿，不把队列内消息作为唯一备份。恢复后仍须核对异常付款状态 9 和未知关闭状态 8，不自动退款或发货。

## 恢复步骤与演练边界

Demo 冷备份的完整自动演练使用独立的 `demo-restore.ps1`，详见 [DEMO-RESTORE.md](DEMO-RESTORE.md)。它暂停原环境，在新项目、新卷和私有副本目录恢复所有依赖，验证原交易、消息补偿及恢复后继续交易，退出清理并恢复原常驻模式。Test Recovery 仍只允许 `_test` 备份；只读 Demo 审计仍不启动补偿。下面保留手工步骤及 Test 演练说明，不可将 Test 入口指向 Demo 来绕过保护。

不要把 dump 直接导入现有演示或真实业务库。先在**全新实例/空数据卷**验证：

1. 校验 manifest 中所有 SHA256，使用与清单一致的 MySQL 8.0.36 / Redis 6.2.16 镜像；保留原服务、卷和备份。
2. 新建 MySQL 实例，确认目标为空，把 database.sql 复制进容器后用 mysql 导入；创建/授权应用用户访问清单中的五个库。不要经 PowerShell 文本重定向转码 SQL。
3. 新建 Redis 空卷，容器未启动前复制 redis.rdb。首次以 appendonly=no 加载 RDB，再开启 AOF，等待重写完成；此后使用 appendonly=yes 启动，避免旧 AOF 覆盖快照。核对 Session/购物车并重启验证持久化。
4. 将 uploads 复制到新的上传目录，业务配置指向新的 MySQL/Redis/目录；先核对库名、端口和镜像，再启动。不要覆盖原上传目录。
5. 使用新 RabbitMQ 虚拟主机，由应用声明队列；核对未消费事件恢复与库存工作单。创建 ES 映射后由管理员全量重建，核对搜索结果。
6. 逐项核对金额/订单快照、工作单/锁定库存、支付流水、图片哈希、会话、异常记录与读写权限，再决定是否人工切换演示配置。保留旧环境用于回退，不提供自动覆盖原库的命令。

模拟备份 manifest 中 `simulationPayments=true` 时，还须把 payment-ledger.json 恢复到新的台账路径，单独恢复原匹配签名配置，再启动网关；公钥指纹不匹配必须停止，不删台账或重新生成密钥绕过。演示环境密钥位于 `.tools/simulation/payment-config.json`，不包含在数据备份中；自动恢复演练使用自己的 Test 配置，不读取此文件。

Recovery 命令自动执行上述过程：将失败场景“已关闭但尚未释放”的冷备份恢复至临时 MySQL 3317 / Redis 6390，使用独立命名的空卷和 RabbitMQ vhost；核对已完成订单、备份中的真实管理员 Session、图片哈希、库存释放事件重放，并从恢复后的商品库重建 ES。同时用原 Test 密钥启动恢复后的持久网关，核对同一成功交易 TRADE_SUCCESS、取消交易 TRADE_CLOSED 与订单/工作单结果。还会先提交一个校验和错误的备份，确认在停服务或创建恢复容器前被拒绝。

自动恢复脚本只接受 Test 备份和独立测试环境。临时恢复容器/卷在 finally 清理，原测试和演示数据均不覆盖；恢复图片目录与日志保留供核对。结果在 `.tools/test/restore-result.json`。这是本机恢复演练，不代表高可用、在线热备或生产灾备承诺。

演示快照还可执行独立只读审计：

```powershell
# 使用 backup.ps1 输出的实际目录；不会覆盖或切换当前环境。
./scripts/backup-audit.ps1 -Backup '.data/backups/本次目录'
```

入口只接受 Demo 模拟备份，先核对五个库、必需文件、路径范围、SHA256 和台账格式。3317/6390 被占用时拒绝，不停止端口所有者。随后在带唯一标签的新 MySQL/Redis 实例导入快照：MySQL 关闭事件调度、启用 read_only/super_read_only，审计账号仅 SELECT；Redis ACL 仅允许读命令。实际验证写入被拒绝后，核对订单金额/明细、库存边界与工作单、付款台账、本地图片引用及哈希、Redis/Session/购物车键数。

审计不启动业务服务、模拟网关或补偿任务；报告保留待付款、处理中和异常状态，pendingReview/pendingOrders 供后续人工核对，不自动改状态或释放库存。Redis 原有 TTL 自然生效，过期 Session 不被复活。临时实例、卷和配置只按本次唯一标签清理，原备份、环境和私有配置保留。报告在 `.tools/gulimall-audit-<编号>.json`，不含密码、Cookie、验证码或消息正文。它核对快照，实际补偿恢复继续用独立 Test 的 Recovery。

## 常见故障

| 现象 | 检查与恢复 |
|---|---|
| 登录/购物车不可用 | 检查 Redis 健康、端口和凭据；恢复后刷新原请求，不清空本地合并副本 |
| 搜索报错/上下架未同步 | 恢复 ES，查看管理同步任务，重试或全量重建；不静默切换搜索来源 |
| 订单创建中/取消确认中 | 查看订单和库存工作单；恢复依赖服务，等待扫描或管理员重试，不直接改 SQL 状态 |
| 已支付但不能发货 | 检查 inventoryStatus 与 outbox、RabbitMQ/消费者；扣减确认前保持门禁 |
| RabbitMQ 无消息但库存待处理 | 核对 SQL 事件 consumed_at；未消费事件会重发，死信用于诊断，不是唯一恢复源 |
| 状态 8 / 9 | 8 保留锁定并继续确认；9 人工核对付款与库存，禁止正常发货，不自动退款 |
| 测试启动失败 | 查看 .tools/test/readiness.log 和业务日志；先停止占用端口的非托管进程，确认测试项目/库名，切勿改脚本连演示库 |
| 静态部署 502 | 检查本机网关 88 和 Nacos 注册，API 超时先查询原订单；静态路由能打开不代表后端健康 |

## 阶段 9 历史验收记录（2026-10-25）

统一 All 入口的八套回归共 68 个业务场景通过，无故障跳过；默认 Java 26 项、Node 13 项、PowerShell 自检及前端 lint/build 通过，旧手工演示 9 项忽略不计入通过数。13 项目构建及部署来源修复后的网关增量构建成功。

Recovery 已完成成功交易、支付不可用与 broker 中断补偿、冷备份、错误校验和拒绝、全新 MySQL/Redis 恢复、Session/图片核对、Redis AOF 容器重建、新 vhost 事件重放及 ES 重建。8080 浏览器登录、刷新订单路由与退出通过，未授权 Origin 和缺少 CSRF 的变更仍被拒绝。

默认演示库仍为 71 张表、两个会员、一个双 SKU 商品，库存 10 / 1、锁定 0，订单/支付流水/交易事件均为 0；十个服务和五个容器健康，演示索引两条。证据索引 `.tools/stage9-evidence.json`，逐套日志和交易/恢复报告在 `.tools/test/`；备份、图片、密钥和运行证据均留在 Git 忽略目录。真实沙箱和公网回调未执行，继续按支付文档补验。

## 阶段 10–13 验收记录（2026-10-26）

28 项 Java、18 项 Node、PowerShell 自检与前端 lint/build 通过，旧手工演示 9 项仍忽略。All 的 68 个业务场景全部通过，短信未送达码拒绝及支付竞争另行回归。浏览器在 8080 从图片/双 SKU/采购一直完成到模拟付款、发货和收货，另一笔订单放弃付款后取消并释放；整套模拟环境重启后会话和付款记录可恢复。

自然 30 分钟订单未改期限，15:07:33 到期、15:08:05 核对自动关闭/释放成功。演示冷备份包含原人工订单与模拟台账并校验 SHA256；Recovery 已核对同一交易的恢复台账、订单、库存、Session、图片、AOF、事件重放及 ES 重建，报告 simulationPayments=true。常驻模式在测试及备份后恢复。证据索引 `.tools/stage13-evidence.json`，模拟操作见 [SIMULATION.md](SIMULATION.md)。

历史阶段 9 的空订单基线不再表示当前业务数据：本轮专用演示商品、会员、订单及图片有意保留，原始种子库存仍为 10/1、锁定 0。真实第三方和公网仍未接入。

## 阶段 14–17 验收记录（2026-10-26）

当前默认检查：Java 29 项通过、旧 9 项手工演示仍忽略；Node 27 项通过，PowerShell 自检及前端 lint/build 通过。All 原 68 个业务场景通过，最终处理进度时间展示重打包后履约 9 场景复验通过。Diagnostics 在独立环境实际停止并恢复 ES、RabbitMQ、仓储和模拟网关，均定位正确。

Browser 两轮完整页面交易通过（23.0s / 19.2s），含图片、双 SKU、采购、上架、注册、地址、搜索、购物车、付款、发货收货、失败/放弃及取消；另核对连续购买、刷新、会员隔离与 375px。曾发生的测试失败也验证了原模拟模式恢复和脱敏归档；未把失败轮计入通过数。截图与私有场景编号见 output/playwright 和 .tools/test/browser-runs。

新的 Demo 冷备份已在隔离只读实例核对 71 张表、三笔相同交易、两处本地图片引用及 Redis，均一致；临时资源已清理。Test Recovery 再次通过 Session、图片、AOF、付款台账、事件重放与 ES 重建。证据索引 `.tools/stage17-evidence.json`，演示数据、.env 和原模拟密钥保留；常驻 8080 / 18170 恢复健康。

状态机与期限没有变更，沿用阶段 13 自然 30 分钟证据。本轮完成本机步骤核对，未由第二位操作者在全新机器验收；真实平台、公网、多浏览器、实体手机、容量与高可用仍不在通过结论内。

## 阶段 18 本机交接准备

执行入口、三个预检模式与独立机器待办见 [HANDOFF-SETUP.md](HANDOFF-SETUP.md)。clean-check.ps1 导出 Git 索引快照，在含空格路径从源码构建；Runtime 在随机独立项目和空卷运行成功交易/取消及整套重启，结束清理本次资源并恢复原常驻模式。预装工具需在源码之外，机器依赖缓存可复用，不承诺离线或全新操作系统安装。

2026-10-26 本机验收通过：十三项目构建、29 项 Java（9 项历史忽略）、30 项默认 Node、PowerShell 自检、前端 build/lint；独立环境检索、注册、下单、模拟付款、发货收货、取消及重启保留正确。失败路径也已实际恢复原模式。私有证据 `.tools/stage18-evidence.json`，最终导出 `.tools/clean 69823a90`；原人工交易、库存、配置与密钥保留，18 项诊断健康。本轮未重新执行整套 All/Browser；独立机器与第二位操作者仍待补。

## 阶段 19 浏览器验收

Browser 当前包含两轮 Chromium 完整交易和两项本机 Edge 场景，先实际检查 Edge 能否启动，缺失不会暂停常驻环境。完整命令、确认页地址、多标签语义、会话失效方式与脱敏策略见 [BROWSER-REGRESSION.md](BROWSER-REGRESSION.md)。

2026-10-26 四项通过，默认 Node 32 项、PowerShell 自检及前端 lint/build 通过；修复同一确认页在新标签中重新创建请求的问题。失败后的原模式恢复也已验证，人工数据与密钥保留，18 项诊断健康。证据 `.tools/stage19-evidence.json`，主日志 `.tools/stage19-browser-final.log`。本轮未重跑 Java/All/Recovery；自然 Session TTL、跨内核浏览器和实体设备仍未验收，真实第三方未接入。

## 阶段 20 完整 Demo 恢复与最终核对

最终整理 2026-10-27，实际运行日志 2026-10-26。步骤及完整结果见 [DEMO-RESTORE.md](DEMO-RESTORE.md)。源 Demo 冷备份恢复到独立五项依赖、网络和六个新卷；原三笔交易及库存/支付台账保留，两轮恢复浏览器交易和冷检查点消息补偿通过。第二次导入后整份 71 表 SQL 哈希相同，显式 UTF-8 和中文快照检查防止恢复乱码；ES 从商品库重建后等待可检索。

Test Recovery 复验通过，原 `_test` 保护不变；Node 36 项、PowerShell 自检、前端 lint 通过。最终索引 `.tools/stage20-evidence.json` 包含冻结归档及文件哈希，保存有效轮次、失败排查日志和脱敏截图。原环境配置、密钥、台账、图片、业务 SQL 与库存保留，18 项诊断健康。未重复 Java/All/原 Browser/自然期限，独立机器、第二人和真实第三方继续待补。

## 阶段 26 升级与恢复入口

现有 Demo 在冷备份、暂停业务后执行 `infra/migrations/006-product-creation.sql`，再构建/启动；空库已含新列。`scripts/migration-check.ps1` 用无宿主端口的新 MySQL 验证重复执行、重复值预检和唯一约束，不触碰原库。Test 入口及两类恢复在启动业务前执行迁移，原 Test 数据库名/配置保护保留。

旧 Demo 完整快照可在恢复副本补新列；只核对和迁移副本，不向原环境写回。重建后的创建请求必须返回原 SPU/SKU，并验证支付台账、消息补偿及继续交易。操作命令、适用边界和最终结果见 [阶段 26](STAGE26.md)。
