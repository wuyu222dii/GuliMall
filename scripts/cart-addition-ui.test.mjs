import test from 'node:test'
import assert from 'node:assert/strict'
import { readAdditionRequest } from '../gulimall-web/src/utils/cart.js'
const value = { requestId: 'a2aba713-7b70-4eed-9ae4-0062e34082cc', skuId: 900001, count: 2 }
test('member addition references bind the original UUID, SKU and integer increment without product fields', () => {
  assert.deepEqual(readAdditionRequest(JSON.stringify(value)), value)
  assert.equal(readAdditionRequest(null), null)
  for (const changed of [{ ...value, requestId: value.requestId.toUpperCase() }, { ...value, requestId: value.requestId + '\n' }, { ...value, count: 1.5 }, { ...value, count: 0 }, { ...value, count: 1000 }, { ...value, skuId: Number.MAX_SAFE_INTEGER + 1 }, { ...value, price: 0 }, { ...value, memberId: 2 }, [], null]) assert.throws(() => readAdditionRequest(JSON.stringify(changed)))
})
