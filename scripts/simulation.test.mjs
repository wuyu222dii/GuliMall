import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawnSync} from 'node:child_process'
import {randomUUID,createPrivateKey,sign} from 'node:crypto'
import {readFileSync,existsSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {testConfig,createPaymentGateway} from './payment-test-gateway.mjs'

test('simulation gateway health is explicit and exposes no credentials',async()=>{
  const config=testConfig('.tools/simulation-unit-'+randomUUID()+'/keys.json')
  const gateway=await createPaymentGateway({config})
  try {const r=await fetch(gateway.url+'/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{mode:'LOCAL_TEST',ready:true,persistent:false})}finally{await gateway.close()}
})

test('simulation refuses unmanaged ports before stopping services or changing configuration',{skip:process.platform!=='win32'},async()=>{
  const root=resolve('.tools/simulation-preflight-'+randomUUID()),server=createServer()
  mkdirSync(root+'/scripts',{recursive:true});mkdirSync(root+'/gulimall-web/dist',{recursive:true});writeFileSync(root+'/gulimall-web/dist/index.html','fixture')
  for(const file of ['simulation.ps1','env.ps1'])copyFileSync('scripts/'+file,root+'/scripts/'+file)
  for(const name of ['product','member','coupon','ware','order','search','auth-server','third-party','cart','gateway']){mkdirSync(`${root}/gulimall-${name}/target`,{recursive:true});writeFileSync(`${root}/gulimall-${name}/target/gulimall-${name}-0.0.1-SNAPSHOT.jar`,'fixture')}
  const before='DB_HOST=127.0.0.1\n';writeFileSync(root+'/.env',before)
  let listening=false
  await new Promise((resolve,reject)=>{server.once('error',e=>e.code==='EADDRINUSE'?resolve():reject(e));server.listen(18170,'127.0.0.1',()=>{listening=true;resolve()})})
  try {
    const env={...process.env};delete env.PSModulePath
    const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',root+'/scripts/simulation.ps1','Start'],{env,encoding:'utf8',timeout:30000,windowsHide:true})
    assert.notEqual(result.status,0);assert.match(result.stderr,/Port \d+.*unmanaged process/);assert.doesNotMatch(result.stdout,/Stopped gulimall/);assert.equal(readFileSync(root+'/.env','utf8'),before)
  } finally {if(listening)await new Promise(resolve=>server.close(resolve))}
})

const folder=()=>'.tools/simulation-unit-'+randomUUID()
const until=async(check,message)=>{for(let i=0;i<80;i++){if(await check())return;await new Promise(r=>setTimeout(r,100))}assert.fail(message)}
async function issue(gateway,sn) {
  const params={app_id:gateway.config.appId,method:'alipay.trade.page.pay',sign_type:'RSA2',notify_url:gateway.config.notifyUrl,return_url:gateway.config.returnUrl+'?orderSn='+sn,biz_content:JSON.stringify({out_trade_no:sn,total_amount:'3.75',seller_id:gateway.config.sellerId,time_expire:'2099-01-01 00:00:00',subject:'unit'})}
  const data=Object.keys(params).sort().map(k=>k+'='+params[k]).join('&')
  params.sign=sign('RSA-SHA256',Buffer.from(data),createPrivateKey({key:Buffer.from(gateway.config.merchantPrivate,'base64'),format:'der',type:'pkcs8'})).toString('base64')
  return fetch(gateway.url+'/gateway.do',{method:'POST',body:new URLSearchParams(params)})
}
const checkout=(gateway,sn,action)=>fetch(`${gateway.url}/checkout/${sn}/${action}`,{method:'POST',body:new URLSearchParams({nonce:gateway.trades.get(sn).nonce}),redirect:'manual'})

test('persistent payment survives restart, retries notifications and preserves terminal states',async()=>{
  const directory=folder(),config=testConfig(directory+'/keys.json'),dataFile=directory+'/trades.json',sn='a'.repeat(32),failed='b'.repeat(32),closed='c'.repeat(32)
  let acknowledge=false,notices=0
  const receiver=createServer(async(req,res)=>{for await(const chunk of req){}notices++;res.writeHead(acknowledge?200:503);res.end(acknowledge?'success':'retry')})
  await new Promise(r=>receiver.listen(0,'127.0.0.1',r));config.notifyUrl='http://127.0.0.1:'+receiver.address().port+'/notify'
  let gateway=await createPaymentGateway({config,dataFile})
  try {
    assert.equal((await issue(gateway,sn)).status,200);assert.equal((await checkout(gateway,sn,'pay')).status,303)
    const paid={...gateway.trades.get(sn)};assert.equal(paid.state,'TRADE_SUCCESS');assert.equal(paid.notifyAcknowledged,false)
    assert.equal((await issue(gateway,failed)).status,200);assert.equal((await checkout(gateway,failed,'fail')).status,200);assert.equal(gateway.trades.get(failed).state,'WAIT_BUYER_PAY')
    await issue(gateway,closed);gateway.put(closed,{state:'TRADE_CLOSED'})
    await gateway.close();acknowledge=true;gateway=await createPaymentGateway({config,dataFile})
    await until(()=>gateway.trades.get(sn).notifyAcknowledged,'Unconfirmed notification did not retry on restart')
    assert.equal(gateway.trades.get(sn).tradeNo,paid.tradeNo);assert.equal(gateway.trades.get(sn).paidAt,paid.paidAt)
    assert.equal((await checkout(gateway,sn,'pay')).status,303);assert.equal(gateway.trades.get(sn).paidAt,paid.paidAt)
    assert.match(await(await issue(gateway,sn)).text(),/已完成模拟付款/)
    assert.equal((await issue(gateway,closed)).status,409);assert.equal((await checkout(gateway,closed,'pay')).status,409)
    acknowledge=false;gateway.put(failed,{state:'TRADE_SUCCESS',paidAt:paid.paidAt});const attempts=notices
    await until(()=>notices>attempts,'Five-second retry timer did not run');acknowledge=true
    await until(()=>gateway.trades.get(failed).notifyAcknowledged,'Notification acknowledgement did not persist')
    assert(JSON.parse(readFileSync(dataFile)).trades.find(t=>t.orderSn===failed).notifyAcknowledged)
  } finally {await gateway.close();receiver.closeAllConnections();await new Promise(r=>receiver.close(r))}
})

test('corrupt ledgers, mismatched keys and write failures never become empty successful payments',async()=>{
  const directory=folder(),config=testConfig(directory+'/keys.json'),dataFile=directory+'/trades.json'
  let gateway=await createPaymentGateway({config,dataFile});await issue(gateway,'d'.repeat(32));await gateway.close()
  const before=readFileSync(dataFile),other=testConfig(folder()+'/keys.json')
  await assert.rejects(createPaymentGateway({config:other,dataFile}),/keys do not match/);assert.deepEqual(readFileSync(dataFile),before)
  writeFileSync(dataFile,'broken');await assert.rejects(createPaymentGateway({config,dataFile}));assert.equal(readFileSync(dataFile,'utf8'),'broken')
  const impossible=directory+'/directory-ledger';mkdirSync(impossible)
  gateway=await createPaymentGateway({config,dataFile:impossible+'/file.json'});mkdirSync(impossible+'/file.json')
  try {assert.equal((await issue(gateway,'e'.repeat(32))).status,503);assert.equal(gateway.trades.size,0);assert.equal((await fetch(gateway.url+'/health')).status,503)}finally{await gateway.close()}
})
