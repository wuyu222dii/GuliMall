import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {randomUUID,randomInt} from 'node:crypto'
import {resolve} from 'node:path'
import {paymentTarget} from '../gulimall-web/src/utils/payment.js'
const owner=JSON.parse(readFileSync('.tools/handoff-owner.json','utf8'))
assert.match(owner.project,/^gulimall-handoff-[a-f0-9]{32}$/);assert.equal(owner.workspace,resolve('.'));assert.equal(process.env.COMPOSE_PROJECT_NAME,owner.project)
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Isolated Docker check failed');return r.stdout.trim()}
assert.equal(docker(['inspect','--format','{{ index .Config.Labels "com.docker.compose.project.working_dir" }}',owner.project+'-mysql-1']).replaceAll('\\','/'),resolve('.').replaceAll('\\','/'))
function sql(input){assert(/^SELECT /.test(input));return docker(['compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names'],input)}
assert.equal(sql("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('gulimall_pms_demo','gulimall_sms_demo','gulimall_ums_demo','gulimall_oms_demo','gulimall_wms_demo');"),'5')
const checkOrders=record=>{
 for(const [sn,status,inventory]of [[record.completed,3,1],[record.cancelled,4,2]]){assert.match(sn,/^[a-f0-9]{32}$/);assert.equal(sql(`SELECT status,inventory_status FROM gulimall_oms_demo.oms_order WHERE order_sn='${sn}'`),status+'\t'+inventory)}
 assert.equal(sql('SELECT stock,stock_locked FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=900001'),'9\t0')
 const ledger=JSON.parse(readFileSync('.data/simulation/payment/trades.json','utf8'))
 assert.equal(ledger.trades.find(t=>t.orderSn===record.completed)?.state,'TRADE_SUCCESS');assert.equal(ledger.trades.find(t=>t.orderSn===record.cancelled)?.state,'TRADE_CLOSED')
}
if(process.argv[2]==='verify'){
 checkOrders(JSON.parse(readFileSync('.tools/handoff-result.json','utf8')));console.log('PASS: original isolated orders, inventory and durable mock ledger survived full restart')
}else{
 assert.equal(sql('SELECT COUNT(*) FROM gulimall_oms_demo.oms_order'),'0','Only a fresh isolated database may create handoff fixtures')
 assert.equal(sql('SELECT stock,stock_locked FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=900001'),'10\t0')
 class Client{
  cookie='';csrf=''
  async call(path,method='GET',body){const r=await fetch('http://127.0.0.1:8080'+path,{method,headers:{Cookie:this.cookie,'X-CSRF-Token':this.csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const cookie=r.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];assert.equal(r.status,200,'API request failed: '+path);const data=await r.json();assert.equal(data.code,0,'API business request failed: '+path);if(data.csrfToken)this.csrf=data.csrfToken;return data}
 }
 const admin=new Client(),member=new Client(),label='handoff_'+randomUUID().slice(0,8),password=randomUUID()+'aA!'
 await admin.call('/api/auth/csrf');await admin.call('/api/auth/admin/login','POST',JSON.parse(readFileSync('.tools/handoff-access.json','utf8')))
 await admin.call('/api/admin/product/search-sync/rebuild','POST',{})
 const until=async(check)=>{for(let i=0;i<90;i++){if(await check())return;await new Promise(r=>setTimeout(r,1000))}assert.fail('Isolated business result not confirmed')}
 await until(async()=>{const response=await fetch('http://127.0.0.1:8080/api/search?keyword=Demo');if(response.status===503)return false;assert.equal(response.status,200);return(await response.json()).page.list.some(sku=>sku.skuId===900001)})
 await member.call('/api/auth/csrf');const phone='138'+String(randomInt(100000000)).padStart(8,'0'),otp=await member.call('/api/auth/sms/code','POST',{phone})
 assert.equal(otp.mode,'development');await member.call('/api/auth/register','POST',{username:label,password,phone,code:otp.developmentCode})
 const addressId=(await member.call('/api/member/addresses','POST',{name:'本机隔离验收',phone,province:'浙江省',city:'杭州市',region:'西湖区',detailAddress:'本地模拟地址',defaultStatus:1})).id
 const result={project:owner.project,mode:'LOCAL_TEST',completed:null,cancelled:null,independentMachine:false,secondOperator:false}
 for(const paid of [true,false]){
  await member.call('/api/cart/items','POST',{skuId:900001,count:1})
  const confirmation=(await member.call('/api/order/mine/confirm','POST',{})).confirmation
  const order=(await member.call('/api/order/mine/submit','POST',{token:confirmation.token,addressId})).result.order;assert.equal(Number(order.payAmount),1999)
  const payment=(await member.call(`/api/order/mine/${order.orderSn}/payment`,'POST',{})).payment
  const decode=v=>v.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>')
  const action=paymentTarget(decode(payment.html.match(/<form[^>]+action="([^"]+)"/i)[1]),'LOCAL_TEST'),fields={};assert(new URL(action).port==='18170','Unexpected local payment port')
  for(const tag of payment.html.match(/<input[^>]+>/gi)||[]){const name=tag.match(/name="([^"]+)"/),value=tag.match(/value="([^"]*)"/);if(name)fields[name[1]]=decode(value?.[1]||'')}
  const page=await fetch(action,{method:'POST',body:new URLSearchParams(fields)});assert.equal(page.status,200);const html=await page.text()
  if(paid){
   const nonce=html.match(/name="nonce" value="([^"]+)"/)[1]
   const response=await fetch(`http://127.0.0.1:18170/checkout/${order.orderSn}/pay`,{method:'POST',body:new URLSearchParams({nonce}),redirect:'manual'});assert.equal(response.status,303)
   await until(async()=>(await member.call(`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.fulfillmentReady)
   await admin.call(`/api/admin/order/order/${order.id}/ship`,'POST',{deliveryCompany:'本地模拟物流',deliverySn:'HANDOFF-'+order.id});await member.call(`/api/order/mine/${order.id}/receive`,'POST',{});result.completed=order.orderSn
  }else{
   await member.call(`/api/order/mine/${order.id}/cancel`,'POST',{});await until(async()=>(await member.call(`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.inventoryStatus===2);result.cancelled=order.orderSn
  }
 }
 checkOrders(result);writeFileSync('.tools/handoff-result.json',JSON.stringify(result,null,2)+'\n');console.log('PASS: fresh demo seed, registration, search, cart, SDK/RSA2 mock payment, shipping, receipt, cancellation and inventory')
}
