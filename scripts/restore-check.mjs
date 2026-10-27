import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assertTestEnvironment} from './test-environment.mjs'
const source=JSON.parse(readFileSync('.tools/test/demo-success.json','utf8')),failure=JSON.parse(readFileSync('.tools/test/demo-failure.json','utf8')),session=JSON.parse(readFileSync('.tools/test/backup-session.json','utf8'))
const container=process.env.GULIMALL_RESTORE_MYSQL
assert.match(container||'',/^gulimall-restore-[a-f0-9]{32}-mysql$/)
async function until(check,message,seconds=90){for(let i=0;i<seconds;i++){try{if(await check())return}catch{}await new Promise(r=>setTimeout(r,1000))}assert.fail(message)}
async function call(path,method='GET',body){const r=await fetch('http://127.0.0.1:88'+path,{method,headers:{Cookie:session.cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);return r.json()}
function sql(input){const r=spawnSync('docker',['exec','-i',container,'sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names'],{input,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
await until(async()=>{await assertTestEnvironment();return(await call('/api/auth/me')).user.admin},'Restored test services or saved Redis Session not ready')
assert(Number.isSafeInteger(source.orderId));assert(Number.isSafeInteger(failure.orderId))
sql(`UPDATE gulimall_oms_test.oms_order SET note='restore-proof' WHERE id=${source.orderId};`)
const completed=await call('/api/admin/order/order/info/'+source.orderId)
assert.equal(completed.order.note,'restore-proof','HTTP service did not connect to the restored instance');assert.equal(completed.order.status,3);assert.equal(Number(completed.order.payAmount),3.75)
for(const story of [source,failure]) {
 assert(story.creationSnapshot,'Current recovery fixtures require a stable product request')
 assert.equal((await call('/api/admin/product/spuinfo/creation/'+story.creationSnapshot.creationRequestId)).id,story.productId)
 assert.equal((await call('/api/admin/product/spuinfo/editor','POST',story.creationSnapshot)).id,story.productId)
 assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_spu_info WHERE creation_request_id='${story.creationSnapshot.creationRequestId}';`),'1')
 assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_sku_info WHERE spu_id=${story.productId};`),'2')
}
let simulationPayments=false
if(process.env.PAYMENT_TEST_DATA) {
  const config=JSON.parse(readFileSync(process.env.PAYMENT_TEST_CONFIG,'utf8'))
  const health=await(await fetch('http://127.0.0.1:18170/health')).json();assert(health.ready&&health.persistent)
  const response=await fetch('http://127.0.0.1:18170/control',{method:'POST',headers:{Authorization:'Bearer '+config.controlToken,'Content-Type':'application/json'},body:JSON.stringify({action:'list'})});assert.equal(response.status,200)
  const trades=(await response.json()).trades
  assert.equal(trades.find(t=>t.orderSn===source.orderSn).state,'TRADE_SUCCESS');assert.equal(trades.find(t=>t.orderSn===failure.orderSn).state,'TRADE_CLOSED')
  simulationPayments=true
}
await until(async()=>{const d=await call('/api/admin/order/order/info/'+failure.orderId);return d.order.status===4&&d.order.inventoryStatus===2},'Restored unconsumed event did not release inventory through a fresh RabbitMQ vhost')
assert.equal(sql(`SELECT task_status FROM gulimall_wms_test.wms_ware_order_task WHERE order_sn='${failure.orderSn}';`),'2')
assert.equal(sql(`SELECT stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${failure.skus[0]};`),'0')
for(const story of [source,failure]){const image=await fetch('http://127.0.0.1:88'+story.image);assert.equal(image.status,200);assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),story.imageSha256)}
assert.equal((await fetch('http://127.0.0.1:19200/gulimall-products-v1',{method:'DELETE'})).status,200)
const index=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/search-index.ps1'],{stdio:'ignore',windowsHide:true});assert.equal(index.status,0)
await call('/api/admin/product/search-sync/rebuild','POST',{})
const total=(await call('/api/admin/product/search-sync?limit=1')).page.totalCount
// Reuse the worker's 20 jobs / 15s tick, ES refresh time and 30s failed-job backoff budget.
const seconds=Math.max(90,Math.ceil(total/20)*(15+20)+30)
console.log(`Restored search: ${total} persisted tasks, ${seconds}s verification budget`)
await until(async()=>(await call('/api/search?keyword='+source.label)).page.list.length===2,'Search did not rebuild from restored product database',seconds)
writeFileSync('.tools/test/restore-result.json',JSON.stringify({freshInstances:true,savedSession:true,uploadedImages:true,completedOrder:source.orderSn,releaseRecovered:failure.orderSn,searchRebuilt:true,simulationPayments,productCreationRecovered:true,realAlipaySandbox:false},null,2)+'\n')
console.log('PASS: restored order snapshots, Redis Session, image hashes, fresh-vhost release recovery and Elasticsearch rebuild.')
