import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID, randomInt } from 'node:crypto'
import { createServer } from 'node:http'
if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1; only use the isolated local *_demo environment.')
const base = 'http://127.0.0.1:88', label = 'stage6_' + randomUUID().replaceAll('-', '')
const accounts = [], stopped = new Set(), sockets = new Set()
let productId, sku1, sku2, warehouseId, proxy, proxyUrl, dropLocks = false, committed, notifyCommit
function sql(input) { const r = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim() }
function redis(args) { const r = spawnSync('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', '--raw', ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim() }
function service(action, module, stockUrl) {
  const env = { ...process.env }; delete env.ORDER_STOCK_URL; if (stockUrl) env.ORDER_STOCK_URL = stockUrl
  const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/services.ps1', action, '-Modules', module], { env, stdio: 'ignore', windowsHide: true, timeout: 30000 }); assert.equal(r.status, 0, 'Local service command failed')
  if (action === 'Stop') stopped.add(module); else stopped.delete(module)
}
async function until(check, message, attempts = 70) { for (let i = 0; i < attempts; i++) { try { if (await check()) return } catch {} await new Promise(r => setTimeout(r, 1000)) } assert.fail(message) }
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body, headers = {}) {
    const r = await fetch(path.startsWith('http:') ? path : base + path, { method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) })
    const c = r.headers.getSetCookie().find(c => c.startsWith('GULIMALLSESSION=')); if (c) this.cookie = c.split(';')[0]
    const data = await r.json(); if (data.csrfToken) this.csrf = data.csrfToken; return { status: r.status, data }
  }
}
const admin = new Client(), a = new Client(), b = new Client(), guest = new Client()
async function ok(client, path, method = 'GET', body, headers) { const r = await client.call(path, method, body, headers); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.code, 0, r.data.msg); return r.data }
async function internal(path, method = 'GET', body) { return ok(guest, 'http://127.0.0.1:11000/internal/stock' + path, method, body, { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }) }
const cart = async (client = a) => (await ok(client, '/api/cart')).cart
const confirm = async (client = a) => (await ok(client, '/api/order/mine/confirm', 'POST', {})).confirmation
const submit = async (confirmation, client = a, extra = {}) => (await ok(client, '/api/order/mine/submit', 'POST', { token: confirmation.token, addressId: client.addressId, ...extra })).result
const order = async (sn, client = a) => (await ok(client, '/api/order/mine/by-number/' + sn)).result.order
const locked = (sku = sku1) => Number(sql(`SELECT COALESCE(SUM(stock_locked),0) FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=${sku};`))
const taskCount = sn => Number(sql(`SELECT COUNT(*) FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn='${sn}';`))
async function choose(client = a, lines = [[sku1, 1]]) {
  await ok(client, '/api/cart', 'DELETE')
  for (const [skuId, count] of lines) await ok(client, '/api/cart/items', 'POST', { skuId, count })
  return confirm(client)
}
async function releaseFixtures() {
  if (!accounts.length) return
  const ids = accounts.map(v => v.id).join(',')
  const sns = sql(`SELECT order_sn FROM gulimall_oms_demo.oms_order WHERE member_id IN(${ids});`).split('\n').filter(Boolean)
  for (const sn of sns) await internal('/' + sn + '/release', 'POST')
  sql(`UPDATE gulimall_oms_demo.oms_order SET status=4,cart_cleaned=1 WHERE member_id IN(${ids});`)
}
async function readyOrder() { await until(async () => (await a.call('/api/order/mine')).status === 200, 'Order service did not recover') }
async function startProxy() {
  proxy = createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk)
      const upstream = await fetch('http://127.0.0.1:11000' + req.url, { method: req.method, headers: { 'Content-Type': 'application/json', 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }, body: req.method === 'GET' ? undefined : Buffer.concat(chunks), signal: AbortSignal.timeout(20000) })
      const body = await upstream.text()
      if (dropLocks && req.url === '/internal/stock/lock' && upstream.ok) {
        notifyCommit?.(JSON.parse(body)); return // Commit succeeds; deliberately never deliver the lock response.
      }
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' }); res.end(body)
    } catch { if (!res.destroyed) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"code":503,"msg":"test proxy unavailable"}') } }
  })
  proxy.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve)); proxyUrl = `http://127.0.0.1:${proxy.address().port}`
}
function nextCommit() {
  committed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No committed lock observed through the fault proxy')), 45000); timer.unref()
    notifyCommit = (value) => { clearTimeout(timer); resolve(value) }
  }); return committed
}

test('stage 6 durable order creation, atomic reservations and recovery', async t => {
  try {
    await admin.call('/api/auth/csrf'); await ok(admin, '/api/auth/admin/login', 'POST', JSON.parse(readFileSync('.tools/admin-access.json', 'utf8')))
    for (const [client, suffix] of [[a, 'a'], [b, 'b']]) {
      const username = label + suffix, phone = '139' + String(randomInt(100000000)).padStart(8, '0')
      const id = Number(sql(`INSERT INTO gulimall_ums_demo.ums_member(username,password,mobile,status) SELECT '${username}',password,'${phone}',1 FROM gulimall_ums_demo.ums_member WHERE id=900001; SELECT LAST_INSERT_ID();`)); assert.ok(id > 900002); accounts.push({ id, username }); client.memberId = id
      await client.call('/api/auth/csrf'); await ok(client, '/api/auth/login', 'POST', { username, password: 'Demo12345!' })
      client.addressId = (await ok(client, '/api/member/addresses', 'POST', { name: label + suffix, phone, province: '浙江省', city: '杭州市', region: '西湖区', detailAddress: 'Stage 6 isolated test address', defaultStatus: 1 })).id
    }
    const makeSku = (color, price) => ({ skuName: label + color, skuTitle: label + color, price, images: [{ imgUrl: '/demo-product.svg', defaultImg: 1 }], attr: [{ attrId: 900002, attrName: '颜色', attrValue: color }] })
    productId = (await ok(admin, '/api/admin/product/spuinfo/editor', 'POST', { spuName: label, spuDescription: 'Order acceptance fixture', catalogId: 900003, brandId: 900001, weight: '0.1', images: ['/demo-product.svg'], decript: [], baseAttrs: [], skus: [makeSku('Red', '0.10'), makeSku('Blue', '3.45')] })).id
    ;[sku1, sku2] = (await ok(admin, `/api/admin/product/spuinfo/editor/${productId}`)).product.skus.map(v => v.skuId)
    warehouseId = Number(sql(`INSERT INTO gulimall_wms_demo.wms_ware_info(name) VALUES('${label}'); SELECT LAST_INSERT_ID();`))
    sql(`INSERT INTO gulimall_wms_demo.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(${sku1},900001,5,0),(${sku2},900001,5,0);`)
    await ok(admin, `/api/admin/product/search-sync/${productId}/publish?status=1`, 'POST')

    await t.test('authentication, CSRF, token ownership and address ownership are checked by services', async () => {
      assert.equal((await guest.call('/api/order/mine/confirm', 'POST', {})).status, 401)
      assert.equal((await admin.call('/api/order/mine/confirm', 'POST', {})).status, 403)
      assert.equal((await guest.call('http://127.0.0.1:9000/order/mine/confirm', 'POST', {}, { 'X-Member-Id': String(a.memberId) })).status, 401)
      const missing = new Client(); missing.cookie = a.cookie; assert.equal((await missing.call('/api/order/mine/confirm', 'POST', {})).status, 403)
      assert.equal((await guest.call('http://127.0.0.1:11000/internal/stock/' + 'a'.repeat(32))).status, 403)
      const c = await choose()
      assert.equal((await b.call('/api/order/mine/submit', 'POST', { token: c.token, addressId: b.addressId })).status, 403)
      assert.equal((await a.call('/api/order/mine/submit', 'POST', { token: c.token, addressId: b.addressId })).status, 403)
      assert.equal((await a.call('/api/order/mine/confirm', 'POST', {}, { 'X-Cart-Owner': String(b.memberId) })).status, 409)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_demo.oms_order WHERE member_id=${a.memberId};`), '0')
    })
    await t.test('expired, retired, changed-price and off-shelf confirmations cannot create orders', async () => {
      const c = await choose(); sql(`UPDATE gulimall_oms_demo.oms_order_submit SET expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE token='${c.token}';`)
      assert.equal((await a.call('/api/order/mine/submit', 'POST', { token: c.token, addressId: a.addressId })).status, 409)
      const retired = await confirm(); await ok(a, `/api/order/mine/submissions/${retired.token}/retire`, 'POST', {})
      assert.equal((await a.call('/api/order/mine/submit', 'POST', { token: retired.token, addressId: a.addressId })).status, 409)
      const price = await confirm(); await ok(admin, '/api/admin/product/skuinfo/update', 'POST', { skuId: sku1, price: '0.11' })
      assert.equal((await a.call('/api/order/mine/submit', 'POST', { token: price.token, addressId: a.addressId })).status, 409)
      await ok(admin, '/api/admin/product/skuinfo/update', 'POST', { skuId: sku1, price: '0.10' })
      const shelf = await confirm(); await ok(admin, `/api/admin/product/search-sync/${productId}/publish?status=0`, 'POST')
      assert.equal((await a.call('/api/order/mine/submit', 'POST', { token: shelf.token, addressId: a.addressId })).status, 409)
      await ok(admin, `/api/admin/product/search-sync/${productId}/publish?status=1`, 'POST')
      assert.equal(locked(), 0)
    })
    await t.test('server totals and order/address snapshots ignore client prices and member IDs', async () => {
      const c = await choose(a, [[sku1, 3], [sku2, 2]])
      assert.equal(c.totalAmount, 7.2)
      const result = await submit(c, a, { memberId: b.memberId, payAmount: 0.01, price: 0, items: [] })
      const o = result.order; assert.equal(o.memberId, a.memberId); assert.equal(o.payAmount, 7.2); assert.equal(o.freightAmount, 0); assert.equal(o.status, 0); assert.ok(o.paymentDeadline)
      assert.equal(result.items.length, 2); assert.equal(result.items.find(i => i.skuId === sku1).realAmount, 0.3); assert.ok(result.items[0].skuAttrsVals.includes('颜色'))
      assert.equal((await cart()).items.length, 0); assert.equal(locked(), 3); assert.equal(locked(sku2), 2)
      assert.equal((await b.call('/api/order/mine/' + o.id)).status, 403); assert.equal((await b.call('/api/order/mine/by-number/' + o.orderSn)).status, 403)
      assert.equal((await b.call('/api/order/mine/submissions/' + c.token)).status, 403)
      assert.equal((await ok(b, '/api/order/mine')).page.list.length, 0)
      const address = (await ok(a, '/api/member/addresses/' + a.addressId)).memberReceiveAddress
      await ok(a, '/api/member/addresses/' + a.addressId, 'PUT', { ...address, name: 'Changed after order' })
      assert.notEqual((await order(o.orderSn)).receiverName, 'Changed after order')
      await ok(admin, '/api/admin/product/skuinfo/update', 'POST', { skuId: sku1, price: '0.12' })
      assert.equal((await ok(a, '/api/order/mine/' + o.id)).items.find(i => i.skuId === sku1).skuPrice, 0.1)
      await ok(admin, '/api/admin/product/skuinfo/update', 'POST', { skuId: sku1, price: '0.10' })
      assert.equal((await admin.call('/api/admin/order/order/update', 'POST', { id: o.id, status: 4 })).status, 409)
      await releaseFixtures()
    })
    await t.test('concurrent duplicate submissions consume one token and lock exactly once', async () => {
      const c = await choose(a, [[sku1, 2]])
      const results = await Promise.all(Array.from({ length: 20 }, () => submit(c)))
      const sns = new Set(results.map(v => v.order.orderSn)); assert.equal(sns.size, 1); const sn = [...sns][0]
      await until(async () => (await order(sn)).status === 0, 'Duplicate submission did not settle')
      assert.equal(taskCount(sn), 1); assert.equal(locked(), 2)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_demo.oms_order_submit WHERE token='${c.token}' AND order_sn='${sn}';`), '1')
      sql(`UPDATE gulimall_oms_demo.oms_order_submit SET expires_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE token='${c.token}';`)
      assert.equal((await submit(c)).order.orderSn, sn)
      const retired = await ok(a, `/api/order/mine/submissions/${c.token}/retire`, 'POST', {}); assert.equal(retired.result.order.orderSn, sn)
      assert.equal(locked(), 2); await releaseFixtures()
    })
    await t.test('two members racing for the last unit produce only one payable order', async () => {
      sql(`UPDATE gulimall_wms_demo.wms_ware_sku SET stock=1 WHERE sku_id=${sku1};`)
      const ca = await choose(a), cb = await choose(b)
      const [ra, rb] = await Promise.all([submit(ca, a), submit(cb, b)])
      const statuses = [(await order(ra.order.orderSn, a)).status, (await order(rb.order.orderSn, b)).status].sort()
      assert.deepEqual(statuses, [0, 4]); assert.equal(locked(), 1)
      const winner = (await order(ra.order.orderSn, a)).status === 0 ? a : b, loser = winner === a ? b : a
      assert.equal((await cart(winner)).items.length, 0); assert.equal((await cart(loser)).items[0].count, 1)
      await releaseFixtures(); sql(`UPDATE gulimall_wms_demo.wms_ware_sku SET stock=5 WHERE sku_id=${sku1};`)
    })
    await t.test('one insufficient line rolls back every reservation and records a release fence', async () => {
      sql(`UPDATE gulimall_wms_demo.wms_ware_sku SET stock=1 WHERE sku_id=${sku2};`)
      const c = await choose(a, [[sku1, 2], [sku2, 2]]), result = await submit(c)
      assert.equal(result.order.status, 4); assert.equal(locked(), 0); assert.equal(locked(sku2), 0); assert.equal((await cart()).items.length, 2)
      const state = (await internal('/' + result.order.orderSn)).data; assert.equal(state.state, 'RELEASED'); assert.equal(state.details.length, 0)
      assert.equal((await internal('/lock', 'POST', { orderSn: result.order.orderSn, items: [{ skuId: sku1, count: 2 }] })).data.state, 'RELEASED'); assert.equal(locked(), 0)
      sql(`UPDATE gulimall_wms_demo.wms_ware_sku SET stock=5 WHERE sku_id=${sku2};`)
    })
    await t.test('a SKU uses one sufficient warehouse and never splits a quantity across warehouses', async () => {
      sql(`UPDATE gulimall_wms_demo.wms_ware_sku SET stock=2 WHERE sku_id=${sku1}; INSERT INTO gulimall_wms_demo.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(${sku1},${warehouseId},2,0);`)
      assert.equal((await submit(await choose(a, [[sku1, 3]]))).order.status, 4); assert.equal(locked(), 0)
      sql(`UPDATE gulimall_wms_demo.wms_ware_sku SET stock=3 WHERE sku_id=${sku1} AND ware_id=${warehouseId};`)
      const result = await submit(await confirm()); assert.equal(result.order.status, 0)
      const details = (await internal('/' + result.order.orderSn)).data.details; assert.equal(details.length, 1); assert.equal(details[0].ware_id, warehouseId); assert.equal(details[0].sku_num, 3)
      await releaseFixtures(); sql(`DELETE FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=${sku1} AND ware_id=${warehouseId}; UPDATE gulimall_wms_demo.wms_ware_sku SET stock=5 WHERE sku_id=${sku1};`)
    })

    await t.test('warehouse outage preserves creating requests and retries without removing the cart', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const c = await choose(); service('Stop', 'ware')
      const result = await submit(c); assert.equal(result.order.status, 6); assert.equal((await cart()).items[0].count, 1)
      service('Start', 'ware'); await until(async () => (await order(result.order.orderSn)).status === 0, 'Creating order did not recover after warehouse restart')
      assert.equal(locked(), 1); assert.equal((await submit(c)).order.orderSn, result.order.orderSn); await releaseFixtures()
    })
    await t.test('cart cleanup survives restart and preserves edited lines including quantity ABA changes', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const c = await choose(a, [[sku1, 2]]); service('Stop', 'cart')
      const result = await submit(c); assert.equal(result.order.status, 0); assert.equal(result.order.cartCleaned, 0)
      service('Stop', 'order'); service('Start', 'cart'); await until(async () => (await cart()).items.length === 1, 'Cart did not recover')
      await ok(a, '/api/cart/items/count', 'PUT', { skuId: sku1, count: 3 }); await ok(a, '/api/cart/items/count', 'PUT', { skuId: sku1, count: 2 }); await ok(a, '/api/cart/items', 'POST', { skuId: sku2, count: 1 })
      service('Start', 'order'); await readyOrder(); await until(async () => (await order(result.order.orderSn)).cartCleaned === 1, 'Cart cleanup did not recover')
      assert.equal((await cart()).items.length, 2); assert.equal((await cart()).items.find(i => i.skuId === sku1).count, 2)
      assert.equal((await submit(c)).order.orderSn, result.order.orderSn); assert.equal((await cart()).items.length, 2); await releaseFixtures()
    })
    await t.test('a committed lock with its response lost is queried and never locked twice', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      await startProxy(); const c = await choose(a, [[sku1, 2]])
      service('Stop', 'order'); service('Start', 'order', proxyUrl); await readyOrder(); dropLocks = true; const observed = nextCommit()
      const pending = submit(c); pending.catch(() => {}); await observed; const result = await pending
      assert.ok([0, 6].includes(result.order.status)); assert.equal(locked(), 2); assert.equal(taskCount(result.order.orderSn), 1)
      dropLocks = false; assert.equal((await submit(c)).order.status, 0); assert.equal(locked(), 2)
      service('Stop', 'order'); service('Start', 'order'); await readyOrder(); await releaseFixtures()
    })
    await t.test('an order process killed after lock commit recovers the same order on restart', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const c = await choose(a, [[sku1, 2]])
      service('Stop', 'order'); service('Start', 'order', proxyUrl); await readyOrder(); dropLocks = true; const observed = nextCommit()
      const pending = submit(c).catch(() => null); await observed; service('Stop', 'order'); await pending
      const sn = sql(`SELECT order_sn FROM gulimall_oms_demo.oms_order_submit WHERE token='${c.token}';`); assert.equal(locked(), 2); assert.equal(sql(`SELECT status FROM gulimall_oms_demo.oms_order WHERE order_sn='${sn}';`), '6')
      dropLocks = false; service('Start', 'order'); await readyOrder(); await until(async () => (await order(sn)).status === 0, 'Order did not recover after process kill')
      assert.equal((await submit(c)).order.orderSn, sn); assert.equal(taskCount(sn), 1); assert.equal(locked(), 2); await releaseFixtures()
    })
    await t.test('expired creating orders keep locks during unknown release, then close and fence late locks', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const c = await choose(a, [[sku1, 2]])
      service('Stop', 'order'); service('Start', 'order', proxyUrl); await readyOrder(); dropLocks = true; const observed = nextCommit()
      const pending = submit(c).catch(() => null); await observed; service('Stop', 'order'); await pending
      const sn = sql(`SELECT order_sn FROM gulimall_oms_demo.oms_order_submit WHERE token='${c.token}';`)
      service('Stop', 'ware'); sql(`UPDATE gulimall_oms_demo.oms_order SET creation_deadline=DATE_SUB(NOW(),INTERVAL 1 SECOND),recovery_after=NOW() WHERE order_sn='${sn}';`)
      dropLocks = false; service('Start', 'order'); await readyOrder(); await until(async () => (await order(sn)).status === 7, 'Expired order did not enter closing')
      assert.equal(locked(), 2); assert.equal((await cart()).items[0].count, 2)
      service('Start', 'ware'); await until(async () => (await order(sn)).status === 4, 'Closing order did not confirm release')
      assert.equal(locked(), 0); assert.equal((await internal('/lock', 'POST', { orderSn: sn, items: [{ skuId: sku1, count: 2 }] })).data.state, 'RELEASED'); assert.equal(locked(), 0)
    })
  } finally {
    for (const module of [...stopped]) service('Start', module)
    if (proxy) { service('Stop', 'order'); service('Start', 'order'); for (const socket of sockets) socket.destroy(); await new Promise(resolve => proxy.close(resolve)) }
    if (accounts.length) {
      await until(async () => (await a.call('/api/order/mine')).status === 200, 'Order service unavailable for fixture cleanup')
      await releaseFixtures()
      const ids = accounts.map(v => v.id).join(',')
      const sns = sql(`SELECT order_sn FROM gulimall_oms_demo.oms_order WHERE member_id IN(${ids});`).split('\n').filter(Boolean)
      for (const sn of sns) {
        sql(`DELETE FROM gulimall_wms_demo.wms_ware_order_task_detail WHERE task_id IN(SELECT id FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn='${sn}'); DELETE FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn='${sn}'; DELETE FROM gulimall_oms_demo.oms_order_operate_history WHERE order_id IN(SELECT id FROM gulimall_oms_demo.oms_order WHERE order_sn='${sn}'); DELETE FROM gulimall_oms_demo.oms_order_item WHERE order_sn='${sn}';`)
      }
      sql(`DELETE FROM gulimall_oms_demo.oms_order_submit WHERE member_id IN(${ids}); DELETE FROM gulimall_oms_demo.oms_order WHERE member_id IN(${ids}); DELETE FROM gulimall_ums_demo.ums_member_receive_address WHERE member_id IN(${ids});`)
    }
    if (productId) {
      await until(async () => (await admin.call(`/api/admin/product/search-sync/${productId}/publish?status=0`, 'POST')).status === 200, 'Fixture index cleanup failed')
      if (sku1 && sku2) sql(`DELETE FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id IN(${sku1},${sku2}); DELETE FROM gulimall_pms_demo.pms_sku_images WHERE sku_id IN(${sku1},${sku2}); DELETE FROM gulimall_pms_demo.pms_sku_sale_attr_value WHERE sku_id IN(${sku1},${sku2}); DELETE FROM gulimall_pms_demo.pms_sku_info WHERE spu_id=${productId};`)
      sql(`DELETE FROM gulimall_pms_demo.pms_search_sync WHERE spu_id=${productId}; DELETE FROM gulimall_pms_demo.pms_product_attr_value WHERE spu_id=${productId}; DELETE FROM gulimall_pms_demo.pms_spu_images WHERE spu_id=${productId}; DELETE FROM gulimall_pms_demo.pms_spu_info_desc WHERE spu_id=${productId}; DELETE FROM gulimall_pms_demo.pms_spu_info WHERE id=${productId} AND spu_name='${label}';`)
    }
    if (warehouseId) sql(`DELETE FROM gulimall_wms_demo.wms_ware_info WHERE id=${warehouseId} AND name='${label}';`)
    for (const account of accounts) { redis(['DEL', `gulimall:cart:{${account.id}}:items`, `gulimall:cart:{${account.id}}:merges`, `gulimall:cart:{${account.id}}:orders`]); sql(`DELETE FROM gulimall_ums_demo.ums_member WHERE id=${account.id} AND username='${account.username}';`) }
    for (const client of [a, b, admin]) await client.call('/api/auth/logout', 'POST')
  }
})
