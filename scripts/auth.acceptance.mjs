import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'

// Explicit opt-in: this writes disposable fixtures only to the local *_test databases.
if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1 and load the local .env before running.')
await assertTestEnvironment()
const base = 'http://127.0.0.1:88'
const runId = randomUUID().replaceAll('-', '')
const label = `accept_${runId}`
const password = `Test_${runId.slice(0, 12)}!`
const accounts = []
const phones = []

function sql(statement) {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input: statement, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr || 'SQL fixture operation failed')
  return result.stdout.trim()
}
function phone() {
  let value
  do { value = `139${String(randomBytes(4).readUInt32BE() % 100000000).padStart(8, '0')}` }
  while (phones.includes(value) || sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member WHERE mobile='${value}';`) !== '0')
  phones.push(value)
  return value
}
class Client {
  cookie = ''
  csrf = ''
  async call(path, { method = 'GET', body, csrf = true, headers = {} } = {}) {
    const response = await fetch(path.startsWith('http:') ? path : base + path, {
      method,
      headers: { Cookie: this.cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(csrf && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) this.cookie = cookies.find((c) => c.startsWith('GULIMALLSESSION='))?.split(';')[0] || this.cookie
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { msg: text.slice(0, 100) } }
    if (data.csrfToken) this.csrf = data.csrfToken
    return { status: response.status, data, cookies }
  }
  async init() { assert.equal((await this.call('/api/auth/csrf')).status, 200) }
}
async function register(index) {
  const client = new Client()
  await client.init()
  const number = phone()
  const username = `accept_${index}_${runId.slice(0, 7)}`
  const otp = await client.call('/api/auth/sms/code', { method: 'POST', body: { phone: number } })
  assert.equal(otp.status, 200)
  assert.equal(otp.data.mode, 'development')
  assert.match(otp.data.developmentCode, /^\d{6}$/)
  const before = client.cookie
  const result = await client.call('/api/auth/register', { method: 'POST', body: { username, phone: number, password, code: otp.data.developmentCode } })
  assert.equal(result.status, 200, result.data.msg)
  assert.ok(client.cookie !== before, 'Registration must rotate the anonymous session')
  accounts.push({ id: result.data.user.id, username, phone: number })
  return { client, account: accounts.at(-1), code: otp.data.developmentCode }
}

test('stage 1 real-service authentication and authorization acceptance', async (t) => {
  let a, b
  try {
    await t.test('CSRF, bounded development codes and real BCrypt registration', async () => {
      const anonymous = new Client()
      const denied = await anonymous.call('/api/auth/login', { method: 'POST', body: { username: 'nobody', password: 'not-a-password' }, csrf: false })
      assert.equal(denied.status, 403)
      const token = await anonymous.call('/api/auth/csrf')
      assert.ok(token.cookies.some((c) => c.includes('HttpOnly') && c.includes('SameSite=Lax')))
      const number = phone()
      const otp = await anonymous.call('/api/auth/sms/code', { method: 'POST', body: { phone: number } })
      assert.equal(otp.status, 200)
      const delivery=spawnSync('docker',['compose','exec','-T','redis','redis-cli','HSET','sms:code:'+number,'delivered','0'],{encoding:'utf8',windowsHide:true});assert.equal(delivery.status,0)
      assert.equal((await anonymous.call('/api/auth/register',{method:'POST',body:{username:`undelivered_${runId.slice(0,7)}`,phone:number,password,code:otp.data.developmentCode}})).status,400,'A pending or failed delivery cannot authorize registration')
      const delivered=spawnSync('docker',['compose','exec','-T','redis','redis-cli','HSET','sms:code:'+number,'delivered','1'],{encoding:'utf8',windowsHide:true});assert.equal(delivered.status,0)
      assert.equal((await anonymous.call('/api/auth/sms/code', { method: 'POST', body: { phone: number } })).status, 429)
      const wrong = otp.data.developmentCode === '000000' ? '111111' : '000000'
      for (let attempt = 0; attempt < 5; attempt++) {
        assert.equal((await anonymous.call('/api/auth/register', { method: 'POST', body: { username: `blocked_${runId.slice(0, 7)}`, phone: number, password, code: wrong } })).status, 400)
      }
      assert.equal((await anonymous.call('/api/auth/register', { method: 'POST', body: { username: `blocked_${runId.slice(0, 7)}`, phone: number, password, code: otp.data.developmentCode } })).status, 400)
      a = await register('a')
      b = await register('b')
      const stored = sql(`SELECT password FROM gulimall_ums_test.ums_member WHERE id=${a.account.id};`)
      assert.ok(stored.startsWith('$2a$') && stored !== password, 'Only BCrypt hashes may be persisted')
      const reuse = await anonymous.call('/api/auth/register', { method: 'POST', body: { username: `replay_${runId.slice(0, 7)}`, phone: a.account.phone, password, code: a.code } })
      assert.equal(reuse.status, 400, 'A successful registration consumes its code')
    })
    assert.ok(a && b, 'Registration prerequisites failed')
    await t.test('duplicate usernames preserve unused OTPs and concurrent phone registration creates one member', async () => {
      const client = new Client(); await client.init()
      const number = phone()
      const otp = await client.call('/api/auth/sms/code', { method: 'POST', body: { phone: number } })
      assert.equal(otp.status, 200)
      const body = { username: a.account.username, phone: number, password, code: otp.data.developmentCode }
      assert.equal((await client.call('/api/auth/register', { method: 'POST', body })).status, 409)
      const username = `accept_c_${runId.slice(0, 7)}`
      const retried = await client.call('/api/auth/register', { method: 'POST', body: { ...body, username } })
      assert.equal(retried.status, 200, 'Failed registration must not consume a valid code')
      accounts.push({ id: retried.data.user.id, username, phone: number })
      const race = new Client(); await race.init()
      const racePhone = phone()
      const raceOtp = await race.call('/api/auth/sms/code', { method: 'POST', body: { phone: racePhone } })
      assert.equal(raceOtp.status, 200)
      const names = [`race_a_${runId.slice(0, 7)}`, `race_b_${runId.slice(0, 7)}`]
      const results = await Promise.all(names.map((name) => race.call('/api/auth/register', {
        method: 'POST', body: { username: name, phone: racePhone, password, code: raceOtp.data.developmentCode },
      })))
      assert.equal(results.filter((r) => r.status === 200).length, 1)
      assert.ok(results.every((r) => [200, 400, 409].includes(r.status)))
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member WHERE mobile='${racePhone}';`), '1')
      const winner = results.findIndex((r) => r.status === 200)
      accounts.push({ id: results[winner].data.user.id, username: names[winner], phone: racePhone })
    })
    await t.test('login rejects bad passwords, rotates the session and supports phone login', async () => {
      const client = new Client(); await client.init()
      assert.equal((await client.call('/api/auth/login', { method: 'POST', body: { username: a.account.username, password: 'Wrong12345!' } })).status, 401)
      assert.equal((await client.call('/api/auth/me')).status, 401)
      const before = client.cookie
      const result = await client.call('/api/auth/login', { method: 'POST', body: { username: a.account.phone, password } })
      assert.equal(result.status, 200, result.data.msg)
      assert.ok(client.cookie !== before, 'Login must rotate the session ID')
      assert.deepEqual(Object.keys(result.data.user).sort(), ['admin', 'id', 'username'])
      assert.equal(result.data.user.id, a.account.id)
      const old = new Client(); old.cookie = before
      assert.equal((await old.call('/api/auth/me')).status, 401)
      assert.equal((await client.call('/api/auth/me')).data.user.id, a.account.id)
    })
    let addressId
    const address = { name: label, phone: a.account.phone, province: 'Test', city: 'Test', region: 'Test', detailAddress: 'Acceptance fixture', defaultStatus: 0, memberId: b.account.id, id: 900002 }
    await t.test('shared sessions enforce address ownership on list, detail, create, update and delete', async () => {
      const created = await a.client.call('/api/member/addresses', { method: 'POST', body: address })
      assert.equal(created.status, 200, created.data.msg); addressId = created.data.id
      assert.ok(addressId !== 900002, 'Client-supplied primary IDs must be ignored')
      const list = await a.client.call(`/api/member/addresses?memberId=${b.account.id}`)
      assert.equal(list.status, 200)
      assert.ok(list.data.page.totalCount >= 1)
      assert.ok(list.data.page.list.every((x) => x.memberId === a.account.id))
      assert.equal((await a.client.call(`http://127.0.0.1:8000/member/addresses/${addressId}`)).status, 200)
      assert.equal((await a.client.call('/api/member/addresses/not-a-number')).status, 400)
      assert.equal((await b.client.call(`/api/member/addresses/${addressId}`)).status, 403)
      assert.equal((await b.client.call(`/api/member/addresses/${addressId}`, { method: 'PUT', body: address })).status, 403)
      assert.equal((await b.client.call('/api/member/addresses', { method: 'DELETE', body: [addressId] })).status, 403)
      assert.equal((await a.client.call(`/api/member/addresses/${addressId}`, { method: 'PUT', body: address, csrf: false })).status, 403)
      assert.equal((await a.client.call(`/api/member/addresses/${addressId}`, { method: 'PUT', body: address })).status, 200)
    })
    await t.test('order listing, details and payment use the server member identity', async () => {
      sql(`INSERT INTO gulimall_oms_test.oms_order(member_id,order_sn,status,pay_amount) VALUES (${a.account.id},'acceptA_${runId}',0,1),(${b.account.id},'acceptB_${runId}',0,1);`)
      const orderId = Number(sql(`SELECT id FROM gulimall_oms_test.oms_order WHERE order_sn='acceptA_${runId}';`))
      const list = await a.client.call(`/api/order/mine?memberId=${b.account.id}`)
      assert.equal(list.status, 200); assert.ok(list.data.page.totalCount >= 1)
      assert.ok(list.data.page.list.every((x) => x.memberId === a.account.id))
      assert.equal((await a.client.call(`/api/order/mine/${orderId}`)).status, 200)
      assert.equal((await b.client.call(`/api/order/mine/${orderId}`)).status, 403)
      assert.equal((await b.client.call(`/api/order/pay?orderSn=acceptA_${runId}`)).status, 403)
      assert.equal((await a.client.call('/api/order/pay')).status, 400)
    })
    await t.test('anonymous and member clients cannot impersonate administrators or internal callers', async () => {
      const anonymous = new Client()
      assert.equal((await anonymous.call('/api/admin/member/member/list', { headers: { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN, 'X-Role': 'admin' } })).status, 401)
      assert.equal((await a.client.call('/api/admin/member/member/list', { headers: { 'X-Role': 'admin' } })).status, 403)
      assert.equal((await a.client.call('http://127.0.0.1:8000/member/member/list')).status, 403)
      assert.equal((await anonymous.call('http://127.0.0.1:8000/member/member/list')).status, 401)
      assert.equal((await anonymous.call('http://127.0.0.1:8000/internal/member/login', { method: 'POST', body: { username: a.account.username, password } })).status, 403)
      assert.equal((await anonymous.call('/api/member/member/list')).status, 404)
      assert.equal((await anonymous.call('/api/internal/search/save/product', { method: 'POST', body: [] })).status, 404)
      assert.equal((await anonymous.call('http://127.0.0.1:12000/internal/search/save/product', { method: 'POST', body: [] })).status, 403)
    })
    await t.test('configured admin login works, hashes stay private and admin mutations require CSRF', async () => {
      const admin = new Client(); await admin.init()
      const access = process.env.ADMIN_TEST_PASSWORD
        ? { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_TEST_PASSWORD }
        : JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE || '.tools/admin-access.json', 'utf8'))
      const login = await admin.call('/api/auth/admin/login', { method: 'POST', body: access })
      assert.equal(login.status, 200, login.data.msg); assert.equal(login.data.user.admin, true)
      const members = await admin.call('/api/admin/member/member/list')
      assert.equal(members.status, 200, members.data.msg)
      assert.ok(!JSON.stringify(members.data).match(/"password"|"accessToken"/))
      const brand = { name: label, logo: 'http://localhost:5173/demo-product.svg', showStatus: 1, firstLetter: 'A', sort: 0 }
      assert.equal((await admin.call('/api/admin/product/brand/save', { method: 'POST', body: brand, csrf: false })).status, 403)
      assert.equal((await admin.call('/api/admin/product/brand/save', { method: 'POST', body: brand })).status, 200)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_brand WHERE name='${label}';`), '1')
      assert.equal((await admin.call('/api/member/addresses')).status, 403)
      assert.equal((await admin.call('/api/admin/product/brand/delete', { method: 'GET' })).status, 405)
      assert.equal((await admin.call('/api/admin/product/brand/delete', { method: 'HEAD' })).status, 405)
      assert.equal((await admin.call('http://127.0.0.1:10001/write')).status, 405)
      assert.equal((await admin.call('http://127.0.0.1:10001/write', { method: 'POST', csrf: false })).status, 403)
      assert.equal((await admin.call('http://127.0.0.1:9000/testSubmit')).status, 405)
      assert.equal((await admin.call('http://127.0.0.1:12000/internal/search/save/product', { method: 'POST', body: [] })).status, 403)
    })
    await t.test('address edits, concurrent defaults, legacy repair and stable pagination', async () => {
      const path='/api/member/addresses'
      const created=await Promise.all([1,2].map(i=>a.client.call(path,{method:'POST',body:{...address,detailAddress:`Address ${i}`,defaultStatus:1}})))
      created.forEach(r=>assert.equal(r.status,200))
      const ids=created.map(r=>r.data.id)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.account.id} AND default_status=1;`),'1')
      const defaults=await Promise.all(ids.map(id=>a.client.call(`${path}/${id}/default`,{method:'PUT',body:{}})))
      defaults.forEach(r=>assert.equal(r.status,200))
      let list=(await a.client.call(path+'?limit=1&page=1')).data
      assert.equal(list.page.list.length,1);assert.equal(list.page.list[0].defaultStatus,1);assert.equal(list.multipleDefaults,false)
      assert.equal((await a.client.call(`${path}/${ids[0]}`,{method:'PUT',body:{...address,detailAddress:'Edited',defaultStatus:1}})).status,200)
      assert.equal((await a.client.call(`${path}/${ids[0]}`)).data.memberReceiveAddress.detailAddress,'Edited')
      assert.equal((await b.client.call(`${path}/${ids[0]}/default`,{method:'PUT',body:{}})).status,403)
      assert.equal((await a.client.call(`${path}/${ids[0]}/default`,{method:'PUT',body:{},csrf:false})).status,403)
      // Deliberately seed a legacy inconsistency only after the independent test database guard.
      sql(`UPDATE gulimall_ums_test.ums_member_receive_address SET default_status=1 WHERE member_id=${a.account.id};`)
      assert.equal((await a.client.call(path)).data.multipleDefaults,true)
      assert.equal((await a.client.call(`${path}/${ids[1]}`,{method:'PUT',body:{...address,defaultStatus:0}})).status,200)
      const oldest=Number(sql(`SELECT MIN(id) FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.account.id};`))
      assert.equal((await a.client.call(path)).data.page.list[0].id,oldest)
      assert.equal((await a.client.call(path,{method:'DELETE',body:[oldest]})).status,200)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_member_receive_address WHERE member_id=${a.account.id} AND default_status=1;`),'0')
    })
    await t.test('logout invalidates a replayed old cookie across services', async () => {
      const old = new Client(); old.cookie = a.client.cookie
      assert.equal((await a.client.call('/api/auth/logout', { method: 'POST' })).status, 200)
      assert.equal((await old.call('/api/auth/me')).status, 401)
      assert.equal((await old.call('/api/member/addresses')).status, 401)
      assert.equal((await old.call('/api/order/mine')).status, 401)
    })
  } finally {
    sql(`DELETE FROM gulimall_pms_test.pms_brand WHERE name='${label}'; DELETE FROM gulimall_oms_test.oms_order WHERE order_sn IN ('acceptA_${runId}','acceptB_${runId}'); DELETE FROM gulimall_ums_test.ums_member_receive_address WHERE name='${label}';`)
    for (const account of accounts) sql(`DELETE FROM gulimall_ums_test.ums_member WHERE id=${account.id} AND username='${account.username}';`)
    for (const number of phones) {
      const result = spawnSync('docker', ['compose', 'exec', '-T', 'redis', 'redis-cli', 'DEL', `sms:code:${number}`, `sms:rate:${number}`], { encoding: 'utf8', windowsHide: true })
      assert.equal(result.status, 0, 'OTP fixture cleanup failed')
    }
  }
})
