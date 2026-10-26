import test from 'node:test'
import assert from 'node:assert/strict'
import { orderAttributes, orderTime } from '../gulimall-web/src/utils/order.js'
import { canStartNewConfirmation } from '../gulimall-web/src/utils/payment.js'
test('a settled submission lets the member explicitly start another checkout', () => {
  for (const status of [0, 1, 2, 3, 4, 5]) assert.equal(canStartNewConfirmation(status), true)
  for (const status of [6, 7, 8, 9, undefined, null, '3', -1, 99]) assert.equal(canStartNewConfirmation(status), false)
})
test('order snapshots show readable specifications and local times without raw internal metadata', () => {
  assert.equal(orderAttributes('[{"id":1,"skuId":2,"attrName":"颜色","attrValue":"红色"},{"attrName":"容量","attrValue":"8GB"}]'), '颜色: 红色 · 容量: 8GB')
  assert.equal(orderAttributes('颜色: 红色'), '颜色: 红色'); assert.equal(orderAttributes(null), '')
  for (const raw of ['[broken', '{}', '[null,3]', '[]']) assert.equal(orderAttributes(raw), '规格暂不可用')
  assert.equal(orderTime(null), '—'); assert.equal(orderTime('invalid'), '时间暂不可用')
  const instant = '2026-10-25T07:30:32.000+0000'
  assert.equal(orderTime(instant), new Date(instant).toLocaleString('zh-CN'))
})
