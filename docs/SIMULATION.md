# 常驻本地模拟商城（阶段 10–13）

本轮只使用本机服务：支付为 LOCAL_TEST，验证码为 development，图片真实写入本地。数据库、Redis Session、商品、购物车、订单、库存、消息、发货和收货仍走真实业务逻辑，不通过前端改状态制造成功。不接真实支付宝、短信或 OSS，不开放公网。

## 启动与停止

在项目根目录使用已配置 JDK 8、Maven、Node 和 Docker CLI 的 PowerShell，先打开 Docker Desktop Linux 引擎。首次环境准备、管理员摘要和构建见 [运行手册](RUNBOOK.md)。已有库不要重跑初始化。

```powershell
./scripts/simulation.ps1 Start
./scripts/simulation.ps1 Status
./scripts/simulation.ps1 Diagnose
./scripts/simulation.ps1 Diagnose -Json
./scripts/simulation.ps1 Stop
```

浏览器访问 `http://127.0.0.1:8080`，后台为 `/admin`。Start 会复用 gulimall-demo 基础设施、十个业务 jar、静态文件和本机 18170 模拟支付网关，等待服务注册与 API 就绪；重复启动不重启健康服务。Stop 仅操作本工作区进程，保留基础设施、卷、图片和交易文件；基础设施另用 `dev.ps1 Down` 停止且保留卷。

端口被非托管程序占用时拒绝启动，不结束其他进程。缺少 jar/dist 时先停止本项目服务，再按开发文档构建。配置或台账损坏时查看 `.tools/simulation/gateway.err.log`，不要删除文件“重置成功”。业务日志在 `.tools/runtime`。

Diagnose 只读检查 Docker、五项容器、十个服务的注册与端口、静态入口和持久模拟网关；文本或 JSON 返回各项状态、简短原因、日志位置和恢复命令。有不可用项退出码为 1，全部就绪为 0；不会执行输出的恢复命令。独立测试内可诊断 Test 环境，不把故障自动切换到演示库。

管理员在订单详情查看“处理进度”，可区分消息发布确认、消费确认、库存结果、重试计划和到期检查。发布确认不代表库存已处理，发货仍由服务端门禁决定；查询失败明确显示未知。重试使用原有“重试确认与消息”，不直接改订单或库存。

模拟覆盖配置只传入子进程，调用结束恢复原环境变量，不覆盖根目录 `.env`。强制 dev,payment-test、开发验证码、IMAGE_STORAGE=local、OSS/SMS 云组件关闭，支付网关及通知/返回地址均为 127.0.0.1。真实配置保留在原文件中，不会成为此入口的付款目标。

## 手动成功交易

1. 管理员在商品管理新建双 SKU，可使用录入示例后修改名称、价格；上传 PNG/JPEG 图片，保存草稿。
2. 在采购库存为各 SKU 建需求、合并采购、领取并完成，确认库存增加；重复完成不再次入库。
3. 商品上架并等待同步成功；在消费者搜索页确认能查到。
4. 退出管理员，注册新会员。页面显示“开发验证码”，用该码完成注册并保存收货地址。
5. 搜索商品，加入购物车，修改数量和勾选，确认订单并提交；订单与锁库实际保存。
6. 点击付款，在本机网关选择“确认模拟付款”。页面明确说明无真实资金；付款后由 RSA2 回调或查单驱动结算。
7. 等库存扣减确认，管理员再登录并填写物流公司/运单号发货；会员查看物流并确认收货。
8. 刷新和重启后核对原订单、金额、物流与历史仍在。模拟台账不是订单数据库的替代品。

## 失败与恢复演示

- 选择“模拟付款失败”或“返回订单（不付款）”，订单保持待付款。会员随后可以重新付款或在订单页取消；不要在后台直接改状态。
- 同一已付款交易重复提交不改变付款时间或再次扣库；已关闭交易不能重新付款。
- 暂停订单服务或消息服务后恢复，原交易继续处理；库存尚未确认时保持禁止发货。
- 未确认通知每 5 秒重试；只有 HTTP 200 且正文为 success 才确认。网关重启后继续重试，返回页不参与付款判定。
- 自然 30 分钟到期的未付款订单按原逻辑查单、关闭并释放；平台结果未知时保留状态与锁定，不用 SQL 强制成功。
- 状态 8/9 仍用于关闭未知/付款异常，不能自动发货；退款售后不在本轮范围。

模拟网关提供只读 `GET http://127.0.0.1:18170/health`，仅返回模式、就绪与是否持久化。控制接口仅本机并要求私有 Bearer 令牌，不提供给消费者页面。

## 持久化、备份与恢复

| 对象 | 位置/责任 |
|---|---|
| 商品、会员、订单、库存、事件 | 原五个 `_demo` 库及 Compose 持久卷 |
| Session 与购物车 | 原 Redis 持久卷 |
| 图片 | UPLOAD_DIR，默认 `.data/uploads` |
| 模拟支付台账 | `.data/simulation/payment/trades.json` |
| 模拟签名密钥与控制令牌 | `.tools/simulation/payment-config.json`，私有配置 |
| 运行意图与日志 | `.tools/simulation/state.json`、gateway*.log |

支付先原子写入台账，再通知订单；台账记录公钥指纹，重启核对密钥。文件损坏、写盘失败、密钥不匹配或密钥丢失时明确拒绝，不生成空台账覆盖历史交易。单进程小型本地文件台账是当前边界，多实例前须改用数据库。

```powershell
./scripts/backup.ps1 -Environment Demo
```

运行在模拟模式时，冷备份会同时停止模拟网关和业务服务，保存 SQL、Redis、图片、`payment-ledger.json` 与 SHA256 清单，完成后恢复模拟模式。不要在维护窗口之外让其他程序写库。模拟私钥与控制令牌不包含在数据备份里，单独私有保管；恢复台账必须使用原匹配配置，不能静默重生成密钥。

先在隔离实例恢复，不向已有演示库导入 dump。完整恢复次序沿用 [运行手册](RUNBOOK.md)，另将 payment-ledger.json 复制到新的台账路径，核对指纹及同一交易的订单、库存和模拟支付状态后才考虑人工切换。保留原卷和原图片目录，不自动覆盖。

## 自动验收

```powershell
# 默认离线检查；脚本端口冲突测试使用私有夹具，不停止演示服务。
node --test scripts/baseline.test.mjs scripts/product-ui.test.mjs scripts/cart-ui.test.mjs scripts/payment-ui.test.mjs scripts/order-ui.test.mjs scripts/deployment.test.mjs scripts/simulation.test.mjs
./scripts/scripts.test.ps1
./scripts/test.ps1 -Suite All
./scripts/test.ps1 -Suite Browser
./scripts/test.ps1 -Suite Recovery
```

运行验收期间会暂停常驻环境；独立 gulimall-test 和 `_test` 库执行结束后，恢复调用前的模拟模式。不要与人工操作或另一轮验收并行。Recovery 的两套交易现在也使用持久台账，冷备份前暂停网关，在全新实例恢复后核对付款、关闭和库存结果。测试用台账在 `.data/test-simulation`，与常驻台账分离，测试恢复不读取演示签名密钥。

Browser 使用锁定的开发依赖 @playwright/test 和 Chromium。先执行前端 npm ci、生产构建，并运行 `node gulimall-web/node_modules/@playwright/test/cli.js install chromium`；无需全局安装或 npx。缺少浏览器或构建产物时，在暂停常驻环境前拒绝执行。

每次 Browser 串行执行两轮完整页面交易，各轮创建独立会员/商品/采购，验证成功付款、发货收货、付款失败/放弃、取消释放、刷新、会员隔离和 375px 页面；不伪造 API 成功响应或直接改库。只读 API/SQL 用于核对结果。测试台账为 `.data/test-simulation/browser/trades.json`，匹配私有配置 `.tools/test/browser-payment.json`；测试数据留在 _test，不读演示会员凭据。

截图与结果在 Git 忽略的 output/playwright，场景编号记录在 `.tools/test/browser-runs`。失败截图遮罩输入和状态消息；trace.zip 只保留动作时序，禁用 DOM/网络正文和源码，不保存输入值、Cookie 或错误回显。自动 DOM 错误上下文与原始 trace 会清理，因此不包含完整 DOM 回放；需结合遮罩截图和步骤摘要排查。测试成功和失败都恢复原运行模式。

自然期限检查单独运行，显式在演示库保留具有唯一标记的商品、会员、采购和订单：

```powershell
$env:GULIMALL_SIMULATION='1'
node scripts/simulation.acceptance.mjs prepare
# 不修改订单期限，等待原订单自然超过 30 分钟，再核对：
node scripts/simulation.acceptance.mjs verify
Remove-Item Env:GULIMALL_SIMULATION
```

私有记录位于 `.tools/simulation/acceptance.json`，含该次模拟会员登录信息，不提交 Git；结果在 natural-expiry.json。已有记录不会被 prepare 覆盖，重复核对用 verify；新一轮需要先保留旧证据并把记录另存，再创建新记录，不删除已有业务数据。

## 未来替换接口

- 支付保留现有付款/通知/查单/关单接口及 AlipayTemplate；未来独立验证真实沙箱，不把本地网关改标签冒充真实平台。
- 短信经 SmsSender.send(phone,code,validMinutes) 交付；验证码及频率/有效期/消费仍由认证服务管理。当前只有开发实现，real 模式拒绝启动，失败发送不会返回验证码或留下可用的未送达验证码。
- 图片统一校验、重新编码后经 ImageStorage.save(normalizedImage,generatedName) 保存并返回 URL。前端使用 `/api/admin/thirdparty/images`，旧 local/images 地址兼容，原 `/api/media/...` 图片继续可读。OSS 未实现，选择非 local 存储明确失败。
- 本轮没有新增业务表、真实供应商依赖、公网隧道或支付成功捷径；Java 8、Boot 2.1.8 与既有本地事务/幂等/补偿保持原方案。
