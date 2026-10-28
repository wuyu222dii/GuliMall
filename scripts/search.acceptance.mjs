import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Set GULIMALL_ACCEPTANCE=1; use scripts/test.ps1 for the isolated test environment.')
await assertTestEnvironment()
const base='http://127.0.0.1:88', es='http://127.0.0.1:19200', index='gulimall-products-v1'
const label=`stage4_${randomUUID().replaceAll('-','')}`
let product, id, esStopped=false, productStopped=false
function sql(statement) {
  const r=spawnSync('docker',['compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names --default-character-set=utf8mb4'],{input:statement,encoding:'utf8',windowsHide:true})
  assert.equal(r.status,0,r.stderr); return r.stdout.trim()
}
function command(program,args) { const r=spawnSync(program,args,{stdio:'ignore',windowsHide:true,timeout:30000});assert.equal(r.status,0,`${program} command failed`) }
function service(action) { command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/services.ps1',action,'-Modules','product']) }
class Client {
  cookie='';csrf=''
  async call(path,method='GET',body) {
    const r=await fetch(path.startsWith('http:')?path:base+path,{method,headers:{Cookie:this.cookie,'X-CSRF-Token':this.csrf,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)})
    const c=r.headers.getSetCookie().find(c=>c.startsWith('GULIMALLSESSION=')); if(c)this.cookie=c.split(';')[0]
    const data=await r.json(); if(data.csrfToken)this.csrf=data.csrfToken; return {status:r.status,data}
  }
}
const admin=new Client(),guest=new Client(),member=new Client()
async function ok(path,method='GET',body) { const r=await admin.call(path,method,body); assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.code,0,r.data.msg);return r.data }
const publish=(status)=>admin.call(`/api/admin/product/search-sync/${id}/publish?status=${status}`,'POST')
const retry=()=>ok(`/api/admin/product/search-sync/${id}/retry`,'POST')
async function search(params={}) {const r=await guest.call('/api/search?'+new URLSearchParams({keyword:label,...params}));assert.equal(r.status,200,JSON.stringify(r.data));return r.data.page}
async function until(check,message,seconds=50) {for(let i=0;i<seconds;i++){try{if(await check())return}catch{} await new Promise(r=>setTimeout(r,1000))}assert.fail(message)}
async function job() {
  // Prior fixtures can leave more than one page; state ordering changes after retries.
  for(let page=1;;page++) {
    const result=(await ok('/api/admin/product/search-sync?limit=100&page='+page)).page
    const found=result.list.find(j=>j.spu_id===id)
    if(found)return found
    if(page>=result.totalPage)assert.fail('Current product synchronization task was not found across all pages')
  }
}
async function synchronized(message) {
  const total=(await ok('/api/admin/product/search-sync?limit=1')).page.totalCount
  // The worker handles 20 jobs per 15s tick; each ES refresh may wait 1s, and failed jobs back off 30s.
  const seconds=Math.max(50,Math.ceil(total/20)*(15+20)+30)
  console.log(`Background synchronization: ${total} persisted tasks, ${seconds}s verification budget`)
  await until(async()=>(await job()).state===1,message,seconds)
}
async function document(sku) {const r=await fetch(`${es}/${index}/_doc/${sku}`);return {status:r.status,data:await r.json()}}

test('stage 4 Elasticsearch search and durable synchronization acceptance',async t=>{
  try {
    await admin.call('/api/auth/csrf');await ok('/api/auth/admin/login','POST',JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE || '.tools/admin-access.json','utf8')))
    await member.call('/api/auth/csrf');assert.equal((await member.call('/api/auth/login','POST',{username:'demo_a',password:'Demo12345!'})).status,200)
    await t.test('management and internal indexing remain protected',async()=>{
      assert.equal((await guest.call('/api/admin/product/search-sync')).status,401)
      assert.equal((await member.call('/api/admin/product/search-sync/rebuild','POST')).status,403)
      assert.equal((await guest.call('http://127.0.0.1:12000/internal/search/index','POST')).status,403)
      assert.equal((await member.call('http://127.0.0.1:10001/product/search-sync/rebuild','POST')).status,403)
      const noCsrf=new Client();noCsrf.cookie=admin.cookie
      assert.equal((await noCsrf.call('/api/admin/product/search-sync/rebuild','POST')).status,403)
    })
    product={spuName:label,spuDescription:'阶段四星河手机检索验收',catalogId:900003,brandId:900001,weight:'0.2',images:['/demo-product.svg'],decript:['/demo-product.svg'],baseAttrs:[{attrId:900001,attrValues:'8GB',showDesc:1}],skus:['红色','蓝色','绿色'].map((color,i)=>({skuName:`${label} 星河手机 ${color}`,skuTitle:`${label} 星河手机 ${color}`,price:['0.00','10.00','20.00'][i],attr:[{attrId:900002,attrName:'颜色',attrValue:color}],images:[{imgUrl:'/demo-product.svg',defaultImg:1}]}))}
    id=(await ok('/api/admin/product/spuinfo/editor','POST',product)).id
    product=(await ok(`/api/admin/product/spuinfo/editor/${id}`)).product
    sql(`INSERT INTO gulimall_wms_test.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(${product.skus[0].skuId},900001,5,0);`)
    await t.test('drafts are hidden; published multi-SKU documents support Chinese search, combined filters and pagination',async()=>{
      assert.equal((await search()).totalCount,0)
      assert.equal((await publish(1)).status,200);assert.equal((await job()).state,1)
      const p=await search({catalogId:900003,brandId:900001,min:0,max:20,sort:'price_desc',page:2,limit:1})
      assert.equal(p.totalCount,3);assert.equal(p.totalPage,3);assert.equal(p.list[0].price,10)
      assert.ok((await search({keyword:'星河手机'})).list.some(s=>s.skuId===product.skus[0].skuId))
      assert.equal((await search({max:0})).totalCount,1)
      assert.equal((await search({hasStock:1})).totalCount,1);assert.equal((await search({hasStock:0})).totalCount,2)
      assert.equal((await search({attrs:'900001_8GB'})).totalCount,3);assert.equal((await search({attrs:'900001_16GB'})).totalCount,0)
      assert.equal((await search({keyword:product.skus[2].skuId})).list[0].skuId,product.skus[2].skuId)
      for(const params of [{sort:'price;drop'}, {page:'abc'},{page:1001,limit:10},{hasStock:2},{min:2,max:1},{attrs:'broken'},{brandId:-1}]) assert.equal((await guest.call('/api/search?'+new URLSearchParams(params))).status,400)
      const mapping=await(await fetch(`${es}/${index}/_mapping`)).json();assert.equal(mapping[index].mappings.properties.attrs.type,'nested');assert.equal(mapping[index].mappings.properties.skuTitle.analyzer,'cjk')
      const aliases=await(await fetch(`${es}/${index}/_alias`)).json();assert.ok(aliases[index].aliases['gulimall-products-write'])
    })
    await t.test('published price changes synchronize and older replays cannot overwrite a newer version',async()=>{
      await ok(`/api/admin/product/attr/update/${id}`,'POST',[{attrId:900001,attrName:'内存',attrValue:'16GB',quickShow:1}])
      await retry();assert.equal((await search({attrs:'900001_16GB'})).totalCount,3)
      const before=await job(); product.skus[1].price='12.50';await ok('/api/admin/product/spuinfo/editor','POST',product)
      assert.ok((await job()).version>before.version);await retry()
      assert.equal((await search({min:'12.50',max:'12.50'})).totalCount,1)
      const stale=(await document(product.skus[0].skuId)).data._source
      assert.equal((await publish(0)).status,200);assert.equal((await search()).totalCount,0)
      const r=await fetch('http://127.0.0.1:12000/internal/search/synchronize',{method:'POST',headers:{'Content-Type':'application/json','X-Internal-Token':process.env.INTERNAL_API_TOKEN},body:JSON.stringify({spuId:id,version:before.version,onSale:true,skus:[stale]})})
      assert.equal(r.status,200);assert.equal((await document(product.skus[0].skuId)).status,404)
      assert.equal((await publish(1)).status,200)
    })
    await t.test('ES outage is explicit; failed tasks survive a product restart and retry the latest saved state',{skip:process.env.GULIMALL_FAULTS!=='1'},async()=>{
      esStopped=true;command('docker',['compose','stop','elasticsearch'])
      assert.equal((await publish(0)).status,503);assert.equal((await job()).state,2)
      assert.equal((await guest.call(`/api/product/items/${product.skus[0].skuId}/purchase-check`)).status,409)
      assert.equal((await guest.call('/api/search?keyword='+label)).status,503)
      assert.equal((await publish(1)).status,503)
      product.skus[1].price='13.50';await ok('/api/admin/product/spuinfo/editor','POST',product)
      const version=(await job()).version
      productStopped=true;service('Stop');service('Start');productStopped=false
      await until(async()=>{const j=await job();return j.version>=version},'Durable task lost after restart')
      command('docker',['compose','start','elasticsearch']);esStopped=false
      await until(async()=>(await fetch(es)).ok,'ES did not recover')
      await synchronized('Automatic retry did not recover after ES restart')
      assert.equal((await search({min:'13.50',max:'13.50'})).totalCount,1)
    })
    await t.test('lost index is rebuilt from product databases with published items restored',{skip:process.env.GULIMALL_FAULTS!=='1'},async()=>{
      assert.equal((await fetch(`${es}/${index}`,{method:'DELETE'})).status,200)
      assert.equal((await guest.call('/api/search?keyword='+label)).status,503)
      await ok('/api/admin/product/search-sync/rebuild','POST')
      await synchronized('Rebuild did not complete')
      assert.equal((await search()).totalCount,3)
      await until(async()=>{const p=await guest.call('/api/search?keyword=Demo');return p.status===200&&p.data.page.list.some(s=>s.skuId===900001)},'Seed catalog was not rebuilt')
      assert.equal(sql('SELECT GROUP_CONCAT(CONCAT(sku_id,\':\',stock,\':\',stock_locked) ORDER BY sku_id) FROM gulimall_wms_test.wms_ware_sku WHERE ware_id=900001 AND sku_id IN(900001,900002);'),'900001:10:0,900002:1:0')
    })
  } finally {
    if(esStopped)command('docker',['compose','start','elasticsearch'])
    if(productStopped)service('Start')
    if(id){
      await until(async()=>{try{return (await publish(0)).status===200}catch{return false}},'Could not remove indexed fixture safely')
      const ids=product.skus.map(s=>s.skuId).filter(Boolean).join(',')
      if(ids)sql(`DELETE FROM gulimall_wms_test.wms_ware_sku WHERE sku_id IN(${ids});DELETE FROM gulimall_pms_test.pms_sku_images WHERE sku_id IN(${ids});DELETE FROM gulimall_pms_test.pms_sku_sale_attr_value WHERE sku_id IN(${ids});DELETE FROM gulimall_pms_test.pms_sku_info WHERE sku_id IN(${ids}) AND spu_id=${id};`)
      sql(`DELETE FROM gulimall_pms_test.pms_search_sync WHERE spu_id=${id};DELETE FROM gulimall_pms_test.pms_product_attr_value WHERE spu_id=${id};DELETE FROM gulimall_pms_test.pms_spu_images WHERE spu_id=${id};DELETE FROM gulimall_pms_test.pms_spu_info_desc WHERE spu_id=${id};DELETE FROM gulimall_pms_test.pms_spu_info WHERE id=${id} AND spu_name='${label}';`)
    }
    await admin.call('/api/auth/logout','POST');await member.call('/api/auth/logout','POST')
  }
})
