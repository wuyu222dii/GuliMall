import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1 and use scripts/test.ps1. This writes disposable local *_test fixtures.')
const label = `stage2_${randomUUID().replaceAll('-', '')}`
const inserted = new Map()
let wareStopped = false
await assertTestEnvironment()
const base = 'http://127.0.0.1:88'
function sql(statement) {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input: statement, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr || 'Fixture SQL failed')
  return result.stdout.trim()
}
function track(table, id) { inserted.set(table, [...(inserted.get(table) || []), id]); return id }
function row(table, columns, values) {
  const db = table.startsWith('wms_') ? 'gulimall_wms_test' : 'gulimall_pms_test'
  return track(table, Number(sql(`INSERT INTO ${db}.${table} (${columns}) VALUES (${values}); SELECT LAST_INSERT_ID();`)))
}
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body) {
    const response = await fetch(path.startsWith('http:') ? path : base + path, {
      method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    })
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith('GULIMALLSESSION='))
    if (cookie) this.cookie = cookie.split(';')[0]
    const data = await response.json()
    if (data.csrfToken) this.csrf = data.csrfToken
    return { status: response.status, data }
  }
}
const guest = new Client(); const admin = new Client()
async function category(name, parentCid, catLevel) {
  assert.equal((await admin.call('/api/admin/product/category/save', 'POST', { name, parentCid, catLevel, showStatus: 1, sort: 0 })).status, 200)
  return track('pms_category', Number(sql(`SELECT cat_id FROM gulimall_pms_test.pms_category WHERE name='${name}';`)))
}
async function list(params = {}) {
  const result = await guest.call('/api/product/items?' + new URLSearchParams({ keyword: label, ...params }))
  assert.equal(result.status, 200, result.data.msg)
  return result.data.page
}
function service(action) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/services.ps1', action, '-Modules', 'ware'], { stdio: 'ignore', windowsHide: true, timeout: 20000 })
  assert.equal(result.status, 0, 'Warehouse process command failed')
}
async function awaitStock(id) {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await guest.call(`/api/product/items/${id}`)).data.item?.hasStock === true) return }
    catch { /* Process may still be starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error('Warehouse did not recover')
}

test('stage 2 product browsing and saleability acceptance', async (t) => {
  const ids = {}
  try {
    assert.equal((await admin.call('/api/auth/csrf')).status, 200)
    const credentials = process.env.ADMIN_TEST_PASSWORD ? { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_TEST_PASSWORD }
      : JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE || '.tools/admin-access.json', 'utf8'))
    assert.equal((await admin.call('/api/auth/admin/login', 'POST', credentials)).status, 200)
    ids.root = await category(`${label}_Root`, 0, 1)
    ids.parent = await category(`${label}_Parent`, ids.root, 2)
    ids.catalog = await category(`${label}_Phones`, ids.parent, 3)
    ids.otherCatalog = await category(`${label}_Other`, ids.parent, 3)
    ids.brand = row('pms_brand', 'name,show_status,sort', `'${label}_BrandA',1,0`)
    ids.otherBrand = row('pms_brand', 'name,show_status,sort', `'${label}_BrandB',1,0`)
    ids.downBrand = row('pms_brand', 'name,show_status,sort', `'${label}_DownBrand',1,0`)
    const spu = (suffix, catalog, brand, status) => row('pms_spu_info', 'spu_name,spu_description,catalog_id,brand_id,publish_status', `'${label}_${suffix}','${label} introduction',${catalog},${brand},${status}`)
    ids.spu = spu('Phone', ids.catalog, ids.brand, 1)
    ids.otherSpu = spu('Other', ids.otherCatalog, ids.otherBrand, 1)
    ids.downSpu = spu('Down', ids.catalog, ids.downBrand, 0)
    ids.ware = row('wms_ware_info', 'name,address', `'${label}','Acceptance warehouse'`)
    const sku = (name, spuId, catalogId, brandId, price, stock, locked = 0) => {
      const id = row('pms_sku_info', 'spu_id,sku_name,sku_title,catalog_id,brand_id,price,sku_default_img', `${spuId},'${label}_${name}','${label}_${name}',${catalogId},${brandId},${price},'/demo-product.svg'`)
      row('wms_ware_sku', 'sku_id,ware_id,stock,stock_locked', `${id},${ids.ware},${stock},${locked}`)
      return id
    }
    ids.red = sku('Red', ids.spu, ids.catalog, ids.brand, 10, 5)
    ids.blue = sku('Blue', ids.spu, ids.catalog, ids.brand, 20, 1)
    ids.out = sku('Green', ids.spu, ids.catalog, ids.brand, 0, 0)
    ids.other = sku('Other', ids.otherSpu, ids.otherCatalog, ids.otherBrand, 30, 2)
    ids.locked = sku('Locked', ids.otherSpu, ids.otherCatalog, ids.otherBrand, 5, 1, 1)
    ids.down = sku('Down', ids.downSpu, ids.catalog, ids.downBrand, 15, 2)
    const color = row('pms_attr', 'attr_name,attr_type,enable,catelog_id', `'Color',0,1,${ids.catalog}`)
    const size = row('pms_attr', 'attr_name,attr_type,enable,catelog_id', `'Size',0,1,${ids.catalog}`)
    for (const [skuId, value] of [[ids.red, 'Red'], [ids.blue, 'Blue'], [ids.out, 'Green']]) {
      row('pms_sku_sale_attr_value', 'sku_id,attr_id,attr_name,attr_value', `${skuId},${color},'Color','${value}'`)
      row('pms_sku_sale_attr_value', 'sku_id,attr_id,attr_name,attr_value', `${skuId},${size},'Size','8GB'`)
    }
    for (let i = 0; i < 2; i++) {
      const group = row('pms_attr_group', 'attr_group_name,catelog_id,sort', `'Same group name',${ids.catalog},${i}`)
      const attr = row('pms_attr', 'attr_name,attr_type,enable,catelog_id', `'Spec${i}',1,1,${ids.catalog}`)
      row('pms_attr_attrgroup_relation', 'attr_id,attr_group_id,attr_sort', `${attr},${group},0`)
      row('pms_product_attr_value', 'spu_id,attr_id,attr_name,attr_value', `${ids.spu},${attr},'Spec${i}','Value${i}'`)
    }
    row('pms_sku_images', 'sku_id,img_url,img_sort', `${ids.red},'/image-unavailable.svg',2`)
    row('pms_sku_images', 'sku_id,img_url,img_sort', `${ids.red},'/demo-product.svg',1`)
    sql(`INSERT INTO gulimall_pms_test.pms_spu_info_desc(spu_id,decript) VALUES (${ids.spu},'/demo-product.svg');`)

    await t.test('consumer queries combine keyword, category, brand, price and stable pagination', async () => {
      assert.equal((await list()).totalCount, 5)
      assert.deepEqual((await list({ catalogId: ids.catalog, brandId: ids.brand, min: 9, max: 10 })).list.map((s) => s.skuId), [ids.red])
      assert.equal((await list({ catalogId: ids.otherCatalog, brandId: ids.brand })).totalCount, 0)
      assert.equal((await list({ brandId: ids.otherBrand, catalogId: 0 })).totalCount, 2)
      assert.equal((await list({ brandId: 0, max: 10 })).totalCount, 3)
      assert.deepEqual((await list({ max: 0 })).list.map((s) => s.skuId), [ids.out])
      const result = await guest.call('/api/product/items?' + new URLSearchParams({ keyword: label, sort: 'price_desc', page: 2, limit: 2 }))
      assert.equal(result.data.page.totalCount, 5); assert.equal(result.data.page.totalPage, 3)
      assert.deepEqual(result.data.page.list.map((s) => s.skuId), [ids.red, ids.locked])
      const legacy = await admin.call('/api/admin/product/skuinfo/list?' + new URLSearchParams({ key: label, catelogId: ids.catalog, brandId: ids.brand, max: 10 }))
      assert.equal(legacy.status, 200); assert.equal(legacy.data.page.totalCount, 2)
      const spus = await admin.call('/api/admin/product/spuinfo/list?' + new URLSearchParams({ key: label, catalogId: ids.otherCatalog }))
      assert.equal(spus.status, 200); assert.equal(spus.data.page.totalCount, 1)
      for (const params of [{ min: -1 }, { max: 'bad' }, { min: 20, max: 1 }, { page: 0 }, { limit: 101 }, { sort: 'price;drop table' }]) {
        assert.equal((await guest.call('/api/product/items?' + new URLSearchParams(params))).status, 400)
      }
    })
    await t.test('detail includes ordered images, SKU combinations, separate groups and introduction', async () => {
      const detail = await guest.call(`/api/product/items/${ids.red}`)
      assert.equal(detail.status, 200, detail.data.msg)
      const item = detail.data.item
      assert.equal(item.onSale, true); assert.equal(item.hasStock, true)
      assert.equal(item.variants.length, 3)
      assert.equal(item.saleAttr.length, 2)
      assert.equal(item.saleAttr.find((a) => a.attrName === 'Color').attrValues.length, 3)
      assert.equal(item.groupAttrs.length, 2, 'Groups with the same name must not merge')
      assert.equal(item.groupAttrs[0].attrs[0].attrValue, 'Value0')
      assert.equal(item.images[0].imgUrl, '/demo-product.svg')
      assert.equal(item.desc.decript, '/demo-product.svg'); assert.ok(item.spuDescription.includes(label))
      assert.equal((await guest.call(`/api/product/items/${ids.blue}`)).data.item.info.price, 20)
      assert.equal((await guest.call('/api/product/items/999999999999')).status, 404)
      assert.equal((await guest.call('/api/product/items/not-a-number')).status, 400)
      assert.equal((await guest.call(`/api/product/items/${ids.red}/purchase-check`)).status, 200)
    })
    await t.test('off-shelf, missing, exhausted and locked stock cannot pass purchase checks', async () => {
      assert.equal((await guest.call(`/api/product/items/${ids.down}`)).data.item.onSale, false)
      for (const id of [ids.down, ids.out, ids.locked]) assert.equal((await guest.call(`/api/product/items/${id}/purchase-check`)).status, 409)
      assert.equal((await guest.call('/api/product/items/999999999999/purchase-check')).status, 404)
      assert.equal((await admin.call('/api/admin/product/spuinfo/update', 'POST', { id: ids.spu, publishStatus: 0 })).status, 200)
      assert.equal((await list({ catalogId: ids.catalog, brandId: ids.brand })).totalCount, 0)
      assert.equal((await guest.call(`/api/product/items/${ids.red}/purchase-check`)).status, 409)
      assert.equal((await admin.call('/api/admin/product/spuinfo/update', 'POST', { id: ids.spu, publishStatus: 1 })).status, 200)
      const brands = (await guest.call(`/api/product/brands?catalogId=${ids.catalog}`)).data.data
      assert.ok(brands.some((b) => b.brandId === ids.brand)); assert.ok(!brands.some((b) => b.brandId === ids.downBrand))
      assert.equal((await guest.call('/api/product/skuinfo/list')).status, 404)
      assert.equal((await guest.call('http://127.0.0.1:10001/product/skuinfo/list')).status, 401)
    })
    await t.test('category create, rename and delete invalidate both consumer catalog caches', async () => {
      await guest.call('/api/product/categories'); await guest.call('/api/product/catalog')
      const created = await category(`${label}_Added`, ids.parent, 3)
      const contains = async (path, value) => JSON.stringify((await guest.call(path)).data).includes(value)
      assert.ok(await contains('/api/product/categories', `${label}_Added`))
      assert.equal((await admin.call('/api/admin/product/category/update', 'POST', { catId: created, name: `${label}_Renamed` })).status, 200)
      assert.ok(await contains('/api/product/categories', `${label}_Renamed`))
      assert.ok(await contains('/api/product/catalog', `${label}_Renamed`))
      assert.equal((await admin.call('/api/admin/product/category/delete', 'POST', [created])).status, 200)
      assert.ok(!await contains('/api/product/categories', `${label}_Renamed`))
      assert.ok(!await contains('/api/product/catalog', `${label}_Renamed`))
      assert.equal((await admin.call('/api/admin/product/category/delete', 'POST', [ids.root])).status, 409)
      assert.equal((await admin.call('/api/admin/product/category/delete', 'POST', [ids.catalog])).status, 409)
    })
    await t.test('warehouse outage returns unknown stock, rejects purchase and recovers', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      wareStopped = true; service('Stop')
      const detail = await guest.call(`/api/product/items/${ids.red}`)
      assert.equal(detail.status, 200); assert.equal(detail.data.item.hasStock, null)
      assert.equal((await guest.call(`/api/product/items/${ids.red}/purchase-check`)).status, 503)
      service('Start'); wareStopped = false
      await awaitStock(ids.red)
      assert.equal((await guest.call(`/api/product/items/${ids.red}/purchase-check`)).status, 200)
    })
  } finally {
    if (wareStopped) service('Start')
    for (const spuId of inserted.get('pms_spu_info') || []) {
      assert.equal((await admin.call(`/api/admin/product/search-sync/${spuId}/publish?status=0`, 'POST')).status, 200, 'Search fixture cleanup failed')
      sql(`DELETE FROM gulimall_pms_test.pms_search_sync WHERE spu_id=${spuId};`)
    }
    if (ids.spu) sql(`DELETE FROM gulimall_pms_test.pms_spu_info_desc WHERE spu_id=${ids.spu};`)
    const categories = inserted.get('pms_category') || []
    for (const [table, rowIds] of [...inserted].reverse()) {
      if (table === 'pms_category' || !rowIds.length) continue
      const db = table.startsWith('wms_') ? 'gulimall_wms_test' : 'gulimall_pms_test'
      const primary = { pms_attr_group: 'attr_group_id', pms_attr: 'attr_id', pms_brand: 'brand_id', pms_sku_info: 'sku_id' }[table] || 'id'
      sql(`DELETE FROM ${db}.${table} WHERE ${primary} IN (${rowIds.join(',')});`)
    }
    if (categories.length) {
      assert.equal((await admin.call('/api/admin/product/category/delete', 'POST', categories)).status, 200, 'Category cache cleanup failed')
      sql(`DELETE FROM gulimall_pms_test.pms_category WHERE cat_id IN (${categories.join(',')});`)
    }
    if (admin.csrf) await admin.call('/api/auth/logout', 'POST')
  }
})
