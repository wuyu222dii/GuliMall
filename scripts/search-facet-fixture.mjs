import assert from 'node:assert/strict'
import { randomUUID, randomInt } from 'node:crypto'
import { assertTestEnvironment } from './test-environment.mjs'
const es = 'http://127.0.0.1:19200/gulimall-products-v1'
export async function createFacetFixture() {
  await assertTestEnvironment()
  const base = 7000000000000 + randomInt(1000000000) * 10, version = Date.now(), label = randomUUID().replaceAll('-', ''), capsLabel = randomUUID().replaceAll('-', '')
  const a = '8GB,_中文', b = '16GB,闪存_版本', attr = (attrId, attrName, attrValue) => ({ attrId, attrName, attrValue })
  const make = (n, spuId, keyword, price, brandId, hasStock, attrs) => ({ skuId: base + n, spuId, skuTitle: keyword + ' 规格文档' + n, skuName: keyword + ' 规格文档' + n, skuPrice: price, skuImg: '/demo-product.svg', brandId, brandName: '测试品牌', catalogId: 900003, catalogName: '测试分类', hasStock, attrs })
  const normal = [
    make(1, base + 10, label, '0.00', 900001, true, [attr(100, '容量', a), attr(200, '颜色', '红色')]),
    make(2, base + 10, label, '10.00', 900002, false, [attr(100, '容量', b), attr(200, '颜色', '蓝色')]),
    make(3, base + 10, label, '20.00', 900001, true, [attr(100, '容量', a), attr(100, '容量', b), attr(200, '颜色', '红色')]),
  ]
  normal.push(...Array.from({ length: 12 }, (_, i) => make(20 + i, base + 10, label, '5.00', 900001, true, [attr(100, '容量', a), attr(200, '颜色', '红色')])))
  const capped = make(4, base + 11, capsLabel, '30.00', 900001, true, [
    ...Array.from({ length: 51 }, (_, i) => attr(1001, '多值规格', '值_' + String(i).padStart(2, '0') + ',中文')),
    ...Array.from({ length: 20 }, (_, i) => attr(1002 + i, '规格' + (i + 2), '常用')),
  ])
  const groups = [normal, [capped]], docs = [...normal, capped]
  async function sync(skus, onSale, offset = 0) {
    const response = await fetch('http://127.0.0.1:12000/internal/search/synchronize', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }, body: JSON.stringify({ spuId: skus[0].spuId, version: version + offset, onSale, skus }), signal: AbortSignal.timeout(20000) })
    assert.equal(response.status, 200, 'Owned Test search fixture synchronization failed'); assert.equal((await response.json()).code, 0)
  }
  for (const doc of docs) assert.equal((await fetch(es + '/_doc/' + doc.skuId)).status, 404, 'Fixture identifiers must not replace existing documents')
  async function remove() {
    for (const group of groups) {
      const present = []
      for (const doc of group) {
        const response = await fetch(es + '/_doc/' + doc.skuId)
        if (response.status === 404) continue
        assert.equal(response.status, 200); const found = (await response.json())._source
        assert.equal(found.spuId, doc.spuId, 'Refusing to delete a foreign fixture'); assert.equal(found.skuTitle, doc.skuTitle, 'Fixture ownership changed'); present.push(doc)
      }
      if (present.length) await sync(present, false, 1)
    }
  }
  try { for (const group of groups) await sync(group, true) }
  catch (error) { await remove(); throw error }
  return { label, capsLabel, a, b, normal, capped, remove }
}
