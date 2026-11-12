import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { assertTestEnvironment } from './test-environment.mjs'
import { createFacetFixture } from './search-facet-fixture.mjs'
assert.equal(process.env.GULIMALL_ACCEPTANCE, '1'); await assertTestEnvironment()
let fixture, stopped = false
const checks = []
async function search(values = {}, attrs = [], raw = '') {
  const params = new URLSearchParams({ keyword: fixture.label, ...values }); for (const value of attrs) params.append('attrs', value)
  const response = await fetch('http://127.0.0.1:88/api/search?' + params + raw, { signal: AbortSignal.timeout(20000) }); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.code, 0); return body
}
const capacity = body => body.facets.attrs.find(attr => attr.attrId === '100')
async function scene(t, name, run) { await t.test(name, async () => { await run(); checks.push(name) }) }
function docker(action) { const result = spawnSync('docker', ['compose', action, 'elasticsearch'], { stdio: 'ignore', timeout: 30000, windowsHide: true }); assert.equal(result.status, 0, 'Owned Test Elasticsearch lifecycle failed'); stopped = action === 'stop' }
async function until(check) { for (let i = 0; i < 90; i++) { try { if (await check()) return } catch {} await new Promise(resolve => setTimeout(resolve, 1000)) } assert.fail('Elasticsearch did not recover') }
test('full-result nested specification facets and compatible public search', async t => {
  try {
    fixture = await createFacetFixture()
    await scene(t, 'facets use every matching product independently of the returned page', async () => {
      const first = await search({ page: 1, limit: 1, sort: 'price_asc' }), last = await search({ page: 15, limit: 1, sort: 'price_asc' })
      assert.equal(first.page.totalCount, 15); assert.equal(first.page.list.length, 1); assert.equal(first.page.list[0].price, 0)
      assert.equal(last.page.list[0].price, 20); assert.deepEqual(first.facets, last.facets)
      assert.deepEqual(capacity(first).values, [fixture.b, fixture.a].sort()); assert.equal(first.facets.attrsTruncated, false)
      assert.equal((await fetch('http://127.0.0.1:12000/internal/search/synchronize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403)
    })
    await scene(t, 'category aliases, multiple brands, prices and stock constrain both hits and facets', async () => {
      const all = await search({ catalog3Id: 900003, limit: 1 }, [], '&brandId=900001&brandId=900002'); assert.equal(all.page.totalCount, 15)
      const zero = await search({ catalog3Id: 900003, max: '0', hasStock: '1' }, [], '&brandId=900001&brandId=900002'); assert.equal(zero.page.totalCount, 1); assert.deepEqual(capacity(zero).values, [fixture.a])
      const absent = await search({ hasStock: '0' }); assert.equal(absent.page.totalCount, 1); assert.deepEqual(capacity(absent).values, [fixture.b])
    })
    await scene(t, 'repeated attrs keep AND semantics and literal commas, underscores and Chinese', async () => {
      assert.equal((await search({}, ['100_' + fixture.a])).page.totalCount, 14)
      const both = await search({}, ['100_' + fixture.a, '100_' + fixture.b]); assert.equal(both.page.totalCount, 1); assert.equal(both.page.list[0].skuId, fixture.normal[2].skuId)
      assert.equal((await search({}, ['100_' + fixture.a, '100_' + fixture.a])).page.totalCount, 14)
      const combined = await search({}, ['100_' + fixture.b, '200_红色']); assert.equal(combined.page.totalCount, 1)
      const invalid = await fetch('http://127.0.0.1:88/api/search?attrs=100_&page=1&page=2'); assert.equal(invalid.status, 400)
    })
    await scene(t, 'twenty attributes and fifty values are explicitly truncated while hidden selected values still filter', async () => {
      const capped = await search({ keyword: fixture.capsLabel }); assert.equal(capped.page.totalCount, 1); assert.equal(capped.facets.attrs.length, 20); assert(capped.facets.attrsTruncated)
      const values = capped.facets.attrs.find(attr => attr.attrId === '1001'); assert.equal(values.values.length, 50); assert(values.truncated); assert(!values.values.includes('值_50,中文'))
      const hidden = await search({ keyword: fixture.capsLabel }, ['1021_常用', '1001_值_50,中文']); assert.equal(hidden.page.totalCount, 1); assert(!hidden.facets.attrs.some(attr => attr.attrId === '1021'))
      const zero = await search({}, ['100_不存在的值']); assert.equal(zero.page.totalCount, 0); assert.deepEqual(zero.facets, { attrs: [], attrsTruncated: false })
    })
    await scene(t, 'real Elasticsearch outages are errors and recovery restores the same full facets', async () => {
      docker('stop')
      const failed = await fetch('http://127.0.0.1:88/api/search?keyword=' + fixture.label); assert.equal(failed.status, 503); const body = await failed.json(); assert.equal(body.page, undefined); assert.equal(body.facets, undefined)
      docker('start'); await until(async () => (await fetch('http://127.0.0.1:19200')).ok)
      await until(async () => (await search()).page.totalCount === 15)
      assert.equal(capacity(await search()).values.length, 2)
    })
    assert.equal(checks.length, 5); writeFileSync('.tools/test/searchfacets-result.json', JSON.stringify({ environment: 'Test', passed: true, checks }, null, 2) + '\n')
  } finally {
    if (stopped) { docker('start'); await until(async () => (await fetch('http://127.0.0.1:19200')).ok) }
    if (fixture) await fixture.remove()
  }
})
