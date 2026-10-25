import test from 'node:test'
import assert from 'node:assert/strict'
import { orderAttributes, orderTime } from '../gulimall-web/src/utils/order.js'
test('order snapshots show readable specifications and local times without raw internal metadata', () => {
  assert.equal(orderAttributes('[{"id":1,"skuId":2,"attrName":"颜色","attrValue":"红色"},{"attrName":"容量","attrValue":"8GB"}]'), '颜色: 红色 · 容量: 8GB')
  assert.equal(orderAttributes('颜色: 红色'), '颜色: 红色'); assert.equal(orderAttributes(null), '')
  for (const raw of ['[broken', '{}', '[null,3]', '[]']) assert.equal(orderAttributes(raw), 'Specifications unavailable')
  assert.equal(orderTime(null), '—'); assert.equal(orderTime('invalid'), 'Time unavailable')
  const instant = '2026-10-25T07:30:32.000+0000'
  assert.equal(orderTime(instant), new Date(instant).toLocaleString())
})
