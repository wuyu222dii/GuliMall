import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {assertTestEnvironment} from './test-environment.mjs'
import {testConfig,createPaymentGateway} from './payment-test-gateway.mjs'
import {createDemoServer} from './serve-demo.mjs'
import {cleanRawBrowserArtifacts} from './browser-artifacts.mjs'
await assertTestEnvironment()
assert(existsSync('gulimall-web/node_modules/@playwright/test/cli.js'),'Install the locked frontend development dependencies first')
const keyFile='.tools/test/browser-payment.json',dataFile='.data/test-simulation/browser/trades.json'
assert(!existsSync(dataFile)||existsSync(keyFile),'Restore the original test keys before opening the browser ledger')
const config=testConfig(keyFile);config.returnUrl='http://127.0.0.1:8080/payment/return'
const baseline={...process.env};delete baseline.PSModulePath
let gateway,server
function service(action,local=true){const env={...baseline};if(local)Object.assign(env,{SPRING_PROFILES_ACTIVE:'dev,test,payment-test',ALIPAY_APP_ID:config.appId,ALIPAY_PRIVATE_KEY:config.merchantPrivate,ALIPAY_PUBLIC_KEY:config.providerPublic,ALIPAY_SELLER_ID:config.sellerId,ALIPAY_NOTIFY_URL:config.notifyUrl,ALIPAY_RETURN_URL:config.returnUrl,ALIPAY_GATEWAY_URL:'http://127.0.0.1:18170/gateway.do'});const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/services.ps1',action,'-Modules','order'],{env,stdio:'ignore',windowsHide:true,timeout:30000});assert.equal(r.status,0,'Test order service operation failed')}
try {
  gateway=await createPaymentGateway({config,port:18170,dataFile});server=await createDemoServer();service('Stop');service('Start')
  let ready=false
  for(let i=0;i<90;i++){try{await assertTestEnvironment();if((await fetch('http://127.0.0.1:8080/api/order/mine')).status===401){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}
  assert(ready,'Browser test services did not become ready')
  const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['gulimall-web/node_modules/@playwright/test/cli.js','test','--config','gulimall-web/playwright.config.mjs'],{env:baseline,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',resolve)})
  assert.equal(code,0,'Browser regression failed; only redacted artifacts are retained')
}finally{
  // Playwright's automatic DOM error context can contain development codes; retain only our masked screenshots and safe traces.
  try{cleanRawBrowserArtifacts()}finally{service('Stop');if(gateway)await gateway.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}service('Start',false)}
}
