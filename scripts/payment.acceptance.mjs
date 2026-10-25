import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, randomInt } from 'node:crypto'
import { createServer } from 'node:http'
import { testConfig, createPaymentGateway, providerTime } from './payment-test-gateway.mjs'
if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1; only use the isolated local *_test environment.')
await assertTestEnvironment()
const base = 'http://127.0.0.1:88', label = 'stage7_' + randomUUID().replaceAll('-', ''), vhost = label
const baseline = { ...process.env }, accounts = [], config = testConfig('.tools/stage7-test-config.json')
let gateway, productId, sku, vhostCreated = false, rabbitStopped = false, proxy
const sockets = new Set()
function sql(input) { const r = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim() }
function command(program, args) { const r = spawnSync(program, args, { stdio: 'ignore', timeout: 30000, windowsHide: true }); assert.equal(r.status, 0, 'Local fixture command failed') }
function redis(args) { command('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', '--raw', ...args]) }
function service(action, module, local = true, extra = {}) {
  const env = { ...baseline }
  if (local && gateway) Object.assign(env, { SPRING_PROFILES_ACTIVE: 'dev,test,payment-test', SPRING_RABBITMQ_VIRTUAL_HOST: vhost, ALIPAY_APP_ID: config.appId, ALIPAY_PRIVATE_KEY: config.merchantPrivate, ALIPAY_PUBLIC_KEY: config.providerPublic, ALIPAY_SELLER_ID: config.sellerId, ALIPAY_NOTIFY_URL: config.notifyUrl, ALIPAY_RETURN_URL: config.returnUrl, ALIPAY_GATEWAY_URL: gateway.url + '/gateway.do' })
  Object.assign(env, extra)
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/services.ps1', action, '-Modules', module], { env, stdio: 'ignore', windowsHide: true, timeout: 30000 }); assert.equal(r.status, 0, 'Service command failed')
}
async function until(check, message, attempts = 80) { for (let i = 0; i < attempts; i++) { try { if (await check()) return } catch {} await new Promise(r => setTimeout(r, 1000)) } assert.fail(message) }
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body, headers = {}) {
    const r = await fetch(path.startsWith('http:') ? path : base + path, { method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) })
    const cookie = r.headers.getSetCookie().find(c => c.startsWith('GULIMALLSESSION=')); if (cookie) this.cookie = cookie.split(';')[0]
    const text = await r.text(); let data; try { data = JSON.parse(text) } catch { data = text }
    if (data.csrfToken) this.csrf = data.csrfToken; return { status: r.status, data }
  }
}
const admin = new Client(), a = new Client(), b = new Client(), guest = new Client()
async function ok(client, path, method = 'GET', body, headers) { const r = await client.call(path, method, body, headers); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.code, 0, r.data.msg); return r.data }
async function management(path, method = 'GET', body) {
  const r = await fetch('http://127.0.0.1:15673/api' + path, { method, headers: { Authorization: 'Basic ' + Buffer.from(`${baseline.RABBITMQ_USER}:${baseline.RABBITMQ_PASSWORD}`).toString('base64'), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) })
  assert.ok(r.ok, 'Scoped RabbitMQ fixture request failed: ' + r.status); const text = await r.text(); return text ? JSON.parse(text) : null
}
const vp = encodeURIComponent(vhost), exchange = 'gulimall.trade', queue = 'gulimall.trade.stock'
const publish = (route, id) => management(`/exchanges/${vp}/${exchange}/publish`, 'POST', { properties: { delivery_mode: 2, content_type: 'application/json' }, routing_key: route, payload: JSON.stringify({ eventId: id }), payload_encoding: 'string' })
const view = async (sn, client = a) => (await ok(client, `/api/order/mine/${sn}/payment-status`)).payment
const stockRow = () => sql(`SELECT stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku};`).split('\t').map(Number)
const eventId = (sn, type) => Number(sql(`SELECT id FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${sn}' AND event_type='${type}';`))
const internalStock = (path, method = 'GET', body) => ok(guest, 'http://127.0.0.1:11000/internal/stock' + path, method, body, { 'X-Internal-Token': baseline.INTERNAL_API_TOKEN })
const retry = sn => ok(admin, `/api/admin/order/payments/${sn}/retry`, 'POST', {})
async function newOrder(count = 1, client = a) {
  await ok(client, '/api/cart', 'DELETE'); await ok(client, '/api/cart/items', 'POST', { skuId: sku, count })
  const c = (await ok(client, '/api/order/mine/confirm', 'POST', {})).confirmation
  const result = (await ok(client, '/api/order/mine/submit', 'POST', { token: c.token, addressId: client.addressId })).result
  assert.equal(result.order.status, 0); return result.order
}
const form = async order => (await ok(a, `/api/order/mine/${order.orderSn}/payment`, 'POST', {})).payment
const decode = text => text.replace(/&(#x[\da-f]+|#\d+|quot|apos|amp|lt|gt);/gi, (_, key) => key.startsWith('#') ? String.fromCodePoint(parseInt(key.slice(key[1].toLowerCase() === 'x' ? 2 : 1), key[1].toLowerCase() === 'x' ? 16 : 10)) : ({ quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' }[key.toLowerCase()]))
function formFields(html) {
  const fields = {}
  for (const tag of html.match(/<input\b[^>]*>/gi) || []) { const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1], decode(m[3]) ])); if (attrs.name) fields[attrs.name] = attrs.value }
  return fields
}
async function issued(order, createTrade = true) {
  const payment = await form(order); assert.equal(payment.mode, 'LOCAL_TEST'); const fields = formFields(payment.html)
  const action=decode(payment.html.match(/<form\b[^>]*\baction\s*=\s*(["'])([\s\S]*?)\1/i)[2])
  if (createTrade) { const r = await fetch(action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) }); assert.equal(r.status, 200, await r.text()) }
  return { ...Object.fromEntries(new URL(action).searchParams), ...fields }
}
async function paid(order, count = 1) {
  await issued(order); gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() })
  const notices = await Promise.all(Array.from({ length: count }, () => gateway.notify(order.orderSn))); assert.ok(notices.every(r => r.status === 200 && r.body === 'success'))
}
async function settled(order, status = 1) { await until(async () => { const current = (await view(order.orderSn)).order; return current.status === status && current.inventoryStatus === (status === 1 ? 1 : 2) }, 'Payment/inventory result did not settle') }
const expire = sn => sql(`UPDATE gulimall_oms_test.oms_order SET payment_deadline=DATE_SUB(NOW(),INTERVAL 1 SECOND),recovery_after=NOW() WHERE order_sn='${sn}';`)
async function ready() {
  await until(async () => (await guest.call('http://127.0.0.1:9000/order/mine')).status === 401, 'Order service not ready')
  await until(async () => (await guest.call('http://127.0.0.1:11000/internal/stock/' + 'a'.repeat(32), 'GET', undefined, { 'X-Internal-Token': baseline.INTERNAL_API_TOKEN })).status === 200, 'Warehouse service not ready')
}

test('stage 7 local RSA2, payment decisions and reliable stock events (not live Alipay sandbox)', { timeout: 900000 }, async t => {
  try {
    command('docker', ['compose', 'exec', '-T', 'rabbitmq', 'rabbitmqctl', 'add_vhost', vhost]); vhostCreated = true
    command('docker', ['compose', 'exec', '-T', 'rabbitmq', 'rabbitmqctl', 'set_permissions', '-p', vhost, baseline.RABBITMQ_USER, '.*', '.*', '.*'])
    gateway = await createPaymentGateway({ config }); service('Stop', 'order'); service('Stop', 'ware'); service('Start', 'order'); service('Start', 'ware'); await ready()
    await until(async () => (await management('/queues/' + vp)).length === 4, 'Isolated RabbitMQ topology was not declared')
    await admin.call('/api/auth/csrf'); await ok(admin, '/api/auth/admin/login', 'POST', JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE || '.tools/admin-access.json', 'utf8')))
    for (const [client, suffix] of [[a, 'a'], [b, 'b']]) {
      const username = label + suffix, phone = '136' + String(randomInt(100000000)).padStart(8, '0')
      const id = Number(sql(`INSERT INTO gulimall_ums_test.ums_member(username,password,mobile,status) SELECT '${username}',password,'${phone}',1 FROM gulimall_ums_test.ums_member WHERE id=900001; SELECT LAST_INSERT_ID();`)); assert.ok(id > 900002); accounts.push({ id, username }); client.memberId = id
      await client.call('/api/auth/csrf'); await ok(client, '/api/auth/login', 'POST', { username, password: 'Demo12345!' })
      client.addressId = (await ok(client, '/api/member/addresses', 'POST', { name: username, phone, province: '浙江省', city: '杭州市', region: '西湖区', detailAddress: 'Local payment fixture', defaultStatus: 1 })).id
    }
    productId = (await ok(admin, '/api/admin/product/spuinfo/editor', 'POST', { spuName: label, spuDescription: 'Local payment verification', catalogId: 900003, brandId: 900001, weight: '0.1', images: ['/demo-product.svg'], decript: [], baseAttrs: [], skus: [{ skuName: label, skuTitle: '本地测试 "手机" & 斜杠 \\ 红色', price: '0.10', images: [{ imgUrl: '/demo-product.svg', defaultImg: 1 }], attr: [{ attrId: 900002, attrName: '颜色', attrValue: '红色' }] }] })).id
    sku = (await ok(admin, `/api/admin/product/spuinfo/editor/${productId}`)).product.skus[0].skuId
    sql(`INSERT INTO gulimall_wms_test.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(${sku},900001,100,0);`)
    await until(async () => (await admin.call(`/api/admin/product/search-sync/${productId}/publish?status=1`, 'POST')).status === 200, 'Fixture publication did not recover after discovery refresh')
    writeFileSync('.tools/stage7-fixtures.json', JSON.stringify({ label, vhost, accounts, productId, sku }))

    await t.test('payment endpoints enforce member ownership and CSRF; return parameters never mark paid', async () => {
      const order = await newOrder()
      assert.equal((await guest.call(`/api/order/mine/${order.orderSn}/payment`, 'POST', {})).status, 401)
      assert.equal((await admin.call(`/api/order/mine/${order.orderSn}/payment`, 'POST', {})).status, 403)
      assert.equal((await b.call(`/api/order/mine/${order.orderSn}/payment`, 'POST', {})).status, 403)
      const missing = new Client(); missing.cookie = a.cookie; assert.equal((await missing.call(`/api/order/mine/${order.orderSn}/payment`, 'POST', {})).status, 403)
      assert.equal((await b.call(`/api/order/mine/${order.orderSn}/payment-status`)).status, 403)
      assert.equal((await a.call('/api/order/mine/' + order.orderSn + '/payment-status?trade_status=TRADE_SUCCESS&paid=true')).data.payment.order.status, 0)
      assert.equal((await guest.call('http://127.0.0.1:9000/internal/order/events/1')).status, 403)
      assert.equal((await view(order.orderSn)).mode, 'LOCAL_TEST'); assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_payment_info WHERE order_sn='${order.orderSn}';`), '0')
    })
    await t.test('SDK forms preserve quoted JSON fields and the fixed payment deadline', async () => {
      const order = await newOrder(2), fields = await issued(order), biz = JSON.parse(fields.biz_content)
      assert.equal(biz.total_amount, '0.20'); assert.equal(biz.subject, '本地测试 "手机" & 斜杠 \\ 红色'); assert.equal(biz.time_expire, providerTime(new Date(order.paymentDeadline))); assert.equal(biz.seller_id, config.sellerId)
      assert.equal(sql(`SELECT payment_started FROM gulimall_oms_test.oms_order WHERE order_sn='${order.orderSn}';`), '1')
      const queues = await management('/queues/' + vp); assert.ok(queues.every(q => q.durable))
      assert.equal(queues.find(q => q.name === 'gulimall.trade.delay').arguments['x-message-ttl'], 1800000)
      expire(order.orderSn); assert.equal((await a.call(`/api/order/mine/${order.orderSn}/payment`, 'POST', {})).status, 409)
      await retry(order.orderSn); await settled(order, 4)
    })
    await t.test('invalid signatures, apps, sellers, amounts and trade states cannot change orders', async () => {
      const order = await newOrder(); await issued(order)
      for (const [overrides, status] of [[{ sign: 'invalid' }, 403], [{ app_id: 'other-app' }, 403], [{ seller_id: 'other-seller' }, 403], [{ total_amount: '0.01' }, 409], [{ trade_status: 'UNKNOWN' }, 400]]) assert.equal((await gateway.notify(order.orderSn, { trade_status: 'TRADE_SUCCESS', ...overrides })).status, status)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_payment_info WHERE order_sn='${order.orderSn}';`), '0')
      assert.equal(sql(`SELECT status FROM gulimall_oms_test.oms_order WHERE order_sn='${order.orderSn}';`), '0')
      gateway.put(order.orderSn, { state: 'WAIT_BUYER_PAY', paidAt: null })
    })
    await t.test('concurrent valid notifications create one ledger entry and deduct inventory once', async () => {
      const order = await newOrder(2), before = stockRow()[0]; await paid(order, 20); await settled(order)
      assert.equal(stockRow()[0], before - 2); assert.equal((await view(order.orderSn)).order.fulfillmentReady, true)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_payment_info WHERE order_sn='${order.orderSn}';`), '1'); assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type='STOCK_DEDUCT';`), '1')
      assert.equal((await admin.call('/api/admin/order/order/update', 'POST', { id: order.id, status: 2 })).status, 409)
      const other = await newOrder(); await issued(other); gateway.put(other.orderSn, { tradeNo: gateway.trades.get(order.orderSn).tradeNo, state: 'TRADE_SUCCESS', paidAt: providerTime() })
      assert.equal((await gateway.notify(other.orderSn)).status, 409)
      gateway.put(other.orderSn, { tradeNo: 'test_' + randomUUID().replaceAll('-', ''), state: 'WAIT_BUYER_PAY', paidAt: null })
    })
    await t.test('verified provider queries recover missing callbacks and reject tampered SDK responses', async () => {
      const order = await newOrder(); await issued(order); gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); gateway.options.badResponseSignature = true
      await retry(order.orderSn); assert.equal((await view(order.orderSn)).order.status, 0)
      gateway.options.badResponseSignature = false; await retry(order.orderSn); await settled(order)
    })
    await t.test('expired unpaid orders close through the delayed-message handler and release stock', async () => {
      const order = await newOrder(); await issued(order); const before = stockRow()[0]
      await until(() => sql(`SELECT sent_at IS NOT NULL FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type='CLOSE_TIMER';`) === '1', 'Timer event was not broker-confirmed')
      expire(order.orderSn); await publish('close', eventId(order.orderSn, 'CLOSE_TIMER')); await settled(order, 4)
      assert.equal(stockRow()[0], before); assert.equal(gateway.trades.get(order.orderSn).state, 'TRADE_CLOSED')
      assert.equal((await internalStock('/' + order.orderSn)).data.state, 'RELEASED')
    })
    await t.test('unknown close results and absent issued trades keep reservations until confirmed', async () => {
      const order = await newOrder(); await issued(order, false); expire(order.orderSn); await retry(order.orderSn)
      assert.equal((await view(order.orderSn)).order.status, 8); assert.equal((await internalStock('/' + order.orderSn)).data.state, 'LOCKED')
      gateway.put(order.orderSn, { state: 'WAIT_BUYER_PAY', amount: '0.10' }); gateway.options.closeUnknown = true; await retry(order.orderSn)
      assert.equal((await view(order.orderSn)).order.status, 8); gateway.options.closeUnknown = false; await retry(order.orderSn); await settled(order, 4)
      const unissued = await newOrder(); expire(unissued.orderSn); await retry(unissued.orderSn); await settled(unissued, 4)
    })
    await t.test('late valid payments are recorded as exceptions and cannot re-enter normal fulfillment', async () => {
      const order = await newOrder(); expire(order.orderSn); await retry(order.orderSn); await settled(order, 4); const before = stockRow()[0]
      gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', amount: '0.10', paidAt: providerTime() }); assert.equal((await gateway.notify(order.orderSn)).body, 'success')
      const result = (await view(order.orderSn)).order; assert.equal(result.status, 9); assert.equal(result.fulfillmentReady, false); assert.equal(stockRow()[0], before)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_payment_info WHERE order_sn='${order.orderSn}' AND exception_reason IS NOT NULL;`), '1'); assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type='STOCK_DEDUCT';`), '0')
      assert.equal((await gateway.notify(order.orderSn)).body, 'success')
    })

    await t.test('broker outage plus order restart replays durable payment events without early fulfillment', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const order = await newOrder(), before = stockRow()[0]; await issued(order)
      command('docker', ['compose', 'stop', 'rabbitmq']); rabbitStopped = true
      gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); assert.equal((await gateway.notify(order.orderSn)).body, 'success')
      assert.equal((await view(order.orderSn)).order.fulfillmentReady, false); assert.equal(stockRow()[0], before)
      service('Stop', 'order'); service('Start', 'order'); await ready()
      command('docker', ['compose', 'start', 'rabbitmq']); rabbitStopped = false; await settled(order); assert.equal(stockRow()[0], before - 1)
    })
    await t.test('unroutable mandatory publications stay retryable despite broker ACK', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const order = await newOrder(), before = stockRow()[0]; await issued(order)
      await management(`/bindings/${vp}/e/${exchange}/q/${queue}/stock`, 'DELETE')
      gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); assert.equal((await gateway.notify(order.orderSn)).body, 'success')
      await until(() => sql(`SELECT attempts>0 AND sent_at IS NULL AND last_error IS NOT NULL FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type='STOCK_DEDUCT';`) === '1', 'Unroutable event incorrectly marked sent')
      assert.equal(stockRow()[0], before); await management(`/bindings/${vp}/e/${exchange}/q/${queue}`, 'POST', { routing_key: 'stock', arguments: {} }); await retry(order.orderSn); await settled(order)
      assert.equal(stockRow()[0], before - 1)
    })
    await t.test('duplicate stock messages and stale lock/release calls do not repeat inventory changes', async () => {
      const order = await newOrder(); await paid(order); await settled(order); const before = stockRow()[0], id = eventId(order.orderSn, 'STOCK_DEDUCT')
      await Promise.all(Array.from({ length: 10 }, () => publish('stock', id))); await new Promise(resolve => setTimeout(resolve, 1500))
      assert.equal(stockRow()[0], before); assert.equal((await internalStock('/lock', 'POST', { orderSn: order.orderSn, items: [{ skuId: sku, count: 1 }] })).data.state, 'DEDUCTED')
      assert.equal((await guest.call('http://127.0.0.1:11000/internal/stock/' + order.orderSn + '/release', 'POST', undefined, { 'X-Internal-Token': baseline.INTERNAL_API_TOKEN })).status, 409)
    })
    await t.test('consumer killed after inventory commit recovers before ACK without another deduction', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const order = await newOrder(2), before = stockRow()[0]; await issued(order); service('Stop', 'ware')
      let committed
      const observed = new Promise((resolve, reject) => { committed = resolve; const timer = setTimeout(() => reject(new Error('Inventory completion proxy not reached')), 60000); timer.unref() })
      proxy = createServer(async (req, res) => {
        if (req.method === 'POST') { committed(); return }
        const r = await fetch('http://127.0.0.1:9000' + req.url, { headers: { 'X-Internal-Token': baseline.INTERNAL_API_TOKEN } }); res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(await r.text())
      }); proxy.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) }); await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
      service('Start', 'ware', true, { WARE_ORDER_EVENT_URL: `http://127.0.0.1:${proxy.address().port}` }); await ready()
      gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); assert.equal((await gateway.notify(order.orderSn)).body, 'success'); await observed
      assert.equal(stockRow()[0], before - 2); assert.ok([0,1].includes((await view(order.orderSn)).order.inventoryStatus))
      service('Stop', 'ware'); for (const socket of sockets) socket.destroy(); await new Promise(resolve => proxy.close(resolve)); proxy = null
      service('Start', 'ware'); await ready(); await settled(order); assert.equal(stockRow()[0], before - 2)
    })
    await t.test('a confirmed but lost queue message is repaired by the unconsumed outbox scan', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const order = await newOrder(), before = stockRow()[0]; await issued(order); service('Stop', 'ware')
      gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); assert.equal((await gateway.notify(order.orderSn)).body, 'success')
      await until(() => sql(`SELECT sent_at IS NOT NULL FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type='STOCK_DEDUCT';`) === '1', 'Stock event not confirmed')
      await management(`/queues/${vp}/${queue}/contents`, 'DELETE'); service('Start', 'ware'); await ready()
      sql(`UPDATE gulimall_oms_test.oms_trade_event SET next_attempt=NOW() WHERE order_sn='${order.orderSn}' AND event_type='STOCK_DEDUCT';`)
      await settled(order); assert.equal(stockRow()[0], before - 1)
    })
    await t.test('payment and closure races never create a normally paid order with released stock', async () => {
      let paidCount = 0, closedCount = 0
      for (const delay of [0, 600, 0, 600]) {
        const order = await newOrder(); await issued(order); gateway.options.closeDelay = 30; expire(order.orderSn)
        await Promise.all([retry(order.orderSn), (async () => {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay))
          const trade = gateway.trades.get(order.orderSn)
          if (trade.state === 'WAIT_BUYER_PAY') { gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime(new Date(Date.now() - 10000)) }); assert.equal((await gateway.notify(order.orderSn)).body, 'success') }
        })()])
        await until(async () => { const o = (await view(order.orderSn)).order; return [1, 4].includes(o.status) && o.inventoryStatus > 0 }, 'Race did not settle')
        const o = (await view(order.orderSn)).order, state = (await internalStock('/' + order.orderSn)).data.state
        if (o.status === 1) { paidCount++; assert.equal(state, 'DEDUCTED'); assert.equal(o.fulfillmentReady, true) } else { closedCount++; assert.equal(state, 'RELEASED') }
        assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type IN('STOCK_DEDUCT','STOCK_RELEASE');`), '1')
      }
      gateway.options.closeDelay = 0; assert.ok(paidCount > 0 && closedCount > 0)
    })
    await t.test('signed server notifications and stock consumers continue during Redis Session outage', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const order = await newOrder(); await issued(order); gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() })
      command('docker', ['compose', 'stop', 'redis'])
      try {
        assert.equal((await gateway.notify(order.orderSn)).body, 'success')
        await until(() => sql(`SELECT status=1 AND inventory_status=1 FROM gulimall_oms_test.oms_order WHERE order_sn='${order.orderSn}';`) === '1', 'Server callback incorrectly depended on Redis Session')
      } finally { command('docker', ['compose', 'start', 'redis']) }
      await until(async () => (await view(order.orderSn)).order.fulfillmentReady, 'Redis Session did not recover')
    })
  } finally {
    if (rabbitStopped) command('docker', ['compose', 'start', 'rabbitmq'])
    if (proxy) { for (const socket of sockets) socket.destroy(); await new Promise(resolve => proxy.close(resolve)) }
    service('Stop', 'order'); service('Stop', 'ware')
    try {
      if (accounts.length) {
        const ids = accounts.map(v => v.id).join(','), sns = sql(`SELECT order_sn FROM gulimall_oms_test.oms_order WHERE member_id IN(${ids});`).split('\n').filter(Boolean)
        for (const sn of sns) sql(`DELETE FROM gulimall_wms_test.wms_ware_order_task_detail WHERE task_id IN(SELECT id FROM gulimall_wms_test.wms_ware_order_task WHERE order_sn='${sn}'); DELETE FROM gulimall_wms_test.wms_ware_order_task WHERE order_sn='${sn}'; DELETE FROM gulimall_oms_test.oms_order_operate_history WHERE order_id IN(SELECT id FROM gulimall_oms_test.oms_order WHERE order_sn='${sn}'); DELETE FROM gulimall_oms_test.oms_order_item WHERE order_sn='${sn}'; DELETE FROM gulimall_oms_test.oms_payment_info WHERE order_sn='${sn}'; DELETE FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${sn}';`)
        sql(`DELETE FROM gulimall_oms_test.oms_order_submit WHERE member_id IN(${ids}); DELETE FROM gulimall_oms_test.oms_order WHERE member_id IN(${ids}); DELETE FROM gulimall_ums_test.ums_member_receive_address WHERE member_id IN(${ids});`)
      }
      if (productId) {
        await ok(admin, `/api/admin/product/search-sync/${productId}/publish?status=0`, 'POST')
        if (sku) sql(`DELETE FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku}; DELETE FROM gulimall_pms_test.pms_sku_images WHERE sku_id=${sku}; DELETE FROM gulimall_pms_test.pms_sku_sale_attr_value WHERE sku_id=${sku};`)
        sql(`DELETE FROM gulimall_pms_test.pms_sku_info WHERE spu_id=${productId}; DELETE FROM gulimall_pms_test.pms_search_sync WHERE spu_id=${productId}; DELETE FROM gulimall_pms_test.pms_product_attr_value WHERE spu_id=${productId}; DELETE FROM gulimall_pms_test.pms_spu_images WHERE spu_id=${productId}; DELETE FROM gulimall_pms_test.pms_spu_info_desc WHERE spu_id=${productId}; DELETE FROM gulimall_pms_test.pms_spu_info WHERE id=${productId} AND spu_name='${label}';`)
      }
      for (const account of accounts) { redis(['DEL', `gulimall:cart:{${account.id}}:items`, `gulimall:cart:{${account.id}}:merges`, `gulimall:cart:{${account.id}}:orders`]); sql(`DELETE FROM gulimall_ums_test.ums_member WHERE id=${account.id} AND username='${account.username}';`) }
    } finally {
      if (vhostCreated) command('docker', ['compose', 'exec', '-T', 'rabbitmq', 'rabbitmqctl', 'delete_vhost', vhost])
      if (gateway) await gateway.close()
      service('Start', 'order', false); service('Start', 'ware', false)
    }
    for (const client of [a, b, admin]) if (client.cookie) await client.call('/api/auth/logout', 'POST')
  }
})
