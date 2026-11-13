import {assertTestEnvironment} from './test-environment.mjs'
import {createCatalogFixture} from './catalog-fixture.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
assert.equal(process.env.GULIMALL_ACCEPTANCE,'1');await assertTestEnvironment()
class Client {
  cookie = ''; csrf = ''
  async call(path, method = 'GET', body, headers = {}) {
    const response = await fetch(path.startsWith('http:') ? path : 'http://127.0.0.1:88' + path, { method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000) })
    const cookie = response.headers.getSetCookie().find(v => v.startsWith('GULIMALLSESSION=')); if (cookie) this.cookie = cookie.split(';')[0]
    const data = await response.json(); if (data.csrfToken) this.csrf = data.csrfToken; return { status: response.status, data }
  }
}

const root='/api/admin/product/admin/catalog',admin=new Client(),guest=new Client(),member=new Client(),checks=[]
async function ok(path,method='GET',body){const value=await admin.call(root+path,method,body);assert.equal(value.status,200,value.data.msg);assert.equal(value.data.code,0);return value.data}
async function scene(t,name,run){await t.test(name,async()=>{await run();checks.push(name)})}
let fixture
test('bounded catalog reads, stable positioning and compatibility',async t=>{
 try {
  fixture=await createCatalogFixture(400)
  await admin.call('/api/auth/csrf');assert.equal((await admin.call('/api/auth/admin/login','POST',JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))).status,200)
  const query=extra=>new URLSearchParams({key:fixture.label,...extra}).toString(),keys={brands:'brandId',groups:'attrGroupId',attrs:'attrId'}
  await scene(t,'three lists share server-side counts and stable numbered pages',async()=>{
   for(const kind of ['brands','groups','attrs']){
    const first=(await ok('/'+kind+'/page?'+query())).page,second=(await ok('/'+kind+'/page?'+query({page:2}))).page
    assert.equal(first.totalCount,400);assert.equal(first.pageSize,20);assert.equal(first.list.length,20);assert.equal(first.totalPage,20)
    assert.equal(first.list[0][keys[kind]],fixture.start);assert.equal(second.list[0][keys[kind]],fixture.start+20)
    const filtered=(await ok('/'+kind+'/page?'+query(kind==='groups'?{catalogId:900003}:{status:0,...(kind==='attrs'?{catalogId:900003,type:0}:{})}))).page
    assert.equal(filtered.totalCount,kind==='groups'?400:200)
    assert.equal((await ok('/'+kind+'/page?'+query({limit:100}))).page.list.length,100)
   }
  })
  await scene(t,'single details, exact IDs and literal wildcard characters do not need full metadata',async()=>{
   const id=fixture.start+39,name=fixture.label+'_%!'
   await ok('/brands','POST',{brandId:id,name,firstLetter:'C',sort:0,showStatus:1})
   const literal=(await ok('/brands/page?key='+encodeURIComponent(name))).page;assert.equal(literal.totalCount,1);assert.equal(literal.list[0].brandId,id)
   assert.equal((await ok('/brands/page?key='+id)).page.list[0].name,name)
   assert.equal((await ok('/brands/'+id)).data.name,name)
   await ok('/attrs','POST',{attrId:id,attrName:fixture.rows[39].name,catelogId:900003,attrType:1,enable:1,attrGroupId:fixture.start})
   assert.equal((await ok('/attrs/'+id)).data.attrGroupId,fixture.start)
   assert.equal((await admin.call(root+'/attrs/1')).status,404)
  })
  await scene(t,'position uses the same filters and only clears them when the saved row is excluded',async()=>{
   const id=fixture.start+39
   let position=(await ok('/brands/'+id+'/position?'+query({status:1}))).data
   assert.deepEqual(position,{found:true,inFilter:true,page:1})
   position=(await ok('/brands/'+id+'/position?'+query({status:0}))).data
   const before=Number(fixture.sql('SELECT COUNT(*) FROM gulimall_pms_test.pms_brand WHERE brand_id<'+id+';'))
   assert.deepEqual(position,{found:true,inFilter:false,page:Math.floor(before/20)+1})
   assert.equal((await ok('/brands/1/position?'+query())).data.found,false)
   await ok('/brands/'+id,'DELETE');assert.equal((await ok('/brands/'+id+'/position?'+query())).data.found,false)
  })
  await scene(t,'query bounds, repeated or unsupported fields and permissions reject unsafe reads',async()=>{
   for(const suffix of ['page=0','page=1000001','limit=101','limit=','page=1&page=2','unknown=1','status=3','catalogId=1','type=1'])assert.equal((await admin.call(root+'/brands/page?'+suffix)).status,400,suffix)
   assert.equal((await guest.call(root+'/brands/page')).status,401)
   await member.call('/api/auth/csrf');assert.equal((await member.call('/api/auth/login','POST',{username:'demo_a',password:'Demo12345!'})).status,200)
   for(const path of ['/brands/page','/brands/900001','/brands/900001/position','/categories/tree'])assert.equal((await member.call(root+path)).status,403)
  })
  await scene(t,'reference deletion gates remain and category tree and legacy metadata stay compatible',async()=>{
   for(const kind of ['brands','groups','attrs'])assert.equal((await admin.call(root+'/'+kind+'/900001','DELETE')).status,409)
   const legacy=(await ok('')).data,tree=(await ok('/categories/tree')).data
   assert.deepEqual(tree,legacy.categories);for(const key of ['brands','groups','attrs','relations'])assert(Array.isArray(legacy[key]))
  })
  await scene(t,'large-sample list transfer is bounded and measured without claiming capacity',async()=>{
   const samples=[]
   for(const kind of ['brands','groups','attrs']){
    const measurements=[]
    for(let i=0;i<3;i++){const start=performance.now(),body=await ok('/'+kind+'/page?'+query());measurements.push({bytes:Buffer.byteLength(JSON.stringify(body)),milliseconds:Math.round((performance.now()-start)*10)/10});assert.equal(body.page.list.length,20);assert(!('data'in body));assert(measurements.at(-1).bytes<20000)}
    samples.push({kind,measurements})
   }
   writeFileSync('.tools/test/catalog-measurement.json',JSON.stringify({fixtureRowsPerKind:400,samples},null,2)+'\n')
  })
  assert.equal(checks.length,6);writeFileSync('.tools/test/catalog-result.json',JSON.stringify({passed:true,checks},null,2)+'\n')
 } finally {
  if(fixture){fixture.sql(`DELETE FROM gulimall_pms_test.pms_attr_attrgroup_relation WHERE attr_id BETWEEN ${fixture.start} AND ${fixture.start+fixture.count-1};`);fixture.remove()}
 }
})
