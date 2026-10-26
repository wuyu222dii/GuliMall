import { assertTestEnvironment } from './test-environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID, randomInt } from 'node:crypto'
if(process.env.GULIMALL_ACCEPTANCE!=='1') throw new Error('Set GULIMALL_ACCEPTANCE=1; only use the isolated local *_test environment.')
await assertTestEnvironment()
const base='http://127.0.0.1:88', label='stage5_'+randomUUID().replaceAll('-','')
const members=[], stopped=new Set()
let product,productId,sku1,sku2
function sql(input){const r=spawnSync('docker',['compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --default-character-set=utf8mb4 --batch --skip-column-names'],{input,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function redis(args){const r=spawnSync('docker',['compose','exec','-T','redis','redis-cli','--raw',...args],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function command(program,args){const r=spawnSync(program,args,{stdio:'ignore',timeout:30000,windowsHide:true});assert.equal(r.status,0,'Local service command failed')}
function service(action,module){command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/services.ps1',action,'-Modules',module]);if(action==='Stop')stopped.add(module);else stopped.delete(module)}
class Client {
  cookie='';csrf=''
  async call(path,method='GET',body,headers={}){
    const r=await fetch(path.startsWith('http:')?path:base+path,{method,headers:{Cookie:this.cookie,'X-CSRF-Token':this.csrf,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)})
    const c=r.headers.getSetCookie().find(c=>c.startsWith('GULIMALLSESSION='));if(c)this.cookie=c.split(';')[0]
    const data=await r.json();if(data.csrfToken)this.csrf=data.csrfToken;return {status:r.status,data}
  }
}
const admin=new Client(),a=new Client(),b=new Client(),guest=new Client()
async function ok(client,path,method='GET',body,headers){const r=await client.call(path,method,body,headers);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.code,0,r.data.msg);return r.data}
const view=async(client=a)=>(await ok(client,'/api/cart')).cart
const line=async(client=a)=>(await view(client)).items.find(i=>i.skuId===sku1)
const clear=client=>ok(client,'/api/cart','DELETE')
const add=(client,count=1,extra={})=>ok(client,'/api/cart/items','POST',{skuId:sku1,count,...extra})
const count=n=>ok(a,'/api/cart/items/count','PUT',{skuId:sku1,count:n})
const check=(sku,checked)=>ok(a,'/api/cart/items/checked','PUT',{skuId:sku,checked})
const merge=(body)=>a.call('/api/cart/merge','POST',body)
async function until(check,message){for(let i=0;i<50;i++){try{if(await check())return}catch{}await new Promise(r=>setTimeout(r,1000))}assert.fail(message)}
async function login(client,username,password='Demo12345!'){await client.call('/api/auth/csrf');await ok(client,'/api/auth/login','POST',{username,password})}
function member(suffix){const username=label+suffix,phone='138'+String(randomInt(100000000)).padStart(8,'0');const id=Number(sql(`INSERT INTO gulimall_ums_test.ums_member(username,password,mobile,status) SELECT '${username}',password,'${phone}',1 FROM gulimall_ums_test.ums_member WHERE id=900001; SELECT LAST_INSERT_ID();`));assert.ok(id>900002);members.push({id,username});return username}

test('stage 5 server cart and atomic guest merge acceptance',async t=>{
  try{
    await admin.call('/api/auth/csrf');await ok(admin,'/api/auth/admin/login','POST',JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE || '.tools/admin-access.json','utf8')))
    await login(a,member('_a'));await login(b,member('_b'))
    const makeSku=(color,price)=>({skuName:label+'_'+color,skuTitle:label+'_'+color,price,images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:color}]})
    product={spuName:label,spuDescription:'Cart acceptance fixture',catalogId:900003,brandId:900001,weight:'0.1',images:['/demo-product.svg'],decript:[],baseAttrs:[],skus:[makeSku('Red','12.34'),makeSku('Blue','20.00')]}
    productId=(await ok(admin,'/api/admin/product/spuinfo/editor','POST',product)).id
    product=(await ok(admin,`/api/admin/product/spuinfo/editor/${productId}`)).product;[sku1,sku2]=product.skus.map(i=>i.skuId)
    sql(`INSERT INTO gulimall_wms_test.wms_ware_sku(sku_id,ware_id,stock,stock_locked) VALUES(${sku1},900001,5,0);`)
    await ok(admin,`/api/admin/product/search-sync/${productId}/publish?status=1`,'POST')
    await t.test('member identity, direct service access, CSRF and cross-tab owner guards protect carts',async()=>{
      assert.equal((await guest.call('/api/cart?memberId='+members[0].id)).status,401)
      assert.equal((await admin.call('/api/cart')).status,403)
      assert.equal((await guest.call('http://127.0.0.1:18000/cart','GET',undefined,{'X-Member-Id':String(members[0].id)})).status,401)
      const missing=new Client();missing.cookie=a.cookie;assert.equal((await missing.call('/api/cart/items','POST',{skuId:sku1,count:1})).status,403)
      assert.equal((await a.call('/api/cart','GET',undefined,{'X-Cart-Owner':String(members[1].id)})).status,409)
      assert.equal((await guest.call('http://127.0.0.1:10001/internal/product/cart-items','POST',[sku1])).status,403)
    })
    await t.test('CRUD uses trusted fresh fields, selected totals and isolated member keys',async()=>{
      await add(a,2,{price:0,skuName:'FORGED',memberId:members[1].id})
      assert.equal((await line()).price,12.34);assert.notEqual((await line()).skuName,'FORGED');assert.equal((await view(b)).items.length,0)
      assert.equal((await ok(a,'/api/cart?memberId='+members[1].id)).cart.items[0].count,2)
      await count(5);await check(sku1,false);assert.equal((await a.call('/api/cart/selected')).status,409)
      await check(sku1,true);assert.equal((await ok(a,'/api/cart/selected')).cart.totalAmount,61.7)
      for(const n of [0,-1,1.5,1000])assert.equal((await a.call('/api/cart/items/count','PUT',{skuId:sku1,count:n})).status,400)
      await add(b,3);await ok(a,`/api/cart/items/${sku1}`,'DELETE');assert.equal((await view()).items.length,0);assert.equal((await line(b)).count,3)
      assert.ok(!redis(['HGET',`gulimall:cart:{${members[1].id}}:items`,String(sku1)]).includes('price'))
    })
    await t.test('concurrent additions do not lose updates or exceed the quantity limit',async()=>{
      await clear(a);const results=await Promise.all(Array.from({length:20},()=>a.call('/api/cart/items','POST',{skuId:sku1,count:1})))
      assert.ok(results.every(r=>r.status===200));assert.equal((await line()).count,20)
      await count(990);const capped=await Promise.all(Array.from({length:20},()=>a.call('/api/cart/items','POST',{skuId:sku1,count:1})))
      assert.equal(capped.filter(r=>r.status===200).length,9);assert.equal((await line()).count,999)
    })
    await t.test('concurrent merge retries apply once, reject changed payloads and survive explicit cart clearing',async()=>{
      await clear(a);const body={mergeId:randomUUID(),items:[{skuId:sku1,count:2,checked:false},{skuId:sku1,count:3,checked:true},{skuId:sku2,count:1,checked:false}]}
      const results=await Promise.all(Array.from({length:10},()=>merge(body)));assert.ok(results.every(r=>r.status===200));assert.equal(results.filter(r=>r.data.replayed).length,9)
      assert.equal((await line()).count,5);assert.equal((await line()).checked,true)
      assert.equal((await merge({...body,items:[{skuId:sku1,count:1}]})).status,409)
      await clear(a);assert.equal((await merge(body)).data.replayed,true);assert.equal((await view()).items.length,0)
    })
    await t.test('merge overflow is all-or-nothing and SKU capacity is enforced before writing',async()=>{
      await add(a,998);const body={mergeId:randomUUID(),items:[{skuId:sku1,count:2},{skuId:sku2,count:1,checked:false}]}
      assert.equal((await merge(body)).status,409);assert.equal((await view()).items.length,1);assert.equal((await line()).count,998)
      await count(997);assert.equal((await merge(body)).status,200);assert.equal((await line()).count,999)
      await clear(a)
      const filled={mergeId:randomUUID(),items:Array.from({length:100},(_,i)=>({skuId:8000000000+i,count:1,checked:false}))}
      assert.equal((await merge(filled)).status,200)
      assert.equal((await merge({mergeId:randomUUID(),items:[{skuId:sku1,count:1}]})).status,409)
      assert.equal((await view()).items.length,100);await clear(a)
    })
    await t.test('prices refresh; off-shelf, missing, exhausted and unknown-stock items stay visible but cannot check out',async()=>{
      await add(a,2)
      await ok(admin,'/api/admin/product/skuinfo/update','POST',{skuId:sku1,price:'13.50'})
      assert.equal((await line()).price,13.5);assert.equal((await view()).totalAmount,27)
      await ok(admin,`/api/admin/product/search-sync/${productId}/publish?status=0`,'POST')
      assert.equal((await line()).status,'OFF_SHELF');assert.equal((await a.call('/api/cart/selected')).status,409)
      assert.equal((await a.call('/api/cart/items','POST',{skuId:sku1,count:1})).status,409);assert.equal((await line()).count,2)
      await ok(admin,`/api/admin/product/search-sync/${productId}/publish?status=1`,'POST')
      assert.equal((await merge({mergeId:randomUUID(),items:[{skuId:sku2,count:1,checked:false},{skuId:8000000999,count:1,checked:false}]})).status,200)
      const items=(await view()).items;assert.equal(items.find(i=>i.skuId===sku2).status,'OUT_OF_STOCK');assert.equal(items.find(i=>i.skuId===8000000999).status,'DELETED')
      await check(sku2,true);assert.equal((await a.call('/api/cart/selected')).status,409);await check(sku2,false)
      assert.equal((await ok(a,'/api/cart/selected')).cart.items.length,1)
    })
    await t.test('product outages keep saved lines, cart and Redis restarts preserve quantities and merge receipts',{skip:process.env.GULIMALL_FAULTS!=='1'},async()=>{
      service('Stop','ware');assert.equal((await line()).status,'STOCK_UNKNOWN');assert.equal((await a.call('/api/cart/selected')).status,503)
      service('Start','ware');await until(async()=>(await line()).status==='AVAILABLE','Warehouse service did not recover')
      service('Stop','product')
      const unavailable=await view();assert.equal(unavailable.items.length,3);assert.ok(unavailable.items.every(i=>i.status==='SERVICE_UNAVAILABLE'));assert.equal(unavailable.totalAmount,null)
      assert.equal((await a.call('/api/cart/selected')).status,503)
      assert.equal((await a.call('/api/cart/items','POST',{skuId:sku1,count:1})).status,503)
      const body={mergeId:randomUUID(),items:[{skuId:sku1,count:1,checked:true}]};assert.equal((await merge(body)).status,200)
      let recovered
      service('Start','product');await until(async()=>{recovered=await line();return recovered.status==='AVAILABLE'},'Product service did not recover')
      assert.equal(recovered.count,3);assert.equal(recovered.price,13.5)
      service('Stop','cart')
      // Cached instances fail to connect with 500 until discovery removal produces 503.
      const offline=await guest.call('/api/cart');assert.ok([500,503].includes(offline.status));assert.equal(offline.data.cart,undefined)
      service('Start','cart')
      await until(async()=>(await line()).count===3,'Cart state lost after service restart')
      command('docker',['compose','restart','redis']);await until(async()=>(await line()).count===3,'Cart/session lost after Redis restart')
      assert.equal((await merge(body)).data.replayed,true);assert.equal((await line()).count,3)
      assert.equal(redis(['TTL',`gulimall:cart:{${members[0].id}}:merges`]),'-1')
    })
  } finally {
    for(const module of stopped)service('Start',module)
    if(productId){
      await until(async()=>(await admin.call(`/api/admin/product/search-sync/${productId}/publish?status=0`,'POST')).status===200,'Could not remove indexed fixture')
      if(sku1&&sku2)sql(`DELETE FROM gulimall_wms_test.wms_ware_sku WHERE sku_id IN(${sku1},${sku2});DELETE FROM gulimall_pms_test.pms_sku_images WHERE sku_id IN(${sku1},${sku2});DELETE FROM gulimall_pms_test.pms_sku_sale_attr_value WHERE sku_id IN(${sku1},${sku2});DELETE FROM gulimall_pms_test.pms_sku_info WHERE spu_id=${productId};`)
      sql(`DELETE FROM gulimall_pms_test.pms_search_sync WHERE spu_id=${productId};DELETE FROM gulimall_pms_test.pms_product_attr_value WHERE spu_id=${productId};DELETE FROM gulimall_pms_test.pms_spu_images WHERE spu_id=${productId};DELETE FROM gulimall_pms_test.pms_spu_info_desc WHERE spu_id=${productId};DELETE FROM gulimall_pms_test.pms_spu_info WHERE id=${productId} AND spu_name='${label}';`)
    }
    for(const m of members){redis(['DEL',`gulimall:cart:{${m.id}}:items`,`gulimall:cart:{${m.id}}:merges`]);sql(`DELETE FROM gulimall_ums_test.ums_member WHERE id=${m.id} AND username='${m.username}';`)}
    for(const client of [a,b,admin])await client.call('/api/auth/logout','POST')
  }
})
