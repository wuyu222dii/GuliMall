import test from 'node:test'
import assert from 'node:assert/strict'
import { IMAGE_FALLBACK, leafCategories, productImage, unavailableReason } from '../gulimall-web/src/utils/product.js'

test('purchase controls require a published product, a real price and known stock', () => {
  const item = { onSale: true, hasStock: true, info: { price: '19.99' } }
  assert.equal(unavailableReason(item), '')
  assert.match(unavailableReason({ ...item, hasStock: null }), /Stock is unavailable/)
  assert.match(unavailableReason({ ...item, hasStock: false }), /out of stock/)
  assert.match(unavailableReason({ ...item, onSale: false }), /off shelf/)
  assert.match(unavailableReason({ ...item, info: { price: null } }), /Price is unavailable/)
  assert.match(unavailableReason({ ...item, info: { price: -1 } }), /Price is unavailable/)
})
test('catalog labels use category names and image fallback stays local', () => {
  assert.deepEqual(leafCategories([{ catId: 1, name: '数码', catLevel: 1, children: [
    { catId: 2, name: '手机', catLevel: 2, children: [{ catId: 3, name: '智能手机', catLevel: 3 }] },
  ] }]), [{ id: 3, label: '数码 / 手机 / 智能手机' }])
  assert.equal(productImage('/uploads/product.jpg'), '/uploads/product.jpg')
  assert.equal(productImage('https://example.com/p.jpg'), 'https://example.com/p.jpg')
  for (const image of [null, '', '//example.com/p.jpg', 'javascript:alert(1)', 'relative-path']) assert.equal(productImage(image), IMAGE_FALLBACK)
})
