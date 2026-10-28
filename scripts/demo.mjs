import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, openSync, closeSync, copyFileSync } from 'node:fs'
import { randomInt, randomUUID, createHash } from 'node:crypto'
import { assertTestEnvironment } from './test-environment.mjs'
import { testConfig, createPaymentGateway, providerTime } from './payment-test-gateway.mjs'
await assertTestEnvironment()
const mode=process.argv[2]
assert(['success','failure'].includes(mode),'Use scripts/test.ps1 -Suite Success or Failure')
const label='demo9_'+randomUUID().replaceAll('-','').slice(0,12), config=testConfig('.tools/test/demo-payment.json'), baseline={...process.env}
const dataFile='.data/test-simulation/payment/trades.json'
let gateway, rabbitStopped=false
function command(program,args,env=process.env,timeout=45000) {
  const childEnv={...env};if(program==='powershell.exe')delete childEnv.PSModulePath
  const log='.tools/test/operation-last.log',descriptor=openSync(log,'w')
  try {
    const r=spawnSync(program,args,{env:childEnv,stdio:['ignore',descriptor,descriptor],timeout,windowsHide:true})
    if(r.status!==0)copyFileSync(log,'.tools/test/operation-error.log')
    assert.equal(r.status,0,'Local demo operation failed; inspect .tools/test/operation-error.log')
  }finally{closeSync(descriptor)}
}
function service(action,module,local=true) {const env={...baseline};if(local&&gateway)Object.assign(env,{SPRING_PROFILES_ACTIVE:'dev,test,payment-test',ALIPAY_APP_ID:config.appId,ALIPAY_PRIVATE_KEY:config.merchantPrivate,ALIPAY_PUBLIC_KEY:config.providerPublic,ALIPAY_SELLER_ID:config.sellerId,ALIPAY_NOTIFY_URL:config.notifyUrl,ALIPAY_RETURN_URL:config.returnUrl,ALIPAY_GATEWAY_URL:gateway.url+'/gateway.do'});command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/services.ps1',action,'-Modules',module],env)}
function sql(input){const r=spawnSync('docker',['compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names'],{input,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
async function until(check,message){for(let i=0;i<80;i++){try{if(await check())return}catch{}await new Promise(r=>setTimeout(r,1000))}assert.fail(message)}
class Client {
  cookie='';csrf=''
  async call(path,method='GET',body){const form=body instanceof FormData;const r=await fetch('http://127.0.0.1:88'+path,{method,headers:{Cookie:this.cookie,'X-CSRF-Token':this.csrf,...(body===undefined||form?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:form?body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const c=r.headers.getSetCookie().find(v=>v.startsWith('GULIMALLSESSION='));if(c)this.cookie=c.split(';')[0];const data=await r.json();if(data.csrfToken)this.csrf=data.csrfToken;assert.equal(r.status,200,JSON.stringify(data));assert.equal(data.code,0,data.msg);return data}
}
const admin=new Client(),member=new Client()
try {
  gateway=await createPaymentGateway({config,dataFile});service('Stop','order');service('Start','order')
  await until(async()=>{await assertTestEnvironment();return(await fetch('http://127.0.0.1:88/api/order/mine')).status===401},'Payment test service or gateway not ready')
  await admin.call('/api/auth/csrf');await admin.call('/api/auth/admin/login','POST',JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
  const image=new FormData();image.append('file',new Blob([readFileSync('scripts/fixtures/upload.png')],{type:'image/png'}),'demo.png')
  const uploaded=(await admin.call('/api/admin/thirdparty/local/images','POST',image)).url
  const imageSha256=createHash('sha256').update(Buffer.from(await(await fetch('http://127.0.0.1:88'+uploaded)).arrayBuffer())).digest('hex')
  const creationSnapshot={creationRequestId:randomUUID(),spuName:label,spuDescription:'阶段九本地演示',catalogId:900003,brandId:900001,weight:'0.2',images:[uploaded],decript:[uploaded],baseAttrs:[{attrId:900001,attrValues:'8GB',showDesc:1}],skus:['红色','蓝色'].map((color,i)=>({skuName:label+' 手机 '+color,skuTitle:label+' 手机 '+color,price:i?'3.45':'0.10',images:[{imgUrl:uploaded,defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:color}]}))}
  const productId=(await admin.call('/api/admin/product/spuinfo/editor','POST',creationSnapshot)).id
  const skus=(await admin.call(`/api/admin/product/spuinfo/editor/${productId}`)).product.skus.map(s=>s.skuId)
  const demands=[],demandCreations=[]
  for(const [i,skuId] of skus.entries()){
    const request={creationRequestId:randomUUID(),skuId,wareId:900001,skuNum:i?2:5,skuPrice:'0.10'}
    const id=(await admin.call('/api/admin/ware/purchasedetail/save','POST',request)).id
    demands.push(id);demandCreations.push({id,request})
  }
  const deletedRequest={creationRequestId:randomUUID(),skuId:skus[0],wareId:900001,skuNum:1,skuPrice:'0.10'}
  const deletedId=(await admin.call('/api/admin/ware/purchasedetail/save','POST',deletedRequest)).id
  await admin.call('/api/admin/ware/purchasedetail/delete','POST',[deletedId])
  const deletedDemand={id:deletedId,request:deletedRequest}
  const purchaseId=(await admin.call('/api/admin/ware/purchase/merge','POST',{items:demands})).purchaseId
  await admin.call('/api/admin/ware/purchase/received','POST',[purchaseId]);await admin.call('/api/admin/ware/purchase/done','POST',{id:purchaseId,items:demands.map(itemId=>({itemId,status:3}))})
  await admin.call(`/api/admin/product/search-sync/${productId}/publish?status=1`,'POST')
  await until(async()=>(await admin.call('/api/search?keyword='+label)).page.list.length===2,'Published product not searchable')
  console.log('1. Admin uploaded an image, created two SKUs, completed procurement and published searchable products.')
  await member.call('/api/auth/csrf');const phone='138'+String(randomInt(100000000)).padStart(8,'0'),password='Demo9_'+randomUUID().slice(0,8)+'!'
  const otp=await member.call('/api/auth/sms/code','POST',{phone});assert.equal(otp.mode,'development')
  const user=(await member.call('/api/auth/register','POST',{username:label,phone,password,code:otp.developmentCode})).user
  await member.call('/api/auth/logout','POST');await member.call('/api/auth/csrf');await member.call('/api/auth/login','POST',{username:label,password})
  const addressId=(await member.call('/api/member/addresses','POST',{name:'本地演示会员',phone,province:'浙江省',city:'杭州市',region:'西湖区',detailAddress:'阶段九演示地址',defaultStatus:1})).id
  await member.call('/api/cart/items','POST',{skuId:skus[0],count:mode==='success'?3:1})
  if(mode==='success')await member.call('/api/cart/items','POST',{skuId:skus[1],count:1})
  const confirmation=(await member.call('/api/order/mine/confirm','POST',{})).confirmation
  const order=(await member.call('/api/order/mine/submit','POST',{token:confirmation.token,addressId})).result.order
  assert.equal(order.status,0);assert.equal(Number(order.payAmount),mode==='success'?3.75:0.10)
  console.log('2. Member registered with a development code, logged in, selected products and placed one durable order.')
  const payment=(await member.call(`/api/order/mine/${order.orderSn}/payment`,'POST',{})).payment
  const decode=value=>value.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>')
  const action=decode(payment.html.match(/<form[^>]+action="([^"]+)"/i)[1]),fields={}
  for(const tag of payment.html.match(/<input[^>]+>/gi)||[]){const name=tag.match(/name="([^"]+)"/),value=tag.match(/value="([^"]*)"/);if(name)fields[name[1]]=decode(value?.[1]||'')}
  const page=await fetch(action,{method:'POST',body:new URLSearchParams(fields)});assert.equal(page.status,200)
  if(mode==='success') {
    gateway.put(order.orderSn,{state:'TRADE_SUCCESS',paidAt:providerTime()});assert.equal((await gateway.notify(order.orderSn)).body,'success')
    await until(async()=>(await member.call(`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.fulfillmentReady,'Paid stock did not settle')
    await admin.call(`/api/admin/order/order/${order.id}/ship`,'POST',{deliveryCompany:'本地演示物流',deliverySn:'DEMO9-'+order.id})
    await member.call(`/api/order/mine/${order.id}/receive`,'POST',{})
    const detail=await member.call(`/api/order/mine/${order.id}`);assert.equal(detail.order.status,3);assert.equal(detail.order.inventoryStatus,1);assert.equal(detail.history.filter(h=>h.orderStatus===2).length,1);assert.equal(detail.history.filter(h=>h.orderStatus===3).length,1)
    console.log('3. LOCAL_TEST RSA2 payment settled; admin shipped; member confirmed receipt. No real funds used.')
  } else {
    gateway.options.down=true;assert.equal((await member.call(`/api/order/mine/${order.id}/cancel`,'POST',{})).order.status,8)
    assert.equal(sql(`SELECT task_status FROM gulimall_wms_test.wms_ware_order_task WHERE order_sn='${order.orderSn}';`),'1')
    console.log('3. Provider unavailable: cancellation intent persisted and stock remained locked.')
    command('docker',['compose','stop','rabbitmq']);rabbitStopped=true
    service('Stop','order');service('Start','order');await until(async()=>{await assertTestEnvironment();return(await fetch('http://127.0.0.1:88/api/order/mine')).status===401},'Order service or gateway restart failed')
    gateway.options.down=false;assert.equal((await member.call(`/api/order/mine/${order.id}/cancel`,'POST',{})).order.status,4)
    assert.equal(sql(`SELECT inventory_status FROM gulimall_oms_test.oms_order WHERE order_sn='${order.orderSn}';`),'0')
    writeFileSync('.tools/test/backup-session.json',JSON.stringify({cookie:admin.cookie,csrf:admin.csrf}))
    console.log('4. Taking a cold backup while the release event is durable but the broker is unavailable.')
    const port=Number(new URL(gateway.url).port);await gateway.close()
    command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/backup.ps1','-Environment','Test','-Destination','.data/backups/'+label],{...process.env,GULIMALL_SIMULATION_LEDGER:dataFile},180000)
    gateway=await createPaymentGateway({config,dataFile,port})
    command('docker',['compose','start','rabbitmq']);rabbitStopped=false
    await until(async()=>(await member.call(`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.inventoryStatus===2,'Stock release did not recover')
    assert.equal(sql(`SELECT stock FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${skus[0]};`),'5')
    console.log('5. After order restart and broker recovery, the durable release event completed once; stock restored to 5.')
  }
  const detail=await member.call(`/api/order/mine/${order.id}`)
  const report={creationSnapshot,demandCreations,deletedDemand,mode:'LOCAL_TEST',scenario:mode,label,productId,skus,purchaseId,memberId:user.id,orderId:order.id,orderSn:order.orderSn,status:detail.order.status,inventoryStatus:detail.order.inventoryStatus,amount:detail.order.payAmount,image:uploaded,imageSha256,backup:mode==='failure'?'.data/backups/'+label:null,history:detail.history.map(h=>h.orderStatus),realAlipaySandbox:false,publicCallback:false}
  writeFileSync(`.tools/test/demo-${mode}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report))
} finally {
  if(rabbitStopped)command('docker',['compose','start','rabbitmq'])
  service('Stop','order');if(gateway)await gateway.close();service('Start','order',false)
}
