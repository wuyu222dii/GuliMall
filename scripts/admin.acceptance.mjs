import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1 and use scripts/test.ps1 for isolated *_test databases.')
await assertTestEnvironment()
const base = 'http://127.0.0.1:88'
const label = `stage3_${randomUUID().replaceAll('-', '')}`
const ids = { categories: [], brands: [], groups: [], attrs: [], warehouses: [], products: [], demands: [], purchases: [] }
let imageName, legacyImageName; let thirdStopped = false
function sql(statement) {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'], { input: statement, encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr || 'Fixture SQL failed')
  return result.stdout.trim()
}
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body) {
    const form = body instanceof FormData
    const response = await fetch(path.startsWith('http:') ? path : base + path, {
      method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    })
    const cookie = response.headers.getSetCookie().find((c) => c.startsWith('GULIMALLSESSION='))
    if (cookie) this.cookie = cookie.split(';')[0]
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { msg: text.slice(0, 100) } }
    if (data.csrfToken) this.csrf = data.csrfToken
    return { status: response.status, data }
  }
}
const admin = new Client(), member = new Client(), guest = new Client()
async function success(path, method = 'GET', body) {
  const result = await admin.call(path, method, body)
  assert.equal(result.status, 200, `${path}: ${result.data.msg}`)
  assert.equal(result.data.code, 0, result.data.msg)
  return result.data
}
async function meta(kind, body) {
  const result = await success(`/api/admin/product/admin/catalog/${kind}`, 'POST', body)
  assert.ok(result.id > 0); ids[kind].push(result.id); return result.id
}
function upload(bytes = readFileSync('scripts/fixtures/upload.png'), mime = 'image/png', name = 'product.png') {
  const form = new FormData(); form.append('file', new Blob([bytes], { type: mime }), name); return form
}
function service(action, module = 'third-party') {
  const env={...process.env};delete env.PSModulePath
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/services.ps1', action, '-Modules', module], { env, stdio: 'ignore', timeout: 20000, windowsHide: true })
  assert.equal(result.status, 0, 'Image service command failed')
}
async function demand(sku, ware, qty, price = '0.00') {
  const result = await success('/api/admin/ware/purchasedetail/save', 'POST', { skuId: sku, wareId: ware, skuNum: qty, skuPrice: price })
  ids.demands.push(result.id); return result.id
}
async function merge(items, purchaseId = null) {
  const result = await success('/api/admin/ware/purchase/merge', 'POST', { items, purchaseId })
  if (!ids.purchases.includes(result.purchaseId)) ids.purchases.push(result.purchaseId)
  return result.purchaseId
}
const receive = (id) => success('/api/admin/ware/purchase/received', 'POST', [id])
const finish = (id, items) => admin.call('/api/admin/ware/purchase/done', 'POST', { id, items })
function stock(sku, ware) { return Number(sql(`SELECT COALESCE(SUM(stock),0) FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku} AND ware_id=${ware};`)) }

test('stage 3 administration, local images and procurement acceptance', async (t) => {
  let productId, product, sku1, sku2, warehouse, otherWarehouse, uploaded
  try {
    await admin.call('/api/auth/csrf')
    const credentials = process.env.ADMIN_TEST_PASSWORD ? { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_TEST_PASSWORD } : JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE || '.tools/admin-access.json', 'utf8'))
    assert.equal((await admin.call('/api/auth/admin/login', 'POST', credentials)).status, 200)
    await member.call('/api/auth/csrf')
    assert.equal((await member.call('/api/auth/login', 'POST', { username: 'demo_a', password: 'Demo12345!' })).status, 200)
    await t.test('administration and upload stay protected for anonymous and member callers', async () => {
      for (const path of ['/api/admin/product/admin/catalog', '/api/admin/ware/purchase/list', '/api/admin/order/order/list']) {
        assert.equal((await guest.call(path)).status, 401); assert.equal((await member.call(path)).status, 403)
      }
      assert.equal((await member.call('/api/admin/thirdparty/local/images', 'POST', upload())).status, 403)
      assert.equal((await guest.call('/api/admin/thirdparty/local/images', 'POST', upload())).status, 401)
      assert.equal((await member.call('/api/admin/thirdparty/images', 'POST', upload())).status, 403)
      assert.equal((await guest.call('/api/admin/thirdparty/images', 'POST', upload())).status, 401)
      assert.equal((await member.call('http://127.0.0.1:30000/local/images', 'POST', upload())).status, 403)
    })
    await t.test('real image bytes are validated, renamed and publicly readable', async () => {
      for (const data of [upload(Buffer.from('<svg/>'), 'image/svg+xml', 'fake.svg'), upload(Buffer.from('not a picture'), 'image/png', 'fake.png')]) {
        assert.equal((await admin.call('/api/admin/thirdparty/local/images', 'POST', data)).status, 400)
      }
      assert.equal((await admin.call('/api/admin/thirdparty/local/images', 'POST', upload(Buffer.alloc(2 * 1024 * 1024 + 1)))).status, 413)
      assert.equal((await admin.call('/api/admin/thirdparty/images','POST',upload(Buffer.from('not an image')))).status,400)
      uploaded = (await success('/api/admin/thirdparty/images', 'POST', upload(undefined, 'image/png', '../../outside.png'))).url
      assert.match(uploaded, /^\/api\/media\/[a-f0-9]{32}\.png$/)
      imageName = uploaded.split('/').at(-1)
      const legacy=(await success('/api/admin/thirdparty/local/images','POST',upload())).url;legacyImageName=legacy.split('/').at(-1)
      assert.equal((await fetch(base+legacy)).status,200)
      const response = await fetch(base + uploaded)
      assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /image\/png/)
      assert.ok((await response.arrayBuffer()).byteLength > 0)
      const traversal = await admin.call('/api/media/%2e%2e%2f.env')
      assert.ok([400, 401, 403, 404].includes(traversal.status))
    })
    await t.test('category, brand, group and attributes are maintained through business APIs', async () => {
      const root = await meta('categories', { name: `${label}_root`, catLevel: 1, parentCid: 0, sort: 0 })
      const parent = await meta('categories', { name: `${label}_parent`, catLevel: 2, parentCid: root, sort: 0 })
      const catalog = await meta('categories', { name: `${label}_leaf`, catLevel: 3, parentCid: parent, sort: 0 })
      const brand = await meta('brands', { name: `${label}_brand`, logo: uploaded, firstLetter: 'S', sort: 0, showStatus: 1 })
      const group = await meta('groups', { attrGroupName: `${label}_specs`, catelogId: catalog, sort: 0 })
      const basic = await meta('attrs', { attrName: `${label}_memory`, catelogId: catalog, attrType: 1, attrGroupId: group, enable: 1, valueSelect: '8GB;16GB' })
      const sale = await meta('attrs', { attrName: `${label}_color`, catelogId: catalog, attrType: 0, enable: 1, valueSelect: 'Red;Blue' })
      const data = (await success('/api/admin/product/admin/catalog')).data
      assert.ok(data.attrs.some((a) => a.attrId === basic)); assert.ok(data.relations.some((r) => r.attrId === basic && r.attrGroupId === group))
      const invalid = await admin.call('/api/admin/product/admin/catalog/attrs', 'POST', { attrName: 'Invalid', catelogId: catalog, attrType: 1, attrGroupId: 999999999999, enable: 1 })
      assert.equal(invalid.status, 400)
      product = { spuName: `${label}_phone`, spuDescription: 'Stage 3 real multi-SKU fixture', catalogId: catalog, brandId: brand, weight: '0.2', publishStatus: 1,
        images: [uploaded, '/demo-product.svg'], decript: [uploaded], baseAttrs: [{ attrId: basic, attrValues: '8GB', showDesc: 1 }],
        skus: ['Red', 'Blue'].map((color, index) => ({ skuName: `${label}_${color}`, skuTitle: `${label}_${color}`, skuSubtitle: 'Acceptance fixture', price: index ? '20.00' : '10.00',
          attr: [{ attrId: sale, attrName: 'CLIENT NAME MUST BE IGNORED', attrValue: color }], images: [{ imgUrl: uploaded, defaultImg: 1 }, { imgUrl: '/demo-product.svg', defaultImg: 0 }] })) }
    })
    await t.test('multi-SKU save is local, validates combinations and keeps SKU identities on editing', async () => {
      const bad = structuredClone(product); bad.skus[1].attr[0].attrValue = 'Red'
      assert.equal((await admin.call('/api/admin/product/spuinfo/editor', 'POST', bad)).status, 400)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_spu_info WHERE spu_name='${product.spuName}';`), '0')
      productId = (await success('/api/admin/product/spuinfo/editor', 'POST', product)).id; ids.products.push(productId)
      product = (await success(`/api/admin/product/spuinfo/editor/${productId}`)).product
      assert.equal(product.publishStatus, 0, 'Create must remain a draft')
      assert.equal(product.skus.length, 2); assert.equal(product.skus[0].images.length, 2)
      assert.notEqual(product.skus[0].attr[0].attrName, 'CLIENT NAME MUST BE IGNORED')
      sku1 = product.skus[0].skuId; sku2 = product.skus[1].skuId
      const omitted = structuredClone(product); omitted.skus.pop()
      assert.equal((await admin.call('/api/admin/product/spuinfo/editor', 'POST', omitted)).status, 409)
      const negative = structuredClone(product); negative.skus[0].price = '-1'
      assert.equal((await admin.call('/api/admin/product/spuinfo/editor', 'POST', negative)).status, 400)
      product.skus[0].price = '12.50'; product.spuDescription = 'Updated introduction'
      await success('/api/admin/product/spuinfo/editor', 'POST', product)
      const edited = (await success(`/api/admin/product/spuinfo/editor/${productId}`)).product
      assert.deepEqual(edited.skus.map((s) => s.skuId), [sku1, sku2]); assert.equal(edited.skus[0].price, 12.5)
      const attr = (await success('/api/admin/product/admin/catalog')).data.attrs.find((a) => a.attrId === product.skus[0].attr[0].attrId)
      await success('/api/admin/product/admin/catalog/attrs', 'POST', { ...attr, attrName: `${label}_renamed_color` })
      const renamed = (await success(`/api/admin/product/spuinfo/editor/${productId}`)).product
      assert.ok(renamed.skus.every((s) => s.attr[0].attrName === `${label}_renamed_color`))
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_sms_test.sms_spu_bounds WHERE spu_id=${productId};`), '0')
      assert.equal((await admin.call('/api/admin/product/skuinfo/update', 'POST', { skuId: sku1, spuId: 900001 })).status, 400)
      assert.equal((await admin.call('/api/admin/product/skuinfo/delete', 'POST', [sku1])).status, 409)
      assert.equal((await admin.call(`/api/admin/product/admin/catalog/brands/${product.brandId}`, 'DELETE')).status, 409)
    })
    await t.test('durable product creation replays concurrent requests and rejects changed snapshots', async () => {
      const creation=structuredClone(product);delete creation.id
      creation.spuName=label+'_idempotent';creation.skus.forEach(s=>{delete s.skuId})
      creation.creationRequestId=randomUUID()
      const responses=await Promise.all([1,2,3].map(()=>success('/api/admin/product/spuinfo/editor','POST',creation)))
      const id=responses[0].id;ids.products.push(id);assert(responses.every(r=>r.id===id))
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_spu_info WHERE spu_name='${creation.spuName}';`),'1')
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_spu_info WHERE creation_request_id='${creation.creationRequestId}';`),'1')
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_sku_info WHERE spu_id=${id};`),'2')
      assert.equal((await admin.call('/api/admin/product/spuinfo/editor','POST',{...creation,spuName:'changed'})).status,409)
      const invalid={...creation,creationRequestId:randomUUID(),weight:-1}
      assert.equal((await admin.call('/api/admin/product/spuinfo/editor','POST',invalid)).status,400)
      assert.equal((await success('/api/admin/product/spuinfo/creation/'+invalid.creationRequestId)).found,false)
      assert.equal((await member.call('/api/admin/product/spuinfo/creation/'+creation.creationRequestId)).status,403)
      if(process.env.GULIMALL_FAULTS==='1') {
        service('Stop','product');service('Start','product')
        let ready=false
        for(let i=0;i<90;i++){try{if((await admin.call('/api/admin/product/spuinfo/creation/'+creation.creationRequestId)).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}
        assert(ready,'Product service did not recover')
      }
      assert.equal((await success('/api/admin/product/spuinfo/creation/'+creation.creationRequestId)).id,id)
      assert.equal((await success('/api/admin/product/spuinfo/editor','POST',creation)).id,id)
    })
    await t.test('demand merging, receiving and terminal states reject invalid transitions', async () => {
      warehouse = (await success('/api/admin/ware/wareinfo/save', 'POST', { name: `${label}_ware`, address: 'Acceptance address', areacode: '000' })).id; ids.warehouses.push(warehouse)
      otherWarehouse = (await success('/api/admin/ware/wareinfo/save', 'POST', { name: `${label}_other`, address: 'Other address' })).id; ids.warehouses.push(otherWarehouse)
      assert.equal((await admin.call('/api/admin/ware/purchasedetail/save', 'POST', { skuId: sku1, wareId: warehouse, skuNum: 0, skuPrice: '0' })).status, 400)
      assert.equal((await admin.call('/api/admin/ware/purchasedetail/save', 'POST', { skuId: sku1, wareId: warehouse, skuNum: 1.5, skuPrice: '0' })).status, 400)
      const first = await demand(sku1, warehouse, 5, '25.00'), second = await demand(sku2, warehouse, 2, '10.00')
      const foreign = await demand(sku1, otherWarehouse, 1)
      assert.equal((await admin.call('/api/admin/ware/purchase/merge', 'POST', { items: [first, foreign] })).status, 409)
      const id = await merge([first, second])
      assert.equal((await success(`/api/admin/ware/purchase/info/${id}`)).purchase.amount, 35)
      assert.equal((await admin.call('/api/admin/ware/purchase/merge', 'POST', { items: [first] })).status, 409)
      const items = [{ itemId: first, status: 3 }, { itemId: second, status: 3 }]
      assert.equal((await finish(id, items)).status, 409)
      await receive(id); await receive(id)
      assert.equal((await admin.call('/api/admin/ware/purchasedetail/delete', 'POST', [first])).status, 409)
      assert.equal((await finish(id, [{ itemId: foreign, status: 3 }])).status, 400)
      const duplicates = await Promise.all([finish(id, items), finish(id, items)])
      assert.ok(duplicates.every((r) => r.status === 200), JSON.stringify(duplicates))
      assert.equal(stock(sku1, warehouse), 5); assert.equal(stock(sku2, warehouse), 2)
      assert.equal((await finish(id, items)).status, 200); assert.equal(stock(sku1, warehouse), 5)
      assert.equal((await receiveRejected(id)).status, 409)
      assert.equal((await admin.call('/api/admin/ware/purchase/update', 'POST', { id, status: 1 })).status, 409)
      assert.equal((await admin.call('/api/admin/ware/waresku/update', 'POST', { id: 900001, stock: 999 })).status, 409)
    })
    await t.test('parallel first receipts share one stock row and partial failure never adds failed stock', async () => {
      const d1 = await demand(sku1, otherWarehouse, 2), d2 = await demand(sku1, otherWarehouse, 3)
      const p1 = await merge([d1]), p2 = await merge([d2]); await receive(p1); await receive(p2)
      assert.ok((await Promise.all([finish(p1, [{ itemId: d1, status: 3 }]), finish(p2, [{ itemId: d2, status: 3 }])])).every((r) => r.status === 200))
      assert.equal(stock(sku1, otherWarehouse), 5)
      assert.equal(sql(`SELECT COUNT(*) FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku1} AND ware_id=${otherWarehouse};`), '1')
      const ok = await demand(sku1, warehouse, 2), failed = await demand(sku2, warehouse, 4)
      const id = await merge([ok, failed]); await receive(id)
      assert.equal((await finish(id, [{ itemId: ok, status: 3 }])).status, 400)
      const items = [{ itemId: ok, status: 3 }, { itemId: failed, status: 4, reason: '供应不足' }]
      assert.equal((await finish(id, items)).status, 200); assert.equal((await finish(id, items)).status, 200)
      assert.equal(stock(sku1, warehouse), 7); assert.equal(stock(sku2, warehouse), 2)
      const state = await success(`/api/admin/ware/purchase/info/${id}`)
      assert.equal(state.purchase.status, 4); assert.equal(state.items.find((i) => i.id === failed).failureReason, '供应不足')
      const changed = items.map((i) => ({ ...i, status: 3 }))
      assert.equal((await finish(id, changed)).status, 409)
      const filtered = await success('/api/admin/ware/waresku/list?' + new URLSearchParams({ wareId: warehouse, page: 1, limit: 100 }))
      assert.ok(filtered.page.totalCount >= 2); assert.ok(filtered.page.list.every((s) => s.wareId === warehouse))
      product.skus[0].price = '13.50'; await success('/api/admin/product/spuinfo/editor', 'POST', product)
      assert.equal(stock(sku1, warehouse), 7, 'Editing SKU must preserve stock')
    })
    await t.test('warehouse editing preserves references and paged lookup reaches beyond one hundred', async () => {
      const before=sql(`SELECT id,sku_id,ware_id,stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE ware_id=${warehouse} ORDER BY id;`)
      const demands=sql(`SELECT id,ware_id,purchase_id FROM gulimall_wms_test.wms_purchase_detail WHERE ware_id=${warehouse} ORDER BY id;`)
      await success('/api/admin/ware/wareinfo/update','POST',{id:warehouse,name:label+'_edited',address:'Updated warehouse',areacode:'001',stock:0})
      assert.equal((await success('/api/admin/ware/wareinfo/info/'+warehouse)).wareInfo.name,label+'_edited')
      assert.equal(sql(`SELECT id,sku_id,ware_id,stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE ware_id=${warehouse} ORDER BY id;`),before)
      assert.equal(sql(`SELECT id,ware_id,purchase_id FROM gulimall_wms_test.wms_purchase_detail WHERE ware_id=${warehouse} ORDER BY id;`),demands)
      assert.equal((await admin.call('/api/admin/ware/wareinfo/update','POST',{id:warehouse,name:'',address:'x'})).status,400)
      assert.equal((await admin.call('/api/admin/ware/wareinfo/update','POST',{id:999999999,name:'x',address:'x'})).status,404)
      assert.equal((await member.call('/api/admin/ware/wareinfo/update','POST',{id:warehouse,name:'x',address:'x'})).status,403)
      for(const query of ['page=0','limit=101','page=x']) assert.equal((await admin.call('/api/admin/ware/wareinfo/list?'+query)).status,400)
      for(const query of ['skuId=abc','skuId=-1','wareId=invalid']) assert.equal((await admin.call('/api/admin/ware/waresku/list?'+query)).status,400)
      for(let i=0;i<101;i++) ids.warehouses.push((await success('/api/admin/ware/wareinfo/save','POST',{name:label+'_paged_'+i,address:'Paged lookup'})).id)
      const last=(await success('/api/admin/ware/wareinfo/list?key='+label+'_paged_&page=11&limit=10')).page
      assert.equal(last.totalCount,101);assert.equal(last.list.length,1)
      assert.equal((await success('/api/admin/ware/wareinfo/list?key='+last.list[0].id)).page.list[0].id,last.list[0].id)
    })
    await t.test('uploaded image survives an image-service restart', { skip: process.env.GULIMALL_FAULTS !== '1' }, async () => {
      const before = Buffer.from(await (await fetch(base + uploaded)).arrayBuffer())
      thirdStopped = true; service('Stop'); service('Start'); thirdStopped = false
      let after
      for (let attempt = 0; attempt < 40; attempt++) {
        try { const response = await fetch(base + uploaded, { signal: AbortSignal.timeout(3000) }); if (response.ok) { after = Buffer.from(await response.arrayBuffer()); break } } catch { }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
      assert.ok(after, 'Image service did not recover')
      assert.equal(createHash('sha256').update(before).digest('hex'), createHash('sha256').update(after).digest('hex'))
    })
  } finally {
    if (thirdStopped) service('Start')
    for (const id of ids.purchases) sql(`DELETE FROM gulimall_wms_test.wms_purchase WHERE id=${id};`)
    for (const id of ids.demands) sql(`DELETE FROM gulimall_wms_test.wms_purchase_detail WHERE id=${id};`)
    for (const id of ids.products) {
      const skus = sql(`SELECT sku_id FROM gulimall_pms_test.pms_sku_info WHERE spu_id=${id};`).split(/\s+/).filter(Boolean).map(Number)
      if (skus.length) {
        sql(`DELETE FROM gulimall_wms_test.wms_ware_sku WHERE sku_id IN (${skus.join(',')}); DELETE FROM gulimall_pms_test.pms_sku_images WHERE sku_id IN (${skus.join(',')}); DELETE FROM gulimall_pms_test.pms_sku_sale_attr_value WHERE sku_id IN (${skus.join(',')}); DELETE FROM gulimall_pms_test.pms_sku_info WHERE sku_id IN (${skus.join(',')});`)
      }
      sql(`DELETE FROM gulimall_pms_test.pms_product_attr_value WHERE spu_id=${id}; DELETE FROM gulimall_pms_test.pms_spu_images WHERE spu_id=${id}; DELETE FROM gulimall_pms_test.pms_spu_info_desc WHERE spu_id=${id}; DELETE FROM gulimall_pms_test.pms_spu_info WHERE id=${id} AND spu_name IN ('${label}_phone','${label}_idempotent');`)
    }
    for (const kind of ['attrs', 'groups', 'brands', 'categories']) for (const id of [...ids[kind]].reverse()) {
      await success(`/api/admin/product/admin/catalog/${kind}/${id}`, 'DELETE')
      if (kind === 'categories') sql(`DELETE FROM gulimall_pms_test.pms_category WHERE cat_id=${id};`)
    }
    for (const id of ids.warehouses) sql(`DELETE FROM gulimall_wms_test.wms_ware_info WHERE id=${id};`)
    for(const name of [imageName,legacyImageName].filter(Boolean)) { assert.match(name, /^[a-f0-9]{32}\.png$/); const root = resolve(process.env.UPLOAD_DIR || '.data/uploads'); const path = resolve(root, name); assert.equal(dirname(path), root); unlinkSync(path) }
    await admin.call('/api/auth/logout', 'POST'); await member.call('/api/auth/logout', 'POST')
  }
})
async function receiveRejected(id) { return admin.call('/api/admin/ware/purchase/received', 'POST', [id]) }
