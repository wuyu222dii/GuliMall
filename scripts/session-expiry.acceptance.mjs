import assert from 'node:assert/strict'
import {randomInt,randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
import {assertTestEnvironment} from './test-environment.mjs'
import {createDemoServer} from './serve-demo.mjs'
import {chromium} from '../gulimall-web/node_modules/@playwright/test/index.mjs'

await assertTestEnvironment()
const runId=process.env.GULIMALL_SESSION_EXPIRY_RUN||randomUUID(),output='.tools/test/session-expiry',startedUtc=new Date().toISOString()
let cookie='',csrf='',server,browser
async function call(path,method='GET',body){
 const response=await fetch('http://127.0.0.1:88'+path,{method,headers:{Cookie:cookie,'X-CSRF-Token':csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
 const next=response.headers.getSetCookie().find(c=>c.startsWith('GULIMALLSESSION='));if(next)cookie=next.split(';')[0]
 const data=await response.json();if(data.csrfToken)csrf=data.csrfToken
 return {status:response.status,data}
}
const progress=value=>writeFileSync(output+'-progress.json',JSON.stringify({runId,startedUtc,...value},null,2)+'\n')
try{
 assert.equal((await call('/api/auth/csrf')).status,200)
 const phone='137'+String(randomInt(100000000)).padStart(8,'0'),otp=await call('/api/auth/sms/code','POST',{phone})
 assert.equal(otp.status,200);assert.equal(otp.data.mode,'development')
 const registered=await call('/api/auth/register','POST',{username:'idle_'+randomUUID().replaceAll('-','').slice(0,12),password:'Idle_'+randomUUID()+'!',phone,code:otp.data.developmentCode})
 assert.equal(registered.status,200)
 assert.equal((await call('/api/member/addresses')).status,200)
 const idleStart=performance.now(),lastRequestUtc=new Date().toISOString(),oldCookie=cookie
 const sessionId=Buffer.from(cookie.split('=')[1],'base64').toString('utf8');assert(/^[a-f0-9-]{36}$/.test(sessionId),'Unexpected opaque Session encoding')
 const key='gulimall:session:sessions:expires:'+sessionId
 const ttl=()=>{
  const result=spawnSync('docker',['compose','exec','-T','redis','redis-cli','--raw'],{input:'TTL '+key+'\n',encoding:'utf8',windowsHide:true,timeout:15000})
  assert.equal(result.status,0,'Readonly Session TTL observation failed')
  const value=Number(result.stdout.trim());assert(Number.isInteger(value));return value
 }
 const initialTtl=ttl();assert(initialTtl>=7195&&initialTtl<=7200,'Actual idle TTL must be 7200 seconds')
 let observations=1,lastTtl=initialTtl
 progress({phase:'idle',lastRequestUtc,initialTtl,elapsedSeconds:0,lastTtl,observations})
 // Only Redis TTL is observed; no HTTP or browser request uses this Session during the idle interval.
 while(performance.now()-idleStart<7205000){
  await new Promise(r=>setTimeout(r,Math.min(30000,7205000-(performance.now()-idleStart))))
  const value=ttl();assert(value===-2||(value>=0&&value<=lastTtl),'Session was renewed during natural idle acceptance')
  lastTtl=value;observations++
  progress({phase:'idle',lastRequestUtc,initialTtl,elapsedSeconds:Math.floor((performance.now()-idleStart)/1000),lastTtl,observations})
 }
 const elapsedSeconds=(performance.now()-idleStart)/1000;assert(elapsedSeconds>=7200);assert.equal(lastTtl,-2)
 cookie=oldCookie;assert.equal((await call('/api/auth/me')).status,401)
 cookie=oldCookie;assert.equal((await call('/api/order/mine')).status,401)
 server=await createDemoServer();browser=await chromium.launch()
 const context=await browser.newContext({viewport:{width:1280,height:800}})
 await context.addCookies([{name:'GULIMALLSESSION',value:oldCookie.split('=')[1],url:'http://127.0.0.1:8080',httpOnly:true,sameSite:'Lax'}])
 await context.route('**/*',route=>{const u=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(u.hostname)?route.continue():route.abort()})
 const page=await context.newPage();await page.goto('http://127.0.0.1:8080/member/orders')
 await page.waitForURL(url=>url.pathname==='/login'&&url.searchParams.get('redirect')==='/member/orders')
 await page.getByRole('heading',{name:'登录谷粒商城'}).waitFor()
 await page.screenshot({path:output+'-login.png'})
 const result={runId,startedUtc,lastRequestUtc,completedUtc:new Date().toISOString(),initialTtl,elapsedSeconds,observations,expiryKeyAbsent:true,meStatus:401,ordersStatus:401,loginRecovery:true,naturalIdle:true,ttlModified:false,sessionDeleted:false}
 writeFileSync(output+'-result.json',JSON.stringify(result,null,2)+'\n');progress({phase:'passed',...result})
 console.log('PASS: 7200-second natural idle expiry, protected 401 and browser login recovery; no Session mutation.')
}catch(error){progress({phase:'failed',reason:'Natural Session acceptance failed; inspect redacted process error'});throw error}
finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}}
