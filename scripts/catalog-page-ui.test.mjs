import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogPage } from '../gulimall-web/src/utils/catalog.js'

test('catalog pages preserve server totals and reject incomplete or oversized responses instead of showing false emptiness', () => {
  const page = { list: [{ brandId: 1, name: '品牌' }], currPage: 2, pageSize: 20, totalCount: 21, totalPage: 2 }
  assert.equal(catalogPage(page, 'brands'), page)
  for (const value of [null, {}, { ...page, totalCount: -1 }, { ...page, totalPage: 1 }, { ...page, pageSize: 101 }, { ...page, list: Array(21).fill(page.list[0]) }, { ...page, list: [{ attrId: 1 }] }]) assert.throws(() => catalogPage(value, 'brands'))
  assert.equal(catalogPage({ list: [], currPage: 1, pageSize: 20, totalCount: 0, totalPage: 0 }, 'attrs').totalCount, 0)
})
