import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {randomUUID,randomInt} from 'node:crypto'
import {resolve} from 'node:path'

assert.equal(process.env.GULIMALL_SIMULATION,'1','Explicit GULIMALL_SIMULATION=1 is required for named local demonstration records')
assert.notEqual(process.env.GULIMALL_TEST,'1','Use the standing simulation, not the isolated acceptance environment')
const running=JSON.parse(readFileSync('.tools/simulation/state.json','utf8'));assert(running.active&&running.workspace.toLowerCase()===resolve('.').toLowerCase(),'Start this workspace simulation first')
const health=await(await fetch('http://127.0.0.1:18170/health')).json();assert.equal(health.mode,'LOCAL_TEST');assert(health.ready&&health.persistent)
const path='.tools/simulation/acceptance.json',action=process.argv[2]
class Client {
  cookie='';csrf=''
  async call(url,method='GET',body) {
    const form=body instanceof FormData,r=await fetch('http://127.0.0.1:8080'+url,{method,headers:{Cookie:this.cookie,'X-CSRF-Token':this.csrf,...(body===undefined||form?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:form?body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
    const cookie=r.headers.getSetCookie().find(c=>c.startsWith('GULIMALLSESSION='));if(cookie)this.cookie=cookie.split(';')[0]
    const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.equal(data.code,0,data.msg);if(data.csrfToken)this.csrf=data.csrfToken;return data
  }
}
const member=new Client(),admin=new Client()
async function issue(order) {
  const payment=(await member.call(`/api/order/mine/${order.orderSn}/payment`,'POST',{})).payment;assert.equal(payment.mode,'LOCAL_TEST')
  const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>')
  const action=decode(payment.html.match(/<form[^>]+action="([^"]+)"/i)[1]),fields={}
  assert.equal(new URL(action).origin,'http://127.0.0.1:18170')
  for(const tag of payment.html.match(/<input[^>]+>/gi)||[]){const name=tag.match(/name="([^"]+)"/),value=tag.match(/value="([^"]*)"/);if(name)fields[name[1]]=decode(value?.[1]||'')}
  const r=await fetch(action,{method:'POST',body:new URLSearchParams(fields)});assert.equal(r.status,200)
}
if(action==='prepare') {
  assert(!existsSync(path),'Existing simulation acceptance records are retained; verify them before preparing another run')
  const label='sim13_'+randomUUID().replaceAll('-','').slice(0,12),password='Sim13_'+randomUUID().slice(0,10)+'!',phone='138'+String(randomInt(100000000)).padStart(8,'0')
  await admin.call('/api/auth/csrf');await admin.call('/api/auth/admin/login','POST',JSON.parse(readFileSync('.tools/admin-access.json','utf8')))
  const image=new FormData();image.append('file',new Blob([readFileSync('scripts/fixtures/upload.png')],{type:'image/png'}),'simulation.png')
  const uploaded=(await admin.call('/api/admin/thirdparty/images','POST',image)).url
  const productId=(await admin.call('/api/admin/product/spuinfo/editor','POST',{spuName:label,spuDescription:'常驻模拟验收商品',catalogId:900003,brandId:900001,weight:'0.2',images:[uploaded],decript:[uploaded],baseAttrs:[],skus:['红色','蓝色'].map((color,i)=>({skuName:label+' '+color,skuTitle:label+' '+color,price:i?'3.45':'0.10',images:[{imgUrl:uploaded,defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:color}]}))})).id
  const skus=(await admin.call(`/api/admin/product/spuinfo/editor/${productId}`)).product.skus.map(s=>s.skuId),items=[]
  for(const skuId of skus)items.push((await admin.call('/api/admin/ware/purchasedetail/save','POST',{skuId,wareId:900001,skuNum:20,skuPrice:'0.10'})).id)
  const purchaseId=(await admin.call('/api/admin/ware/purchase/merge','POST',{items})).purchaseId
  await admin.call('/api/admin/ware/purchase/received','POST',[purchaseId]);await admin.call('/api/admin/ware/purchase/done','POST',{id:purchaseId,items:items.map(itemId=>({itemId,status:3}))})
  await admin.call(`/api/admin/product/search-sync/${productId}/publish?status=1`,'POST')
  await member.call('/api/auth/csrf');const otp=await member.call('/api/auth/sms/code','POST',{phone});assert.equal(otp.mode,'development')
  const user=(await member.call('/api/auth/register','POST',{username:label,password,phone,code:otp.developmentCode})).user
  const addressId=(await member.call('/api/member/addresses','POST',{name:'本地模拟会员',phone,province:'浙江省',city:'杭州市',region:'西湖区',detailAddress:'模拟演示地址',defaultStatus:1})).id
  await member.call('/api/cart/items','POST',{skuId:skus[0],count:1})
  const confirmation=(await member.call('/api/order/mine/confirm','POST',{})).confirmation
  const natural=(await member.call('/api/order/mine/submit','POST',{token:confirmation.token,addressId})).result.order;assert.equal(natural.status,0);await issue(natural)
  writeFileSync(path,JSON.stringify({label,password,phone,memberId:user.id,addressId,productId,skus,purchaseId,image:uploaded,natural,preparedAt:new Date().toISOString()},null,2)+'\n')
  console.log(JSON.stringify({scenario:'natural 30-minute expiry',orderSn:natural.orderSn,deadline:natural.paymentDeadline,records:path,realServices:false}))
} else if(action==='verify') {
  const state=JSON.parse(readFileSync(path));await member.call('/api/auth/csrf');await member.call('/api/auth/login','POST',{username:state.label,password:state.password})
  const current=(await member.call(`/api/order/mine/${state.natural.orderSn}/payment-status`)).payment
  assert.equal(current.mode,'LOCAL_TEST');assert.equal(current.order.status,4,'Natural order has not closed; do not modify its deadline');assert.equal(current.order.inventoryStatus,2)
  assert.equal(current.order.paymentDeadline,state.natural.paymentDeadline);assert(Date.now()>=new Date(state.natural.paymentDeadline).getTime(),'The original thirty-minute deadline has not passed')
  const detail=await member.call(`/api/order/mine/${state.natural.id}`)
  assert(detail.history.some(h=>h.orderStatus===8&&new Date(h.createTime).getTime()>=new Date(state.natural.paymentDeadline).getTime()),'The order was cancelled before its natural deadline')
  const ledger=JSON.parse(readFileSync('.data/simulation/payment/trades.json'));assert.equal(ledger.trades.find(t=>t.orderSn===state.natural.orderSn).state,'TRADE_CLOSED')
  writeFileSync('.tools/simulation/natural-expiry.json',JSON.stringify({orderSn:state.natural.orderSn,preparedAt:state.preparedAt,verifiedAt:new Date().toISOString(),status:4,inventoryStatus:2,deadlineUnmodified:true,realServices:false},null,2)+'\n')
  console.log('PASS: natural 30-minute expiry confirmed by persistent gateway closure and exactly one inventory release.')
} else throw new Error('Use prepare or verify; retained records are private local demonstration data')
