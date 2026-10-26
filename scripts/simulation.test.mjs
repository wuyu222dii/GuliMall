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

