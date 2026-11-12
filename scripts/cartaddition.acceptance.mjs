import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
assert.equal(process.env.GULIMALL_ACCEPTANCE, '1'); await assertTestEnvironment()
const label = 'add41_' + randomUUID().replaceAll('-', ''), members = [], stopped = new Set(), checks = []
let product, sku1, sku2
function command(program, args, input) { const result = spawnSync(program, args, { input, encoding: 'utf8', windowsHide: true, timeout: 30000 }); assert.equal(result.status, 0, 'Verified Test operation failed'); return result.stdout.trim() }
const sql = input => command('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], input)
const redis = args => command('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', '--raw', ...args])
function service(action, module) { command('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/services.ps1', action, '-Modules', module]); if (action === 'Stop') stopped.add(module); else stopped.delete(module) }
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body, headers = {}) {
    const response = await fetch(path.startsWith('http:') ? path : 'http://127.0.0.1:88' + path, { method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000) })
    const cookie = response.headers.getSetCookie().find(v => v.startsWith('GULIMALLSESSION=')); if (cookie) this.cookie = cookie.split(';')[0]
    const data = await response.json(); if (data.csrfToken) this.csrf = data.csrfToken; return { status: response.status, data }
  }
}
const a = new Client(), b = new Client(), c = new Client(), admin = new Client(), guest = new Client()
async function ok(client, path, method = 'GET', body, headers) { const result = await client.call(path, method, body, headers); assert.equal(result.status, 200, result.data.msg); assert.equal(result.data.code, 0, result.data.msg); return result.data }
const request = (skuId = sku1, count = 2) => ({ requestId: randomUUID(), skuId, count })
const add = (body, client = a) => ok(client, '/api/cart/items', 'POST', body)
const receipt = (body, client = a) => ok(client, '/api/cart/items/requests/' + body.requestId)
const view = async (client = a) => (await ok(client, '/api/cart')).cart
const clear = (client = a) => ok(client, '/api/cart', 'DELETE')
const addsKey = client => `gulimall:cart:{${client.id}}:adds`
const raw = (client = a) => redis(['HGET', `gulimall:cart:{${client.id}}:items`, String(sku1)])
async function until(check, message) { for (let i = 0; i < 90; i++) { try { if (await check()) return } catch {} await new Promise(resolve => setTimeout(resolve, 1000)) } assert.fail(message) }
async function scene(t, name, run) { await t.test(name, async () => { await run(); checks.push(name) }) }
let original, second

test('durable member increments and cart revision fences in verified Test', async t => {
  try {
    await admin.call('/api/auth/csrf'); await ok(admin, '/api/auth/admin/login', 'POST', JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE, 'utf8')))
    for (const [client, suffix] of [[a, 'a'], [b, 'b'], [c, 'c']]) {
      const username = label + suffix, phone = '139' + String(randomInt(100000000)).padStart(8, '0')
      client.id = Number(sql(`INSERT INTO gulimall_ums_test.ums_member(username,password,mobile,status) SELECT '${username}',password,'${phone}',1 FROM gulimall_ums_test.ums_member WHERE id=900001; SELECT LAST_INSERT_ID();`)); assert(client.id > 900002); members.push({ client, username })
      await client.call('/api/auth/csrf'); await ok(client, '/api/auth/login', 'POST', { username, password: 'Demo12345!' })
    }
    const sku = color => ({ skuName: label + color, skuTitle: label + color, price: '2.50', images: [{ imgUrl: '/demo-product.svg', defaultImg: 1 }], attr: [{ attrId: 900002, attrName: '颜色', attrValue: color }] })
    product = (await ok(admin, '/api/admin/product/spuinfo/editor', 'POST', { spuName: label, spuDescription: 'Durable increment fixture', catalogId: 900003, brandId: 900001, weight: '0.1', images: ['/demo-product.svg'], decript: [], baseAttrs: [], skus: [sku('Red'), sku('Blue')] })).id
    ;[sku1, sku2] = (await ok(admin, '/api/admin/product/spuinfo/editor/' + product)).product.skus.map(v => v.skuId)
    sql(`INSERT INTO gulimall_wms_test.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(${sku1},900001,20,0),(${sku2},900001,20,0);`)
    await ok(admin, `/api/admin/product/search-sync/${product}/publish?status=1`, 'POST')
    await scene(t, 'receipt reads enforce Session, member ownership, CSRF and lowercase UUID validation', async () => {
      original = request()
      assert.equal((await guest.call('/api/cart/items/requests/' + original.requestId)).status, 401)
      assert.equal((await admin.call('/api/cart/items/requests/' + original.requestId)).status, 403)
      assert.equal((await guest.call('http://127.0.0.1:18000/cart/items/requests/' + original.requestId, 'GET', undefined, { 'X-Member-Id': String(a.id) })).status, 401)
      const missing = new Client(); missing.cookie = a.cookie; assert.equal((await missing.call('/api/cart/items', 'POST', original)).status, 403)
      assert.equal((await a.call('/api/cart/items/requests/' + original.requestId, 'GET', undefined, { 'X-Cart-Owner': String(b.id) })).status, 409)
      for (const invalid of ['', 'invalid', 'A' + original.requestId.slice(1)]) assert.equal((await a.call('/api/cart/items', 'POST', { ...original, requestId: invalid })).status, 400)
      for (const count of [0, 1000, 1.5]) assert.equal((await a.call('/api/cart/items', 'POST', { ...original, count })).status, 400)
      assert.equal((await a.call('/api/cart/items/requests/INVALID')).status, 400)
      assert.deepEqual(await receipt(original), { code: 0, msg: 'success', executed: false })
    })
    await scene(t, 'same-request concurrency adds once and replays preserve quantity and revision', async () => {
      await Promise.all(Array.from({ length: 20 }, () => add({ ...original, price: 0, memberId: b.id })))
      const first = raw(); assert.equal(JSON.parse(first).count, 2); assert.equal(redis(['HLEN', addsKey(a)]), '1'); assert.equal(redis(['TTL', addsKey(a)]), '-1')
      const found = await receipt(original); assert.deepEqual(Object.keys(found).sort(), ['code', 'count', 'executed', 'msg', 'skuId']); assert(found.executed); assert.equal(found.count, 2)
      await add(original); assert.equal(raw(), first)
      assert.equal((await a.call('/api/cart/items', 'POST', { ...original, count: 3 })).status, 409)
      assert.equal((await a.call('/api/cart/items', 'POST', { ...original, skuId: sku2 })).status, 409)
      second = request(); await add(second); const changed = raw(); assert.notEqual(JSON.parse(changed).revision, JSON.parse(first).revision); assert.equal(JSON.parse(changed).count, 4)
      await add(original); assert.equal(raw(), changed); assert.equal((await view()).items[0].price, 2.5)
      assert.equal((await receipt(original, b)).executed, false); await add(original, b); assert.equal((await view(b)).items[0].count, 2)
    })
    await scene(t, 'remove and clear preserve receipts and late retries never resurrect a line', async () => {
      await ok(a, '/api/cart/items/' + sku1, 'DELETE'); await add(original); assert.equal((await view()).items.length, 0)
      const fresh = request(sku1, 1); await add(fresh); await clear(); await add(fresh); await add(second); assert.equal((await view()).items.length, 0)
      assert((await receipt(original)).executed); assert.equal(redis(['TTL', addsKey(a)]), '-1')
    })
    await scene(t, 'committed receipts precede current product checks while first-time requests remain validated', async () => {
      await ok(admin, `/api/admin/product/search-sync/${product}/publish?status=0`, 'POST'); await add(original)
      const unavailable = request(); assert.equal((await a.call('/api/cart/items', 'POST', unavailable)).status, 409); assert.equal((await receipt(unavailable)).executed, false)
      await ok(admin, `/api/admin/product/search-sync/${product}/publish?status=1`, 'POST')
      service('Stop', 'product')
      try { await add(original); assert.equal((await a.call('/api/cart/items', 'POST', request())).status, 503); assert.equal((await receipt(original)).executed, true) }
      finally { service('Start', 'product') }
      await until(async () => (await a.call('/api/product/items/' + sku1)).status === 200, 'Product service did not recover')
    })
    await scene(t, 'ten-thousand receipt capacity rejects new work but permits existing reads and replays', async () => {
      const before = redis(['HLEN', addsKey(a)]), items = raw()
      const fill = "for i=1,10000 do if redis.call('HLEN',KEYS[1])>=10000 then break end;redis.call('HSET',KEYS[1],string.format('00000000-0000-4000-8000-%012d',i),cjson.encode({hash=string.rep('a',64),skuId=ARGV[1],count=1})) end;return redis.call('HLEN',KEYS[1])"
      try {
        assert.equal(redis(['EVAL', fill, '1', addsKey(a), String(sku1)]), '10000')
        const pending = request(); assert.equal((await a.call('/api/cart/items', 'POST', pending)).status, 409); assert.equal((await receipt(pending)).executed, false)
        await add(original); assert.equal(raw(), items); assert((await receipt(original)).executed)
      } finally { redis(['EVAL', "for i=1,10000 do redis.call('HDEL',KEYS[1],string.format('00000000-0000-4000-8000-%012d',i)) end;return 1", '1', addsKey(a)]) }
      assert.equal(redis(['HLEN', addsKey(a)]), before)
    })
    await scene(t, 'overflow, SKU capacity and corrupt storage fail before any quantity or receipt write', async () => {
      await add({ skuId: sku1, count: 999 }); const overflow = request(sku1, 1), before = raw()
      assert.equal((await a.call('/api/cart/items', 'POST', overflow)).status, 409); assert.equal(raw(), before); assert.equal((await receipt(overflow)).executed, false)
      await ok(a, '/api/cart/items/count', 'PUT', { skuId: sku1, count: 1 }); await add(overflow); assert.equal(JSON.parse(raw()).count, 2)
      await clear(); await ok(a, '/api/cart/merge', 'POST', { mergeId: randomUUID(), items: Array.from({ length: 100 }, (_, i) => ({ skuId: 8000000000 + i, count: 1, checked: false })) })
      const capacity = request(); assert.equal((await a.call('/api/cart/items', 'POST', capacity)).status, 409); assert.equal((await receipt(capacity)).executed, false)
      await clear(); await add(capacity)
      const corrupt = request()
      try { redis(['SET', addsKey(c), 'wrong-type']); assert.equal((await c.call('/api/cart/items', 'POST', corrupt)).status, 503); assert.equal(raw(c), '') }
      finally { redis(['DEL', addsKey(c)]) }
      redis(['HSET', addsKey(c), corrupt.requestId, '{broken'])
      try { assert.equal((await c.call('/api/cart/items/requests/' + corrupt.requestId)).status, 503); assert.equal((await c.call('/api/cart/items', 'POST', corrupt)).status, 503); assert.equal(raw(c), '') }
      finally { redis(['HDEL', addsKey(c), corrupt.requestId]) }
      await add(corrupt, c); assert.equal(JSON.parse(raw(c)).count, 2)
    })
    await scene(t, 'new increment versions survive old order cleanup and replay after ordered cleanup stays absent', async () => {
      await clear(); const first = request(sku1, 1), next = request(sku1, 1); await add(first); const old = JSON.parse(raw()); await add(next); const current = raw()
      const ordered = snapshot => ok(guest, `http://127.0.0.1:18000/internal/cart/${a.id}/ordered`, 'POST', { orderSn: randomUUID().replaceAll('-', ''), items: [{ skuId: sku1, revision: snapshot.revision }] }, { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN })
      await ordered(old); assert.equal(raw(), current); await add(first); assert.equal(raw(), current)
      await ordered(JSON.parse(current)); assert.equal(raw(), ''); await add(next); assert.equal(raw(), ''); assert((await receipt(first)).executed)
    })
    await scene(t, 'cart and Redis restarts preserve original receipts, sessions and versions', async () => {
      const stored = request(sku2, 1); await add(stored, c); const key = `gulimall:cart:{${c.id}}:items`, before = redis(['HGET', key, String(sku2)])
      service('Stop', 'cart'); service('Start', 'cart'); await until(async () => (await c.call('/api/cart/items/requests/' + stored.requestId)).status === 200, 'Cart service did not recover')
      command('docker', ['compose', 'restart', 'redis']); await until(async () => (await receipt(stored, c)).executed, 'Redis session or receipt lost after restart')
      await add(stored, c); assert.equal(redis(['HGET', key, String(sku2)]), before); assert.equal(redis(['TTL', addsKey(c)]), '-1')
      await add(original); assert.equal(raw(), ''); assert((await receipt(original)).executed); assert.equal((await receipt(stored, a)).executed, false)
    })
    assert.equal(checks.length, 8); writeFileSync('.tools/test/cartaddition-result.json', JSON.stringify({ environment: 'Test', passed: true, checks }, null, 2) + '\n')
  } finally {
    for (const module of stopped) service('Start', module)
    if (product) {
      await until(async () => (await admin.call(`/api/admin/product/search-sync/${product}/publish?status=0`, 'POST')).status === 200, 'Could not unpublish owned fixture')
      if (sku1 && sku2) sql(`DELETE FROM gulimall_wms_test.wms_ware_sku WHERE sku_id IN(${sku1},${sku2});DELETE FROM gulimall_pms_test.pms_sku_images WHERE sku_id IN(${sku1},${sku2});DELETE FROM gulimall_pms_test.pms_sku_sale_attr_value WHERE sku_id IN(${sku1},${sku2});DELETE FROM gulimall_pms_test.pms_sku_info WHERE spu_id=${product};`)
      sql(`DELETE FROM gulimall_pms_test.pms_search_sync WHERE spu_id=${product};DELETE FROM gulimall_pms_test.pms_product_attr_value WHERE spu_id=${product};DELETE FROM gulimall_pms_test.pms_spu_images WHERE spu_id=${product};DELETE FROM gulimall_pms_test.pms_spu_info_desc WHERE spu_id=${product};DELETE FROM gulimall_pms_test.pms_spu_info WHERE id=${product} AND spu_name='${label}';`)
    }
    for (const { client, username } of members) { await client.call('/api/auth/logout', 'POST'); redis(['DEL', ...['items', 'adds', 'merges', 'orders'].map(type => `gulimall:cart:{${client.id}}:${type}`)]); sql(`DELETE FROM gulimall_ums_test.ums_member WHERE id=${client.id} AND username='${username}';`) }
    await admin.call('/api/auth/logout', 'POST')
  }
})
