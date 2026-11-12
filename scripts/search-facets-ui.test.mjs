import test from 'node:test'
import assert from 'node:assert/strict'
import { attrParts, selectAttr, searchParams, validatedFacets } from '../gulimall-web/src/utils/search.js'
import { consumerQuery } from '../gulimall-web/src/utils/consumer.js'
test('specification editing preserves literal commas, underscores, Chinese and unrelated repeated AND conditions', () => {
  const attrs = ['1_红,蓝_版本', '1_白色', '2_128GB', '2_128GB']
  assert.deepEqual(attrParts(attrs[0]), ['1', '红,蓝_版本'])
  assert.deepEqual(selectAttr(attrs, '1', '黑,白_新版'), ['2_128GB', '2_128GB', '1_黑,白_新版'])
  assert.deepEqual(selectAttr(attrs, '1', ''), ['2_128GB', '2_128GB']); assert.equal(attrs.length, 4)
})
test('search serialization retains repeated filters, category aliases and zero upper prices', () => {
  const values = consumerQuery('search', 'catalog3Id=3&brandId=1,2&attrs=1_红%2C蓝_版本&attrs=1_白色&attrs=2_128GB&attrs=2_128GB&max=0&page=2')
  const params = searchParams({ ...values, page: '1' })
  assert.deepEqual(params.getAll('attrs'), values.attrs); assert.deepEqual(params.getAll('brandId'), ['1', '2']); assert.equal(params.get('max'), '0'); assert.equal(params.get('catalogId'), '3')
  assert.deepEqual(consumerQuery('search', params.toString()).attrs, values.attrs)
})
test('facet metadata rejects malformed or oversized results and keeps long attribute identifiers as strings', () => {
  const facet = { attrs: [{ attrId: '999999999999999999', attrName: '规格', values: ['红,蓝_版本'], truncated: false }], attrsTruncated: false }
  assert.equal(validatedFacets(facet), facet); assert.deepEqual(validatedFacets({ attrs: [], attrsTruncated: false }).attrs, [])
  for (const changed of [null, {}, { ...facet, attrsTruncated: 0 }, { ...facet, attrs: [facet.attrs[0], facet.attrs[0]] }, { ...facet, attrs: [{ ...facet.attrs[0], attrId: 1 }] }, { ...facet, attrs: [{ ...facet.attrs[0], values: ['a', 'a'] }] }, { ...facet, attrs: [{ ...facet.attrs[0], values: Array.from({ length: 51 }, (_, i) => String(i)) }] }]) assert.throws(() => validatedFacets(changed))
})
