import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs'
import {join,resolve,relative,sep} from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {assertRestoreEnvironment,restoreSql,docker} from './demo-restore-guard.mjs'
import {moneyCents} from './backup-audit.mjs'
const ctx=assertRestoreEnvironment(process.env.GULIMALL_DEMO_RESTORE_CONTEXT,{allowStoppedBroker:process.argv[2]==='checkpoint'}),sql=q=>restoreSql(ctx,q),file=name=>join(ctx.source,'.tools',name),read=path=>JSON.parse(readFileSync(path,'utf8')),save=(name,value)=>writeFileSync(file(name),JSON.stringify(value,null,2)+'\n')
const ledger=()=>read(join(ctx.source,'.data/simulation/payment/trades.json'))
const until=async(fn)=>{for(let n=0;n<90;n++){if(await fn())return;await new Promise(r=>setTimeout(r,1000))}throw new Error('Restored business result did not confirm')}
const orders=()=>JSON.parse(sql("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',id,'sn',order_sn,'status',status,'inventory',inventory_status,'amount',CAST(pay_amount AS CHAR),'snapshot',SHA2(CONCAT_WS('|',member_username,receiver_name,receiver_phone,receiver_post_code,receiver_province,receiver_city,receiver_region,receiver_detail_address),256))),JSON_ARRAY()) FROM gulimall_oms_demo.oms_order;"))
const stocks=()=>JSON.parse(sql("SELECT JSON_ARRAYAGG(JSON_OBJECT('id',id,'sku',sku_id,'ware',ware_id,'stock',stock,'locked',stock_locked)) FROM gulimall_wms_demo.wms_ware_sku;"))
const details=()=>JSON.parse(sql("SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',id,'sku',sku_id,'ware',ware_id,'count',sku_num,'state',lock_status)),JSON_ARRAY()) FROM gulimall_wms_demo.wms_ware_order_task_detail;"))
function capture(){
 assert.equal(sql('SELECT @@global.event_scheduler;'),'OFF')
 assert.equal(sql('SELECT COUNT(*) FROM gulimall_wms_demo.wms_ware_sku WHERE stock<0 OR stock_locked<0 OR stock_locked>stock;'),'0')
 assert.equal(sql('SELECT COUNT(*) FROM gulimall_oms_demo.oms_order o JOIN (SELECT order_id,SUM(real_amount) amount FROM gulimall_oms_demo.oms_order_item GROUP BY order_id) i ON i.order_id=o.id WHERE i.amount+COALESCE(o.freight_amount,0)<>o.pay_amount;'),'0')
 const result={orders:orders(),stocks:stocks(),details:details(),trades:ledger().trades.map(t=>({sn:t.orderSn,state:t.state,amount:t.amount,tradeNo:t.tradeNo,paidAt:t.paidAt})),fingerprint:ledger().publicKeyFingerprint,tables:Number(sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('gulimall_pms_demo','gulimall_sms_demo','gulimall_ums_demo','gulimall_oms_demo','gulimall_wms_demo');"))}
 for(const trade of result.trades){const order=result.orders.find(o=>o.sn===trade.sn);assert(order,'Restored ledger has no matching order');assert.equal(moneyCents(order.amount),moneyCents(trade.amount))}
 return result
}
function originalIntact(){
 const original=read(file('original-state.json')),current=capture()
 for(const order of original.orders){const found=current.orders.find(o=>o.sn===order.sn);assert(found);assert.equal(found.snapshot,order.snapshot,'Original text/address snapshot changed');assert.equal(moneyCents(found.amount),moneyCents(order.amount));if([3,4].includes(order.status)&&[1,2].includes(order.inventory)){assert.equal(found.status,order.status);assert.equal(found.inventory,order.inventory)}}
 for(const stock of original.stocks){const expected={...stock};for(const detail of original.details.filter(d=>d.sku===stock.sku&&d.ware===stock.ware)){const next=current.details.find(d=>d.id===detail.id);assert(next,'Original stock detail disappeared');if(detail.state===1&&[2,3].includes(next.state)){expected.locked-=detail.count;if(next.state===3)expected.stock-=detail.count}else assert.equal(next.state,detail.state)}assert.deepEqual(current.stocks.find(s=>s.id===stock.id),expected,'Original inventory differs from its legitimate work-order transitions')}
 assert.equal(current.fingerprint,original.fingerprint);assert.equal(current.tables,original.tables)
 for(const trade of original.trades){const found=current.trades.find(t=>t.sn===trade.sn);assert(found);assert.equal(found.tradeNo,trade.tradeNo);if(['TRADE_SUCCESS','TRADE_FINISHED','TRADE_CLOSED'].includes(trade.state))assert.deepEqual(found,trade)}
 return {orders:original.orders.length,inventoryRows:original.stocks.length,trades:original.trades.length,tables:original.tables}
}
class Client{
 cookie='';csrf=''
 async call(path,method='GET',body){const response=await fetch('http://127.0.0.1:8080'+path,{method,headers:{Cookie:this.cookie,'X-CSRF-Token':this.csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];assert.equal(response.status,200,'Restored API failed: '+path);const result=await response.json();assert.equal(result.code,0,'Restored business API failed: '+path);if(result.csrfToken)this.csrf=result.csrfToken;return result}
}
const action=process.argv[2]
if(action==='snapshot'){
 const queues=docker(['exec',ctx.project+'-rabbitmq-1','rabbitmqctl','list_queues','--silent','name']).split('\n').filter(line=>line&&line!=='name');assert.equal(queues.length,0,'Restoration requires a new empty broker')
 const snapshot=capture();save(ctx.phase===1?'original-state.json':'checkpoint-state.json',snapshot)
 if(ctx.phase===2){const f=read(file('restore-fixture.json'));assert.equal(sql(`SELECT status,inventory_status FROM gulimall_oms_demo.oms_order WHERE order_sn='${f.pending}';`),'4\t0');assert.equal(sql(`SELECT stock,stock_locked FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=${f.sku};`),'4\t1');assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_demo.oms_trade_event WHERE order_sn='${f.pending}' AND event_type='STOCK_RELEASE' AND consumed_at IS NULL;`),'1')}
 const keys=docker(['exec',ctx.project+'-redis-1','redis-cli','--raw','DBSIZE']);save('redis-snapshot.json',{readable:true,keys:Number(keys),ttlNotRewritten:true})
 console.log('PASS: restored SQL amounts, inventory bounds and ledger captured before business startup')
}else if(action==='rebuild'){
 const admin=new Client();await admin.call('/api/auth/csrf');await admin.call('/api/auth/admin/login','POST',read(file('restore-admin.json')));await admin.call('/api/admin/product/search-sync/rebuild','POST',{})
 const f=ctx.phase===2?read(file('restore-fixture.json')):{run:'Demo',sku:900001}
 await until(async()=>(await admin.call('/api/search?keyword='+f.run)).page.list.some(s=>s.skuId===f.sku));save('search-rebuild-'+ctx.phase+'.json',{completed:true,source:'product database',sampleSku:f.sku});console.log('PASS: empty ES rebuilt from restored product database; expected SKU searchable')
}else if(action==='fixture'){
 const admin=new Client();await admin.call('/api/auth/csrf');await admin.call('/api/auth/admin/login','POST',read(file('restore-admin.json')))
 const run='r20_'+randomUUID().replaceAll('-','').slice(0,10)
 const creationSnapshot={creationRequestId:randomUUID(),spuName:'恢复验收 '+run,spuDescription:'恢复副本真实交易',catalogId:900003,brandId:900001,weight:'0.2',images:['/demo-product.svg'],decript:['/demo-product.svg'],baseAttrs:[{attrId:900001,attrValues:'8GB',showDesc:1}],skus:[{skuName:run,skuTitle:run,price:'0.10',images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:'红色'}]}]}
 const productId=(await admin.call('/api/admin/product/spuinfo/editor','POST',creationSnapshot)).id
 const sku=(await admin.call('/api/admin/product/spuinfo/editor/'+productId)).product.skus[0].skuId
 const demand=(await admin.call('/api/admin/ware/purchasedetail/save','POST',{skuId:sku,wareId:900001,skuNum:5,skuPrice:'1.00'})).id,purchase=(await admin.call('/api/admin/ware/purchase/merge','POST',{items:[demand]})).purchaseId
 await admin.call('/api/admin/ware/purchase/received','POST',[purchase]);await admin.call('/api/admin/ware/purchase/done','POST',{id:purchase,items:[{itemId:demand,status:3}]});await admin.call(`/api/admin/product/search-sync/${productId}/publish?status=1`,'POST',{})
 await until(async()=>(await admin.call('/api/search?keyword='+run)).page.list.some(s=>s.skuId===sku))
 const urls=sql("SELECT sku_default_img FROM gulimall_pms_demo.pms_sku_info WHERE sku_default_img LIKE '/api/media/%' UNION SELECT img_url FROM gulimall_pms_demo.pms_sku_images WHERE img_url LIKE '/api/media/%' UNION SELECT img_url FROM gulimall_pms_demo.pms_spu_images WHERE img_url LIKE '/api/media/%';").split('\n').filter(Boolean)
 for(const url of urls){assert.match(url,/^\/api\/media\/[a-f0-9]{32}\.(jpg|png)$/);const response=await fetch('http://127.0.0.1:8080'+url);assert.equal(response.status,200);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),createHash('sha256').update(readFileSync(join(ctx.source,'.data/uploads',url.split('/').at(-1)))).digest('hex'))}
 save('restore-fixture.json',{run,productId,sku,creationSnapshot,original:originalIntact(),imagesVerified:urls.length});console.log('PASS: original transactions and images readable; independent product procured and searchable')
}else if(action==='checkpoint'){
 const checkpoint=process.argv[3];assert(resolve(checkpoint).startsWith(resolve(ctx.source,'.data')+sep))
 const fixture=read(file('restore-fixture.json'));assert.match(fixture.pending,/^[a-f0-9]{32}$/)
 assert.equal(sql(`SELECT status,inventory_status FROM gulimall_oms_demo.oms_order WHERE order_sn='${fixture.pending}';`),'4\t0');assert.equal(sql(`SELECT task_status FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn='${fixture.pending}';`),'1')
 assert.equal(sql(`SELECT COUNT(*) FROM gulimall_oms_demo.oms_trade_event WHERE order_sn='${fixture.pending}' AND event_type='STOCK_RELEASE' AND consumed_at IS NULL;`),'1')
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(join(dir,d.name)):[join(dir,d.name)])
 const files=walk(checkpoint).map(path=>({path:relative(checkpoint,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))
 writeFileSync(join(checkpoint,'manifest.json'),JSON.stringify({format:1,environment:'Demo',schemas:['pms','sms','ums','oms','wms'].map(n=>'gulimall_'+n+'_demo'),files,simulationPayments:true,parentBackup:ctx.backup,scenario:'restored-copy-pending-release'},null,2)+'\n');console.log('PASS: closed order and unconsumed release event captured in a new cold checkpoint')
}else if(action==='compensation'){
 const fixture=read(file('restore-fixture.json'));assert(Number.isSafeInteger(fixture.sku));assert.match(fixture.pending,/^[a-f0-9]{32}$/);assert.match(fixture.completed,/^[a-f0-9]{32}$/)
 await until(()=>sql(`SELECT inventory_status FROM gulimall_oms_demo.oms_order WHERE order_sn='${fixture.pending}';`)==='2')
 const events=JSON.parse(sql(`SELECT JSON_ARRAYAGG(JSON_OBJECT('id',id,'consumed',CAST(consumed_at AS CHAR))) FROM gulimall_oms_demo.oms_trade_event WHERE (order_sn='${fixture.pending}' AND event_type='STOCK_RELEASE') OR (order_sn='${fixture.completed}' AND event_type='STOCK_DEDUCT');`));assert.equal(events.length,2);assert(events.every(e=>e.consumed))
 const rabbit=async(path,body)=>{const response=await fetch('http://127.0.0.1:15673/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(process.env.RABBITMQ_USER+':'+process.env.RABBITMQ_PASSWORD).toString('base64'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert.equal(response.status,200,'Isolated broker assertion failed');return response.json()}
 const admin=new Client();await admin.call('/api/auth/csrf');await admin.call('/api/auth/admin/login','POST',read(file('restore-admin.json')))
 assert(fixture.creationSnapshot);const replay=(await admin.call('/api/admin/product/spuinfo/editor','POST',fixture.creationSnapshot)).id;assert.equal(replay,fixture.productId)
 assert.equal((await admin.call('/api/admin/product/spuinfo/creation/'+fixture.creationSnapshot.creationRequestId)).id,fixture.productId)
 assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_demo.pms_spu_info WHERE creation_request_id='${fixture.creationSnapshot.creationRequestId}';`),'1')
 assert.equal(sql(`SELECT COUNT(*) FROM gulimall_pms_demo.pms_sku_info WHERE spu_id=${fixture.productId};`),'1')
 save('creation-result.json',{survivedColdRestore:true,replayId:replay,originalId:fixture.productId,singleProductAndSku:true})
 const before=(await rabbit('queues/%2F/gulimall.trade.stock')).message_stats?.ack||0
 for(const event of events)for(let i=0;i<2;i++)assert((await rabbit('exchanges/%2F/gulimall.trade/publish',{properties:{content_type:'application/json',delivery_mode:2},routing_key:'stock',payload:JSON.stringify({eventId:event.id}),payload_encoding:'string'})).routed)
 await until(async()=>((await rabbit('queues/%2F/gulimall.trade.stock')).message_stats?.ack||0)>=before+4)
 assert.equal(sql(`SELECT stock,stock_locked FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=${fixture.sku};`),'4\t0')
 for(const event of events)assert.equal(sql(`SELECT CAST(consumed_at AS CHAR) FROM gulimall_oms_demo.oms_trade_event WHERE id=${event.id};`),event.consumed)
 assert.equal(sql(`SELECT task_status FROM gulimall_wms_demo.wms_ware_order_task WHERE order_sn='${fixture.pending}';`),'2')
 save('compensation-result.json',{coldCheckpointRecovered:true,emptyBroker:true,releaseConfirmed:true,duplicateMessagesAcknowledged:4,stock:'4/0',original:originalIntact()});console.log('PASS: cold pending release recovered from SQL; duplicate deduction/release messages ACKed without changing stock twice')
}else if(action==='final'){
 const fixture=read(file('restore-fixture.json'));assert.match(fixture.afterRecovery,/^[a-f0-9]{32}$/)
 assert.equal(sql(`SELECT stock,stock_locked FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=${fixture.sku};`),'3\t0')
 for(const sn of [fixture.completed,fixture.afterRecovery])assert.equal(sql(`SELECT status,inventory_status,pay_amount FROM gulimall_oms_demo.oms_order WHERE order_sn='${sn}';`),'3\t1\t0.10')
 save('restore-result.json',{original:originalIntact(),newCompleted:[fixture.completed,fixture.afterRecovery],compensated:fixture.pending,compensation:read(file('compensation-result.json')),productCreation:read(file('creation-result.json')),stock:'3/0',realServices:false});console.log('PASS: original restored state retained and another genuine mock trade completed after cold recovery')
}else throw new Error('Unknown restore verification phase')
