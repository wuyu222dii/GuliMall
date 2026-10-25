# 支付、库存结算与可靠消息（阶段 7）

**当前验收范围：接入代码及本地验证。用户尚未开通支付宝沙箱账号，已确认先完成代码和本地验收。真实沙箱付款、公网异步回调未验收，不将本地测试网关标成支付宝沙箱。**

保留 Java 8 / Spring Boot 2.1.8 和现有支付宝 SDK 4.9.28.ALL。订单库新增一张交易事件表，复用支付流水、订单操作历史、库存工作单与本地事务；不引入 Seata、自动退款或通用消息框架。

## 配置真实沙箱

在本机 `.env` 设置以下字段，不提交密钥，也不要将私钥发到聊天或写入日志：

| 环境变量 | 内容 |
|---|---|
| ALIPAY_APP_ID | 沙箱应用 ID |
| ALIPAY_PRIVATE_KEY | 应用的 RSA2 私钥，SDK 使用的一行 Base64 PKCS8 内容 |
| ALIPAY_PUBLIC_KEY | 支付宝沙箱公钥，用于验签；不是应用公钥 |
| ALIPAY_SELLER_ID | 此沙箱收款方的 seller_id / PID |
| ALIPAY_NOTIFY_URL | 可公开访问的 HTTPS 通知地址，路径为 `/api/payments/alipay/notify` |
| ALIPAY_RETURN_URL | 浏览器返回地址，本机为 `http://127.0.0.1:5173/payment/return` |

默认使用支付宝官方新沙箱网关；旧沙箱网关也仅允许 HTTPS，拒绝正式支付网关。没有完整配置时支付按钮禁用并给出提示，后台不生成假支付结果。公网接入只转发上述通知路径到网关，业务服务继续仅监听本机；本轮没有自动建立隧道或公开其他接口。

更新配置后重启订单服务。真实验收仍需：注册沙箱账号、上传应用公钥并取得支付宝公钥、填写收款方与回调配置、使用沙箱买家付款，确认公网通知返回 `success`，并检查支付流水、订单和库存结果。

官方参考：[沙箱接入与网关](https://aipay.alipay.com/act/apass)、[支付宝支付校验字段](https://aipay.alipay.com/article/84)、[交易关闭接口](https://aipay.alipay.com/docs/vibe-pay/ai-web-app-payment-qianyi/api-list/alipay-trade-close.html)。

## 接口与页面

| 方法与路径 | 作用 |
|---|---|
| POST `/api/order/mine/{sn}/payment` | 校验本人、待付款和固定付款截止时间；保存签发记录，返回官方 SDK 的签名表单与模式 |
| GET `/api/order/mine/{sn}/payment-status` | 只读取本人的订单、库存门禁、配置可用性和支付模式，不因返回参数修改状态 |
| POST `/api/payments/alipay/notify` | 接收 UTF-8 表单通知；此唯一回调不依赖 Session/CSRF，改由 RSA2 与业务字段认证 |
| POST `/api/admin/order/payments/{sn}/retry` | 管理员重试支付/关单查询与未消费事件；仍校验 Session、管理员身份和 CSRF |

库存事件描述与完成回执只走受内部令牌保护的 `/internal/order/events/{id}`，没有浏览器路由。旧 GET 支付入口不再签发表单，写操作不能绕过 CSRF。支付流水、订单和明细不能用旧管理 CRUD 直接改写。

`/checkout` 和 `/member/orders` 提供支付/库存状态入口。`/payment/{sn}` 发起支付；`/payment/return?orderSn=...` 每五秒只读取服务端状态，忽略回跳携带的“成功”字段。登录后保留合法订单跳转地址，丢弃额外回跳参数。会员不能查看或支付他人的订单。

官方 SDK 使用 JSON 序列化业务参数，保留商品名中的引号、反斜杠和中文，签名请求固定绝对 `time_expire`，重复打开不延长 30 分钟期限。前端用 DOMParser 读取 SDK 表单，只重新创建隐藏字段与允许的网关 action；保留 action 查询串中的签名参数，不执行返回 HTML 的脚本，也不把任意 HTML 注入页面。

管理订单页显示异常付款、库存处理状态和履约门禁，可重试未完成确认及消息。阶段 8 已接入发货、物流、收货及待付款取消，见 [FULFILLMENT.md](FULFILLMENT.md)；旧直接改订单状态接口拒绝请求。只有状态为已支付、库存扣减已确认且有支付交易号时，服务端 `fulfillmentReady` 才为 true。

## 通知、幂等和付款记录

通知拒绝重复字段、过大字段和不支持的状态，使用官方 SDK `rsaCheckV1` / RSA2 验签，并检查 app_id、seller_id、订单号、交易号、金额与交易状态。金额使用 BigDecimal，付款时间按 Asia/Shanghai 严格解析。

成功通知在一个订单本地事务中：锁订单行，核对金额，保存交易号唯一的支付流水，更新订单状态并写入 `STOCK_DEDUCT` 事件。相同合法交易重放返回 `success`，不同订单复用同一交易号被拒绝。回调存档仅保存应用、收款方、订单、交易号、金额、状态与付款时间等必要字段，不保存买家凭证、私钥或完整通知。

未收到通知时，定时任务使用同一 SDK 和支付宝公钥查询真实结果。查询仍检查订单号、金额、交易状态和付款时间；签名失败、网络故障或不完整响应不能把订单标成已支付。

## 状态、超时与付款竞争

| 订单状态 | 含义 |
|---|---|
| 0 | 待付款，固定 30 分钟期限 |
| 1 | 支付已确认，库存扣减可能仍在处理 |
| 4 | 关闭结果已确认，库存释放可能仍在处理 |
| 6 / 7 | 沿用阶段 6 的创建与创建失败释放恢复 |
| 8 | 付款期限已到，正在向支付宝确认支付或关闭结果，保留库存 |
| 9 | 异常/迟到付款或库存冲突，禁止正常履约，需人工核对 |

`inventory_status` 为 0=待处理、1=扣减确认、2=释放确认。`payment_started` 在表单返回前持久化；`payment_trade_no` 保留支付交易号。

关单先用订单行锁持久化状态 8，阻止继续签发表单，再查询/关闭支付宝交易。已付款按可信付款时间处理；支付宝明确已关闭，或交易不存在且从未签发表单，才能提交关闭与释放事件。已签发表单却暂查不到交易、关单失败、签名错误、金额不匹配或远程超时均保留锁定并重试，不能把“未知”当成“未付款”。

已签发表单但未真正提交到支付宝时，交易可能长期不存在；系统选择保留状态 8，需在真实沙箱/人工核对后处理，不自行释放未知结果的库存。未签发表单的超时订单，以及能向支付宝确认关闭的未支付订单，会正常关闭并释放。

付款决策和关闭决策竞争同一订单行锁：付款先提交则只产生扣减事件；关闭先提交后再收到付款则进入异常状态 9，不恢复正常履约。迟到时间按 `gmt_payment` / 可信查询的付款时间判断，合法通知重试不会因为发送时间晚而重复记账。异常流水保留并显示在后台；本轮没有自动退款，也不会自动发货。

## RabbitMQ 与补偿

`oms_trade_event` 与业务状态同事务保存，每订单/事件类型唯一。消息只含事件编号，库存服务从受内部令牌保护的订单接口取得真实的订单和动作，不信任消息自带的金额、数量或状态。

| 持久化对象 | 用途 |
|---|---|
| gulimall.trade | durable direct exchange |
| gulimall.trade.stock | 扣减/释放库存消费者，手动 ACK |
| gulimall.trade.delay | 30 分钟 TTL，过期转 close 路由 |
| gulimall.trade.close | 延迟关单消费者，手动 ACK |
| gulimall.trade.dead | 消费失败后的死信，保留供排查 |

消息设置 persistent、mandatory，启用 publisher confirms 和 returns。只有确认 ACK 且没有未路由返回时才记录 sent_at；发布失败或结果未知由数据库重发。发布确认和 consumed_at 分开：库存事件即使已被 broker 确认，只要消费尚未完成，仍每 30 秒重发。计时事件确认后不反复塞延迟队列，订单数据库期限扫描补偿延迟或丢失的计时消息。

库存扣减在一个本地事务内同时减少 stock 和 stock_locked，将工作单及明细改为 3=DEDUCTED；释放在同一事务内减少 stock_locked、改为 2=RELEASED。重复消息读取原结果，扣减后不能通过释放接口恢复库存，已释放不能再次扣减或重新锁定。

消费者先完成库存事务，再确认订单端库存结果，最后 ACK。中间崩溃或回执失败会重试；工作单幂等防止再次扣减。消费失败 NACK 到死信，未完成的 SQL 事件继续重发，不依赖死信消息本身作为唯一恢复依据。定时任务也查询库存工作单，修复已提交库存但回执/消息遗漏的情况。异常数据保留等待人工处理，不伪造履约成功。

Spring AMQP 2.1 的 CorrelationData future 保证返回消息先于 future 完成可见，代码按此区分路由返回与发布确认。[官方 API](https://docs.spring.io/spring-amqp/docs/2.1.x/api/org/springframework/amqp/rabbit/connection/CorrelationData.html)；持久队列、持久消息、发布确认和手动 ACK 各自承担不同责任，消费效果靠业务幂等保证。[RabbitMQ 可靠性说明](https://www.rabbitmq.com/docs/reliability)

## 数据库、构建与本地验收

空环境使用当前 `infra/mysql/001-schema.sql`，共 71 张表。已有环境先停服务、备份订单/库存库，再运行一次 `infra/migrations/005-payments-events.sql`；先检查重复交易号，不删除或覆盖原数据。本机迁移前备份在 `.tools/stage7-before.sql`。

```powershell
./scripts/services.ps1 Stop
# 完成备份并确认本阶段尚未迁移后执行一次：
Get-Content infra/migrations/005-payments-events.sql -Raw |
  docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall'
mvn -B clean install
./scripts/services.ps1 Start
cd gulimall-web
npm run lint
npm run build
```

本地验证使用独立测试密钥和 `payment-test` 配置。仅该配置允许 127.0.0.1 的 HTTP 测试网关；页面和结果接口明确返回 LOCAL_TEST。默认服务仍是 ALIPAY_SANDBOX，缺少真实配置就禁用支付，不自动启用本地替代。

```powershell
node --test scripts/baseline.test.mjs scripts/product-ui.test.mjs scripts/cart-ui.test.mjs scripts/payment-ui.test.mjs
./scripts/scripts.test.ps1
$env:GULIMALL_ACCEPTANCE='1'
$env:GULIMALL_FAULTS='1'
node --test scripts/payment.acceptance.mjs
```

脚本创建独立 RabbitMQ 虚拟主机和专用会员、商品、订单；生成真正的 RSA2 请求/响应，使用官方 SDK 验签。覆盖并发通知、支付/关单竞争、回调丢失、broker 停止、订单重启、未路由消息、扣减提交后杀消费者、已确认消息丢失和 Redis 停止。只调整自己的测试期限/事件时间、只清空自己的虚拟主机队列来加速故障场景，不等待自然 30 分钟。30 分钟 TTL 声明及计时消息投递单独校验。

finally 清理自己的 SQL/Redis/索引记录、测试虚拟主机，并恢复订单/库存服务的原始环境配置。测试私钥仅在忽略的 `.tools/`，不写入 .env。不要与其他故障验收或人工演示并行运行。前六阶段验收同样应在独立虚拟主机中串行运行，阶段 6 脚本已补齐事件记录清理。

本地手动验证网关入口为 `scripts/payment-test-gateway.mjs`，需显式 `GULIMALL_ACCEPTANCE=1`，只监听本机；它是测试工具，不能作为支付宝沙箱或正式支付服务。真实沙箱、公网回调、实体手机、多浏览器、集群和负载压测不在本轮已验收范围。

2026-10-25 本地验收已通过：本阶段 15 个业务场景、前六阶段 44 个回归场景，合计 59 个；22 项默认 Java、9 项 Node、PowerShell 自检及前端 lint/build 通过。浏览器以专用双 SKU 提交 ¥3.75 订单，停止 RabbitMQ 后付款确认但库存处理中、后台禁止发货；恢复后自动完成扣减。流水及工作单各一条，1200px / 375px 无横向溢出。专用数据、虚拟主机与本机测试进程已清理，默认配置已恢复；原始日志与截图在忽略的 `.tools/stage7-*`。用户尚未开通沙箱账号，真实沙箱及公网通知未执行。
