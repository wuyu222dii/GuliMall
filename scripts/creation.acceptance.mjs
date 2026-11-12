import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.env.GULIMALL_ACCEPTANCE, '1'); await assertTestEnvironment()
const label = 'creation_' + randomUUID().replaceAll('-', ''), members = [], stopped = new Set(), checks = []
function sql(input, root = false) {
  const command = root ? 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4 --batch --skip-column-names' : 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', command], { input, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, 'Verified Test fixture query failed'); return result.stdout.trim()
}
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body, headers = {}) {
    const response = await fetch(path.startsWith('http:') ? path : 'http://127.0.0.1:88' + path, { method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) })
    const cookie = response.headers.getSetCookie().find(v => v.startsWith('GULIMALLSESSION=')); if (cookie) this.cookie = cookie.split(';')[0]
    const data = await response.json(); if (data.csrfToken) this.csrf = data.csrfToken; return { status: response.status, data }
  }
}
const admin = new Client(), a = new Client(), b = new Client(), guest = new Client()
async function ok(client, path, method = 'GET', body) { const result = await client.call(path, method, body); assert.equal(result.status, 200, result.data.msg); assert.equal(result.data.code, 0, result.data.msg); return result.data }
const addressPath = '/api/member/addresses', warehousePath = '/api/admin/ware/wareinfo'
const address = { name: label, phone: '13800000001', province: '浙江省', city: '杭州市', region: '西湖区', detailAddress: '隔离创建回执验收', defaultStatus: 1, creationRequestId: randomUUID() }
const warehouse = { name: label, address: '隔离创建回执验收', areacode: 'test', creationRequestId: randomUUID() }
let addressId, otherAddressId, warehouseId, deletedRequest, orderId
const triggerNames = [label + '_a', label + '_w']
async function scene(t, name, run) { await t.test(name, async () => { await run(); checks.push(name) }) }
function service(action, module) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/services.ps1', action, '-Modules', module], { stdio: 'ignore', windowsHide: true, timeout: 30000 })
  assert.equal(result.status, 0, 'Owned Test service lifecycle failed')
  if (action === 'Stop') stopped.add(module); else stopped.delete(module)
}
async function until(check, message) { for (let i = 0; i < 90; i++) { try { if (await check()) return } catch {} await new Promise(resolve => setTimeout(resolve, 1000)) } assert.fail(message) }

test('durable address and warehouse creation in verified Test databases', async t => {
  try {
    await admin.call('/api/auth/csrf'); await ok(admin, '/api/auth/admin/login', 'POST', JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE, 'utf8')))
    for (const [client, suffix] of [[a, 'a'], [b, 'b']]) {
      const username = label + suffix, phone = '139' + String(randomInt(100000000)).padStart(8, '0')
      client.id = Number(sql(`INSERT INTO gulimall_ums_test.ums_member(username,password,mobile,status) SELECT '${username}',password,'${phone}',1 FROM gulimall_ums_test.ums_member WHERE id=900001; SELECT LAST_INSERT_ID();`)); assert(client.id > 900002); members.push(client.id)
      await client.call('/api/auth/csrf'); await ok(client, '/api/auth/login', 'POST', { username, password: 'Demo12345!' })
    }
    await scene(t, 'service authentication, CSRF, owner hints and request formats remain enforced', async () => {
      const lookup = addressPath + '/creation/' + address.creationRequestId
      assert.equal((await guest.call(lookup)).status, 401); assert.equal((await admin.call(lookup)).status, 403)
      assert.equal((await a.call(warehousePath + '/creation/' + warehouse.creationRequestId)).status, 403)
      assert.equal((await guest.call('http://127.0.0.1:8000/member/addresses/creation/' + address.creationRequestId, 'GET', undefined, { 'X-Member-Id': String(a.id) })).status, 401)
      const missing = new Client(); missing.cookie = a.cookie
      assert.equal((await missing.call(addressPath, 'POST', address)).status, 403)
      assert.equal((await a.call(addressPath, 'POST', address, { 'X-Address-Owner': String(b.id) })).status, 409)
      for (const invalid of ['', 'INVALID', address.creationRequestId.toUpperCase()]) {
        assert.equal((await a.call(addressPath, 'POST', { ...address, creationRequestId: invalid })).status, 400)
        assert.equal((await admin.call(warehousePath + '/save', 'POST', { ...warehouse, creationRequestId: invalid })).status, 400)
      }
      assert.equal((await a.call(addressPath + '/creation/INVALID')).status, 400)
      assert.equal((await admin.call(warehousePath + '/creation/INVALID')).status, 400)
      assert.deepEqual(Object.keys(await ok(a, lookup)).sort(), ['code', 'found', 'msg']); assert.equal((await ok(a, lookup)).found, false)
    })
    await scene(t, 'concurrent address retries create one body and one receipt; different identifiers remain independent', async () => {
      const responses = await Promise.all(Array.from({ length: 12 }, () => ok(a, addressPath, 'POST', address)))
      assert.equal(new Set(responses.map(v => v.id)).size, 1); addressId = responses[0].id
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.id};`), '1')
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_address_creation_receipt WHERE member_id=${a.id};`), '1')
      const receipt = await ok(a, addressPath + '/creation/' + address.creationRequestId)
      assert.deepEqual(Object.keys(receipt).sort(), ['code', 'deleted', 'found', 'id', 'msg']); assert.equal(receipt.id, addressId); assert.equal(receipt.deleted, false)
      assert.equal((await a.call(addressPath, 'POST', { ...address, detailAddress: '不同内容' })).status, 409)
      otherAddressId = (await ok(a, addressPath, 'POST', { ...address, defaultStatus: 0, creationRequestId: randomUUID() })).id
      assert.notEqual(otherAddressId, addressId)
    })
    await scene(t, 'replaying original content preserves later address edits, unique defaults and order snapshots', async () => {
      await ok(a, '/api/cart', 'DELETE'); await ok(a, '/api/cart/items', 'POST', { skuId: 900001, count: 1 })
      const confirmation = (await ok(a, '/api/order/mine/confirm', 'POST', {})).confirmation
      const result = (await ok(a, '/api/order/mine/submit', 'POST', { token: confirmation.token, addressId })).result
      orderId = result.order.id; assert.equal(result.order.status, 0)
      const before = sql(`SELECT CONCAT_WS('|',receiver_name,receiver_phone,receiver_province,receiver_city,receiver_region,receiver_detail_address) FROM gulimall_oms_test.oms_order WHERE id=${orderId};`)
      await ok(a, addressPath + '/' + addressId, 'PUT', { ...address, name: '修改后的收件人', defaultStatus: 0 })
      await ok(a, addressPath + '/' + otherAddressId + '/default', 'PUT')
      assert.equal((await ok(a, addressPath, 'POST', address)).id, addressId)
      const current = (await ok(a, addressPath + '/' + addressId)).memberReceiveAddress
      assert.equal(current.name, '修改后的收件人'); assert.equal(current.defaultStatus, 0); assert(!('creationRequestId' in current))
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.id} AND default_status=1;`), '1')
      assert.equal(sql(`SELECT CONCAT_WS('|',receiver_name,receiver_phone,receiver_province,receiver_city,receiver_region,receiver_detail_address) FROM gulimall_oms_test.oms_order WHERE id=${orderId};`), before)
      await ok(a, '/api/order/mine/' + orderId + '/cancel', 'POST', {})
    })
    await scene(t, 'physical address deletion retains a member-scoped receipt and cannot resurrect the body', async () => {
      deletedRequest = address.creationRequestId
      await ok(a, addressPath, 'DELETE', [addressId])
      assert.equal((await ok(a, addressPath + '/creation/' + deletedRequest)).deleted, true)
      assert.equal((await a.call(addressPath, 'POST', address)).status, 409)
      assert.equal((await b.call(addressPath + '/' + otherAddressId)).status, 403)
      assert.equal((await ok(b, addressPath + '/creation/' + deletedRequest)).found, false)
      assert.notEqual((await ok(b, addressPath, 'POST', address)).id, addressId)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member_receive_address WHERE id=${addressId};`), '0')
    })
    await scene(t, 'warehouse unique-key competition returns one committed winner and normalized content conflicts correctly', async () => {
      const responses = await Promise.all(Array.from({ length: 12 }, () => ok(admin, warehousePath + '/save', 'POST', warehouse)))
      assert.equal(new Set(responses.map(v => v.id)).size, 1); warehouseId = responses[0].id
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_wms_test.wms_ware_info WHERE name='${label}';`), '1')
      assert.equal((await ok(admin, warehousePath + '/save', 'POST', { ...warehouse, name: ' ' + label + ' ', areacode: ' test ' })).id, warehouseId)
      assert.equal((await admin.call(warehousePath + '/save', 'POST', { ...warehouse, address: '不同内容' })).status, 409)
      assert.deepEqual(Object.keys(await ok(admin, warehousePath + '/creation/' + warehouse.creationRequestId)).sort(), ['code', 'deleted', 'found', 'id', 'msg'])
    })
    await scene(t, 'warehouse edits keep references and original receipt; legacy callers retain create semantics', async () => {
      sql(`INSERT INTO gulimall_wms_test.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(900001,${warehouseId},1,0);`)
      await ok(admin, warehousePath + '/update', 'POST', { ...warehouse, id: warehouseId, name: label + '_edited', creationRequestId: randomUUID(), creationRequestHash: 'fake' })
      assert.equal((await ok(admin, warehousePath + '/save', 'POST', warehouse)).id, warehouseId)
      const current = (await ok(admin, warehousePath + '/info/' + warehouseId)).wareInfo
      assert.equal(current.name, label + '_edited'); assert(!('creationRequestId' in current)); assert(!('creationRequestHash' in current))
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_wms_test.wms_ware_sku WHERE ware_id=${warehouseId} AND stock=1;`), '1')
      const legacy = { ...warehouse }; delete legacy.creationRequestId
      assert.notEqual((await ok(admin, warehousePath + '/save', 'POST', legacy)).id, (await ok(admin, warehousePath + '/save', 'POST', legacy)).id)
      const oldAddress = { ...address, defaultStatus: 0 }; delete oldAddress.creationRequestId
      assert.notEqual((await ok(a, addressPath, 'POST', oldAddress)).id, (await ok(a, addressPath, 'POST', oldAddress)).id)
    })
    await scene(t, 'receipt write failures roll back bodies and default changes before same-request retry', async () => {
      const failedAddress = { ...address, creationRequestId: randomUUID() }, failedWarehouse = { ...warehouse, name: label + '_rollback', creationRequestId: randomUUID() }
      const before = sql(`SELECT id,default_status FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.id} ORDER BY id;`)
      try {
        sql(`DELIMITER $$\nCREATE TRIGGER gulimall_ums_test.${triggerNames[0]} BEFORE INSERT ON gulimall_ums_test.ums_address_creation_receipt FOR EACH ROW BEGIN IF NEW.creation_request_id='${failedAddress.creationRequestId}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='isolated receipt fault'; END IF; END$$\nDELIMITER ;`, true)
        assert((await a.call(addressPath, 'POST', failedAddress)).status >= 500)
        assert.equal(sql(`SELECT id,default_status FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.id} ORDER BY id;`), before)
        assert.equal((await ok(a, addressPath + '/creation/' + failedAddress.creationRequestId)).found, false)
      } finally { sql(`DROP TRIGGER IF EXISTS gulimall_ums_test.${triggerNames[0]};`, true) }
      assert((await ok(a, addressPath, 'POST', failedAddress)).id > 0)
      try {
        sql(`DELIMITER $$\nCREATE TRIGGER gulimall_wms_test.${triggerNames[1]} BEFORE UPDATE ON gulimall_wms_test.wms_ware_info FOR EACH ROW BEGIN IF NEW.creation_request_id='${failedWarehouse.creationRequestId}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='isolated receipt fault'; END IF; END$$\nDELIMITER ;`, true)
        assert((await admin.call(warehousePath + '/save', 'POST', failedWarehouse)).status >= 500)
        assert.equal(sql(`SELECT COUNT(*) FROM gulimall_wms_test.wms_ware_info WHERE name='${failedWarehouse.name}';`), '0')
        assert.equal((await ok(admin, warehousePath + '/creation/' + failedWarehouse.creationRequestId)).found, false)
      } finally { sql(`DROP TRIGGER IF EXISTS gulimall_wms_test.${triggerNames[1]};`, true) }
      assert((await ok(admin, warehousePath + '/save', 'POST', failedWarehouse)).id > 0)
    })
    await scene(t, 'member and warehouse service restarts preserve active and deleted original results', async () => {
      for (const module of ['member', 'ware']) { service('Stop', module); service('Start', module) }
      await until(async () => (await a.call(addressPath + '/creation/' + deletedRequest)).status === 200 && (await admin.call(warehousePath + '/creation/' + warehouse.creationRequestId)).status === 200, 'Creation services did not recover')
      assert.equal((await ok(a, addressPath + '/creation/' + deletedRequest)).deleted, true)
      assert.equal((await a.call(addressPath, 'POST', address)).status, 409)
      assert.equal((await ok(admin, warehousePath + '/save', 'POST', warehouse)).id, warehouseId)
    })
    assert.equal(checks.length, 8)
    writeFileSync('.tools/test/creation-result.json', JSON.stringify({ environment: 'Test', passed: true, checks }, null, 2) + '\n')
  } finally {
    for (const module of stopped) service('Start', module)
    sql(`DROP TRIGGER IF EXISTS gulimall_ums_test.${triggerNames[0]}; DROP TRIGGER IF EXISTS gulimall_wms_test.${triggerNames[1]};`, true)
    if (orderId) await a.call('/api/order/mine/' + orderId + '/cancel', 'POST', {})
    if (members.length) sql(`DELETE FROM gulimall_ums_test.ums_address_creation_receipt WHERE member_id IN(${members.join(',')}); DELETE FROM gulimall_ums_test.ums_member_receive_address WHERE member_id IN(${members.join(',')});`)
    if (warehouseId) sql(`DELETE FROM gulimall_wms_test.wms_ware_sku WHERE ware_id=${warehouseId};`)
    sql(`DELETE FROM gulimall_wms_test.wms_ware_info WHERE name LIKE '${label}%';`)
    for (const client of [a, b, admin]) await client.call('/api/auth/logout', 'POST')
  }
})
