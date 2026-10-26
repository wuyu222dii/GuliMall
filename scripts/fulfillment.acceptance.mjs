import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, randomInt } from 'node:crypto'
import { testConfig, createPaymentGateway, providerTime } from './payment-test-gateway.mjs'
if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1; only use the isolated local *_test environment.')
await assertTestEnvironment()
const base = 'http://127.0.0.1:88', label = 'stage8_' + randomUUID().replaceAll('-', ''), vhost = label
const baseline = { ...process.env }, accounts = [], config = testConfig('.tools/stage8-test-config.json')
let gateway, productId, sku, vhostCreated = false, rabbitStopped = false
function sql(input) { const r = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim() }
function command(program, args) { const r = spawnSync(program, args, { stdio: 'ignore', timeout: 30000, windowsHide: true }); assert.equal(r.status, 0, 'Local fixture command failed') }
function redis(args) { command('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', '--raw', ...args]) }
function service(action, module, local = true) {
  const env = { ...baseline }
  if (local && gateway) Object.assign(env, { SPRING_PROFILES_ACTIVE: 'dev,test,payment-test', SPRING_RABBITMQ_VIRTUAL_HOST: vhost, ALIPAY_APP_ID: config.appId, ALIPAY_PRIVATE_KEY: config.merchantPrivate, ALIPAY_PUBLIC_KEY: config.providerPublic, ALIPAY_SELLER_ID: config.sellerId, ALIPAY_NOTIFY_URL: config.notifyUrl, ALIPAY_RETURN_URL: config.returnUrl, ALIPAY_GATEWAY_URL: gateway.url + '/gateway.do' })
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
async function management(path) {
  const r = await fetch('http://127.0.0.1:15673/api' + path, { headers: { Authorization: 'Basic ' + Buffer.from(`${baseline.RABBITMQ_USER}:${baseline.RABBITMQ_PASSWORD}`).toString('base64') }, signal: AbortSignal.timeout(10000) })
  assert.ok(r.ok, 'Scoped RabbitMQ fixture request failed: ' + r.status); const text = await r.text(); return text ? JSON.parse(text) : null
}
const vp = encodeURIComponent(vhost)
const view = async (sn, client = a) => (await ok(client, `/api/order/mine/${sn}/payment-status`)).payment
const stockRow = () => sql(`SELECT stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku};`).split('\t').map(Number)
const internalStock = (path, method = 'GET', body) => ok(guest, 'http://127.0.0.1:11000/internal/stock' + path, method, body, { 'X-Internal-Token': baseline.INTERNAL_API_TOKEN })
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
async function ready() {
  await until(async () => (await guest.call('http://127.0.0.1:9000/order/mine')).status === 401, 'Order service not ready')
  await until(async () => (await guest.call('http://127.0.0.1:11000/internal/stock/' + 'a'.repeat(32), 'GET', undefined, { 'X-Internal-Token': baseline.INTERNAL_API_TOKEN })).status === 200, 'Warehouse service not ready')
  await until(async () => (await guest.call('/api/order/mine')).status === 401, 'Order gateway discovery did not recover after restart')
}

test('stage 8 shipment, receipt and cancellation (local payment verification)', { timeout: 900000 }, async t => {
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
    writeFileSync('.tools/stage8-fixtures.json', JSON.stringify({ label, vhost, accounts, productId, sku }))

    let completed, blocked
    const shipment = { deliveryCompany: '顺丰速运', deliverySn: 'SF-STAGE8-001' }
    const ship = (order, body = shipment) => admin.call(`/api/admin/order/order/${order.id}/ship`, 'POST', body)
    const cancel = (order, client = a) => client.call(`/api/order/mine/${order.id}/cancel`, 'POST', {})
    const receive = (order, client = a) => client.call(`/api/order/mine/${order.id}/receive`, 'POST', {})
    const historyCount = (order, status) => Number(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_order_operate_history WHERE order_id=${order.id} AND order_status=${status};`))
    const detail = async (order, client = a) => ok(client, `/api/order/mine/${order.id}`)
    await t.test('admin filters, details and member boundaries reject spoofing, bypasses and invalid pagination', async () => {
      blocked = await newOrder(); const other = await newOrder(1, b)
      const result = await ok(admin, `/api/admin/order/order/list?orderSn=${blocked.orderSn}&status=0&page=1&limit=1`)
      assert.equal(result.page.totalCount, 1); assert.equal(result.page.list[0].id, blocked.id)
      assert.equal((await ok(admin, `/api/admin/order/order/list?orderSn=${blocked.orderSn}&status=1`)).page.totalCount, 0)
      for (const query of ['status=10', 'status=paid', 'orderSn=%27or1', 'page=x', 'page=0', 'limit=101']) assert.equal((await admin.call('/api/admin/order/order/list?' + query)).status, 400)
      assert.equal((await a.call('/api/order/mine?page=x')).status, 400)
      const snapshot = await detail(blocked), adminDetail = await ok(admin, `/api/admin/order/order/info/${blocked.id}`)
      const progress=await ok(admin,`/api/admin/order/order/${blocked.id}/processing`)
      assert.equal(progress.processing.orderStatus,blocked.status);assert(Array.isArray(progress.processing.events));assert(!JSON.stringify(progress).includes('last_error'))
      assert.equal((await guest.call(`/api/admin/order/order/${blocked.id}/processing`)).status,401)
      assert.equal((await a.call(`/api/admin/order/order/${blocked.id}/processing`)).status,403)
      assert.equal((await b.call(`/api/admin/order/order/${blocked.id}/processing`)).status,403)
      assert.equal(snapshot.items.length, 1); assert.equal(snapshot.order.receiverName, accounts[0].username); assert(snapshot.history.some(h => h.orderStatus === 0)); assert.deepEqual(adminDetail.items, snapshot.items)
      assert.equal((await b.call(`/api/order/mine/${blocked.id}`)).status, 403)
      assert.equal((await cancel(blocked, b)).status, 403); assert.equal((await receive(blocked, b)).status, 403)
      assert.equal((await a.call(`/api/order/mine/${blocked.id}/cancel`, 'POST', { memberId: b.memberId }, { 'X-Cart-Owner': String(b.memberId) })).status, 409)
      assert((await ok(a, '/api/order/mine?memberId=' + b.memberId)).page.list.every(o => o.memberId === a.memberId))
      assert.equal((await guest.call(`/api/admin/order/order/${blocked.id}/ship`, 'POST', shipment)).status, 401)
      assert.equal((await a.call(`/api/admin/order/order/${blocked.id}/ship`, 'POST', shipment)).status, 403)
      assert.equal((await a.call(`http://127.0.0.1:9000/order/order/${blocked.id}/ship`, 'POST', shipment)).status, 403)
      assert.equal((await admin.call(`/api/admin/order/order/${blocked.id}/ship`, 'POST', shipment, { 'X-CSRF-Token': 'invalid' })).status, 403)
      assert.equal((await a.call(`/api/order/mine/${blocked.id}/cancel`, 'POST', {}, { 'X-CSRF-Token': 'invalid' })).status, 403)
      assert.equal((await a.call(`/api/order/mine/${blocked.id}/receive`, 'POST', {}, { 'X-CSRF-Token': 'invalid' })).status, 403)
      assert.equal((await admin.call(`/api/admin/order/order/${blocked.id}/ship`)).status, 405)
      assert.equal((await admin.call('/api/admin/order/order/info/999999999')).status, 404)
      assert.equal((await cancel(other)).status, 403)
    })
    await t.test('pending and paid-but-unsettled orders cannot ship; invalid logistics cannot be saved', async () => {
      assert.equal((await ship(blocked)).status, 409); assert.equal((await receive(blocked)).status, 409)
      for (const invalid of [{}, { deliveryCompany: '', deliverySn: 'SF123' }, { deliveryCompany: '顺丰', deliverySn: '../abc' }, { deliveryCompany: 'A\nB\rC', deliverySn: 'SF123' }, { deliveryCompany: '顺丰', deliverySn: 'S'.repeat(65) }]) assert.equal((await ship(blocked, invalid)).status, 400)
      command('docker', ['compose', 'stop', 'rabbitmq']); rabbitStopped = true
      try {
        await paid(blocked); const o = (await view(blocked.orderSn)).order
        assert.equal(o.status, 1); assert.equal(o.inventoryStatus, 0); assert.equal(o.fulfillmentReady, false)
        assert.equal((await ship(blocked)).status, 409); assert.equal((await receive(blocked)).status, 409); assert.equal((await cancel(blocked)).status, 409)
        assert.equal(historyCount(blocked, 2), 0)
      } finally { command('docker', ['compose', 'start', 'rabbitmq']); rabbitStopped = false }
      await settled(blocked); completed = blocked
    })
    await t.test('twenty concurrent shipment requests preserve one shipment, history entry and inventory deduction', async () => {
      const before = stockRow()
      const results = await Promise.all(Array.from({ length: 20 }, () => ship(completed)))
      assert(results.every(r => r.status === 200 && r.data.order.status === 2)); assert.equal(historyCount(completed, 2), 1)
      assert.equal(new Set(results.map(r => r.data.order.deliveryTime)).size, 1); assert.deepEqual(stockRow(), before)
      const d = await detail(completed); assert.equal(d.order.deliveryCompany, shipment.deliveryCompany); assert.equal(d.order.deliverySn, shipment.deliverySn); assert(d.order.deliveryTime)
      assert.equal((await ship(completed, { ...shipment, deliverySn: 'DIFFERENT' })).status, 409)
      assert.equal((await cancel(completed)).status, 409); assert.equal((await receive(completed, b)).status, 403)
    })
    await t.test('receipt is owned and idempotent; completion and logistics survive order restart', async () => {
      const before = stockRow(), results = await Promise.all(Array.from({ length: 20 }, () => receive(completed)))
      assert(results.every(r => r.status === 200 && r.data.order.status === 3 && r.data.order.confirmStatus === 1)); assert.equal(historyCount(completed, 3), 1)
      assert.equal(new Set(results.map(r => r.data.order.receiveTime)).size, 1); assert.deepEqual(stockRow(), before)
      assert.equal((await receive(completed, b)).status, 403); assert.equal((await receive(completed, admin)).status, 403)
      assert.equal((await cancel(completed)).status, 409); assert.equal((await ship(completed)).status, 200)
      service('Stop', 'order'); service('Start', 'order'); await ready()
      const d = await detail(completed); assert.equal(d.order.status, 3); assert.equal(d.order.deliverySn, shipment.deliverySn); assert(d.order.receiveTime)
      assert.equal(d.history.filter(h => h.orderStatus === 2).length, 1); assert.equal(d.history.filter(h => h.orderStatus === 3).length, 1)
    })
    await t.test('concurrent cancellation of an unissued order closes once and releases inventory once', async () => {
      const order = await newOrder(2), before = stockRow()
      const results = await Promise.all(Array.from({ length: 12 }, () => cancel(order)))
      assert(results.every(r => r.status === 200 && [4, 8].includes(r.data.order.status))); await settled(order, 4)
      assert.equal(stockRow()[0], before[0]); assert.equal(stockRow()[1], before[1] - 2)
      assert.equal(historyCount(order, 8), 1); assert.equal(historyCount(order, 4), 1)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type='STOCK_RELEASE';`), '1')
      assert.equal((await cancel(order)).data.order.status, 4); assert.equal((await ship(order)).status, 409); assert.equal((await receive(order)).status, 409)
      assert.equal(historyCount(order, 4), 1)
    })
    await t.test('provider outage and unknown closure keep cancellation durable and stock locked across restart', async () => {
      const order = await newOrder(2); await issued(order); const before = stockRow(); gateway.options.down = true
      const result = await cancel(order); assert.equal(result.status, 200); assert.equal(result.data.order.status, 8); assert.deepEqual(stockRow(), before)
      service('Stop', 'order'); service('Start', 'order'); await ready()
      assert.equal((await view(order.orderSn)).order.status, 8); assert.deepEqual(stockRow(), before); assert.equal((await ship(order)).status, 409)
      gateway.options.down = false; gateway.options.closeUnknown = true
      assert.equal((await cancel(order)).data.order.status, 8); assert.deepEqual(stockRow(), before)
      gateway.options.closeUnknown = false; await cancel(order); await settled(order, 4)
      assert.equal(historyCount(order, 8), 1); assert.equal(historyCount(order, 4), 1); assert.equal(stockRow()[1], before[1] - 2)
    })
    await t.test('an issued form with an absent provider trade cannot falsely confirm cancellation', async () => {
      const order = await newOrder(); await issued(order, false); const before = stockRow()
      assert.equal((await cancel(order)).data.order.status, 8); assert.deepEqual(stockRow(), before)
      gateway.put(order.orderSn, { state: 'TRADE_CLOSED', amount: '0.10' }); await cancel(order); await settled(order, 4)
    })
    await t.test('concurrent payment and manual cancellation choose one stock decision; late payment blocks fulfillment', async () => {
      let paidCount = 0, closedCount = 0, closedOrder
      for (const delay of [0, 600, 0, 600]) {
        const order = await newOrder(); await issued(order); gateway.options.closeDelay = 30
        await Promise.all([cancel(order), (async () => {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay))
          if (gateway.trades.get(order.orderSn).state === 'WAIT_BUYER_PAY') { gateway.put(order.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); assert.equal((await gateway.notify(order.orderSn)).body, 'success') }
        })()])
        await until(async () => { const o = (await view(order.orderSn)).order; return [1, 4].includes(o.status) && o.inventoryStatus > 0 }, 'Payment/cancel race did not settle')
        const o = (await view(order.orderSn)).order, state = (await internalStock('/' + order.orderSn)).data.state
        if (o.status === 1) { paidCount++; assert.equal(state, 'DEDUCTED'); assert(o.fulfillmentReady) } else { closedCount++; closedOrder = order; assert.equal(state, 'RELEASED') }
        assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_trade_event WHERE order_sn='${order.orderSn}' AND event_type IN('STOCK_DEDUCT','STOCK_RELEASE');`), '1')
      }
      gateway.options.closeDelay = 0; assert(paidCount > 0 && closedCount > 0)
      gateway.put(closedOrder.orderSn, { state: 'TRADE_SUCCESS', paidAt: providerTime() }); assert.equal((await gateway.notify(closedOrder.orderSn)).body, 'success')
      const exception = (await view(closedOrder.orderSn)).order; assert.equal(exception.status, 9); assert.equal(exception.inventoryStatus, 2); assert.equal(exception.fulfillmentReady, false)
      assert.equal((await ship(closedOrder)).status, 409); assert.equal((await receive(closedOrder)).status, 409); assert.equal((await cancel(closedOrder)).status, 409)
    })
    await t.test('legacy CRUD cannot forge status, logistics or operation history', async () => {
      assert.equal((await admin.call('/api/admin/order/order/update', 'POST', { id: completed.id, status: 2, deliverySn: 'FORGED' })).status, 409)
      for (const [operation, body] of [['save', { orderId: completed.id, orderStatus: 2 }], ['update', { id: 1, note: 'FORGED' }], ['delete', [1]]]) assert.equal((await admin.call('/api/admin/order/orderoperatehistory/' + operation, 'POST', body)).status, 409)
      assert.equal((await detail(completed)).order.deliverySn, shipment.deliverySn)
    })

  } finally {
    if (rabbitStopped) command('docker', ['compose', 'start', 'rabbitmq'])
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
