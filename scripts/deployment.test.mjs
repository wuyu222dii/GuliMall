import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createDemoServer} from './serve-demo.mjs'
import {assertTestEnvironment} from './test-environment.mjs'
test('missing browser prerequisites fail before the standing environment is stopped',{skip:process.platform!=='win32'},async()=>{
  const root=resolve('.tools/browser-preflight-'+randomUUID());await mkdir(root+'/scripts',{recursive:true})
  for(const file of ['test.ps1','env.ps1'])await copyFile('scripts/'+file,root+'/scripts/'+file)
  const before='DB_HOST=127.0.0.1\n';await writeFile(root+'/.env',before)
  const env={...process.env};delete env.PSModulePath
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',root+'/scripts/test.ps1','-Suite','Browser'],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:30000})
  assert.notEqual(result.status,0);assert.match(result.stderr,/Browser prerequisites missing/);assert.doesNotMatch(result.stdout,/Stopped gulimall|Simulation stopped/);assert.equal(await readFile(root+'/.env','utf8'),before)
})

test('an unavailable Edge channel is rejected before any standing service or configuration is changed',{skip:process.platform!=='win32'},async()=>{
  const root=resolve('.tools/edge-preflight-'+randomUUID()),module=root+'/gulimall-web/node_modules/@playwright/test';await mkdir(module,{recursive:true});await mkdir(root+'/scripts',{recursive:true});await mkdir(root+'/gulimall-web/dist',{recursive:true})
  for(const file of ['test.ps1','env.ps1'])await copyFile('scripts/'+file,root+'/scripts/'+file)
  await writeFile(module+'/chromium.exe','fixture');await writeFile(module+'/index.mjs',"import {fileURLToPath} from 'node:url';export const chromium={executablePath:()=>fileURLToPath(new URL('./chromium.exe',import.meta.url)),launch:async()=>{throw Error('unavailable fixture')}}")
  await writeFile(root+'/gulimall-web/dist/index.html','fixture');const before='DB_HOST=127.0.0.1\n';await writeFile(root+'/.env',before)
  const env={...process.env};delete env.PSModulePath
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',root+'/scripts/test.ps1','-Suite','Browser'],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:30000})
  assert.notEqual(result.status,0);assert.match(result.stderr,/Install or enable local Microsoft Edge/);assert.doesNotMatch(result.stdout,/Stopped gulimall|Simulation stopped/);assert.equal(await readFile(root+'/.env','utf8'),before)
})

test('acceptance refuses demo projects and missing test profiles before any network or SQL writes',async()=>{
  const original={...process.env}
  try {
    delete process.env.GULIMALL_TEST;await assert.rejects(assertTestEnvironment())
    process.env.GULIMALL_TEST='1';process.env.COMPOSE_PROJECT_NAME='gulimall-demo';await assert.rejects(assertTestEnvironment())
    process.env.COMPOSE_PROJECT_NAME='gulimall-test';process.env.SPRING_PROFILES_ACTIVE='dev';await assert.rejects(assertTestEnvironment())
  }finally{for(const k of ['GULIMALL_TEST','COMPOSE_PROJECT_NAME','SPRING_PROFILES_ACTIVE']){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]}}
})
test('acceptance verifies actual catalogs even when test environment flags are present',async(t)=>{
  const keys=['GULIMALL_TEST','COMPOSE_PROJECT_NAME','SPRING_PROFILES_ACTIVE','INTERNAL_API_TOKEN'],original=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
  Object.assign(process.env,{GULIMALL_TEST:'1',COMPOSE_PROJECT_NAME:'gulimall-test',SPRING_PROFILES_ACTIVE:'dev,test',INTERNAL_API_TOKEN:'x'.repeat(32)})
  try{
    const mocked=t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({catalog:'gulimall_pms_demo'})))
    await assert.rejects(assertTestEnvironment(),/non-test database/)
    mocked.mock.mockImplementation(async(url,options)=>{assert.equal(options.headers['X-Internal-Token'],'x'.repeat(32));const names={10001:'pms',7001:'sms',8000:'ums',9000:'oms',11000:'wms'};return new Response(JSON.stringify({catalog:`gulimall_${names[new URL(url).port]}_test`}))})
    await assertTestEnvironment()
  }finally{for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key]}}
})
test('static deployment serves SPA routes, protects files and proxies session cookies on the same origin',async()=>{
  const root='.tools/static-test-'+randomUUID();await mkdir(root,{recursive:true});await writeFile(root+'/index.html','<main>static demo</main>');await writeFile(root+'/app.js','export {}')
  const upstream=createServer((req,res)=>{res.setHeader('Set-Cookie','GULIMALLSESSION=test; HttpOnly; SameSite=Lax');res.end(req.method+' '+req.url+' '+req.headers.cookie)})
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));const server=await createDemoServer({root,port:0,gatewayPort:upstream.address().port}),base='http://127.0.0.1:'+server.address().port
  try{
    assert.equal(await(await fetch(base+'/member/orders')).text(),'<main>static demo</main>')
    assert.match((await fetch(base+'/app.js')).headers.get('content-type'),/javascript/)
    for(const path of ['/missing.js','/.env','/%2e%2e/.env','/%00'])assert([400,404].includes((await fetch(base+path)).status))
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405)
    const r=await fetch(base+'/api/auth/me',{headers:{Cookie:'GULIMALLSESSION=old'}});assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.equal(await r.text(),'GET /api/auth/me GULIMALLSESSION=old')
  }finally{server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>upstream.close(r))])}
})
