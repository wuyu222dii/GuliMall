import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { assertTestEnvironment } from './test-environment.mjs'
import { assertRestoreEnvironment } from './demo-restore-guard.mjs'

async function environment() {
  if (process.env.GULIMALL_DEMO_RESTORE_CONTEXT) assertRestoreEnvironment(process.env.GULIMALL_DEMO_RESTORE_CONTEXT)
  else await assertTestEnvironment()
}
export async function prepareRecoveryReceipts(admin, member, skuId) {
  await environment()
  assert(Number.isSafeInteger(skuId) && skuId > 0)
  assert.equal((await member.call('/api/cart')).cart.items.length, 0, 'Receipt fixtures require an empty, newly registered member cart')
  const addresses = []
  for (const state of ['created', 'edited', 'deleted']) {
    const request = { creationRequestId: randomUUID(), name: '恢复回执' + state, phone: '13800000001', province: '浙江省', city: '杭州市', region: '西湖区', detailAddress: '隔离回执核对', defaultStatus: 0 }
    const id = (await member.call('/api/member/addresses', 'POST', request)).id
    const entry = { state, id, request }
    if (state === 'edited') await member.call('/api/member/addresses/' + id, 'PUT', { ...request, name: '恢复后保留编辑', detailAddress: '隔离编辑后的地址' })
    if (state === 'deleted') await member.call('/api/member/addresses', 'DELETE', [id])
    if (state !== 'deleted') entry.saved = (await member.call('/api/member/addresses/' + id)).memberReceiveAddress
    addresses.push(entry)
  }
  const request = { creationRequestId: randomUUID(), name: '回执仓库' + randomUUID().slice(0, 8), address: '隔离恢复核对', areacode: 'restore' }
  const id = (await admin.call('/api/admin/ware/wareinfo/save', 'POST', request)).id
  await admin.call('/api/admin/ware/wareinfo/update', 'POST', { id, name: request.name + '已编辑', address: '编辑后的隔离地址', areacode: 'restore' })
  const warehouse = { id, request, saved: (await admin.call('/api/admin/ware/wareinfo/info/' + id)).wareInfo }
  const cart = []
  for (const state of ['deleted', 'cleared']) {
    const request = { requestId: randomUUID(), skuId, count: 1 }
    await member.call('/api/cart/items', 'POST', request)
    if (state === 'deleted') await member.call('/api/cart/items/' + skuId, 'DELETE')
    else await member.call('/api/cart', 'DELETE')
    cart.push({ state, request })
  }
  const fixture = { addresses, warehouse, cart }
  await verifyRecoveryReceipts(admin, member, fixture)
  return fixture
}
export async function verifyRecoveryReceipts(admin, member, fixture) {
  await environment()
  assert.equal(fixture.addresses.length, 3); assert.equal(fixture.cart.length, 2)
  const before = await member.call('/api/member/addresses?limit=100'), cartBefore = await member.call('/api/cart')
  assert.equal(cartBefore.cart.items.length, 0)
  for (const entry of fixture.addresses) {
    const result = await member.call('/api/member/addresses/creation/' + entry.request.creationRequestId)
    assert.equal(result.found, true); assert.equal(result.id, entry.id); assert.equal(result.deleted, entry.state === 'deleted')
    const replay = await member.call('/api/member/addresses', 'POST', entry.request, entry.state === 'deleted' ? 409 : 200)
    if (entry.state === 'deleted') await member.call('/api/member/addresses/' + entry.id, 'GET', undefined, 404)
    else { assert.equal(replay.id, entry.id); assert.deepEqual((await member.call('/api/member/addresses/' + entry.id)).memberReceiveAddress, entry.saved) }
  }
  const { warehouse } = fixture
  assert.equal((await admin.call('/api/admin/ware/wareinfo/creation/' + warehouse.request.creationRequestId)).id, warehouse.id)
  assert.equal((await admin.call('/api/admin/ware/wareinfo/save', 'POST', warehouse.request)).id, warehouse.id)
  assert.deepEqual((await admin.call('/api/admin/ware/wareinfo/info/' + warehouse.id)).wareInfo, warehouse.saved)
  for (const { request } of fixture.cart) {
    const found = await member.call('/api/cart/items/requests/' + request.requestId)
    assert.equal(found.executed, true); assert.equal(found.skuId, request.skuId); assert.equal(found.count, request.count)
    await member.call('/api/cart/items', 'POST', request)
  }
  assert.deepEqual(await member.call('/api/cart'), cartBefore)
  assert.deepEqual(await member.call('/api/member/addresses?limit=100'), before)
  return { addressRequests: 3, editedAddressRetained: true, deletedAddressNotRevived: true, warehouseRequest: true, cartRequests: 2, cartNotRevived: true }
}
