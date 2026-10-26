import assert from 'node:assert/strict'
import {spawnSync,spawn} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import {assertTestEnvironment} from './test-environment.mjs'
import {createDemoServer} from './serve-demo.mjs'
import {createPaymentGateway,testConfig} from './payment-test-gateway.mjs'
await assertTestEnvironment()
const env={...process.env};delete env.PSModulePath
const config=testConfig('.tools/test/diagnostics-payment.json'),options={config,port:18170,dataFile:'.data/test-simulation/diagnostics/trades.json'}
let gateway,server;const stopped=new Set()
function command(program,args){const r=spawnSync(program,args,{env,stdio:'ignore',windowsHide:true,timeout:90000});assert.equal(r.status,0,'Local diagnostics fixture operation failed')}
function service(action){command('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/services.ps1',action,'-Modules','ware'])}
function report(){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/simulation-diagnostics.mjs','--json'],{env,windowsHide:true,timeout:45000});let output='';child.stdout.on('data',chunk=>{output+=chunk});child.on('error',reject);child.on('close',code=>{try{assert([0,1].includes(code));resolve(JSON.parse(output))}catch(error){reject(error)}})})}
async function ready(){for(let i=0;i<30;i++){if((await report()).healthy)return;await new Promise(r=>setTimeout(r,1000))}assert.fail('Diagnostic fixture did not recover')}
try {
  server=await createDemoServer();gateway=await createPaymentGateway(options);await ready()
  for(const name of ['elasticsearch','rabbitmq']){command('docker',['compose','stop',name]);stopped.add(name);const r=await report();assert.equal(r.checks.find(c=>c.name===name).state,'unavailable');command('docker',['compose','up','-d','--wait',name]);stopped.delete(name);await ready();console.log('PASS: stopped '+name+' is identified and recovers')}
  service('Stop');assert.equal((await report()).checks.find(c=>c.name==='gulimall-ware').state,'unavailable');service('Start');await ready();console.log('PASS: stopped warehouse is identified and recovers')
  await gateway.close();gateway=null;assert.equal((await report()).checks.find(c=>c.name==='模拟网关').state,'unavailable');gateway=await createPaymentGateway(options);await ready();console.log('PASS: stopped simulation gateway is identified and recovers')
  writeFileSync('.tools/test/diagnostics-result.json',JSON.stringify({environment:'Test',faults:['elasticsearch','rabbitmq','ware','payment'],recovered:true,mutatedBusinessData:false},null,2)+'\n')
}finally{for(const name of stopped)command('docker',['compose','up','-d',name]);service('Start');if(gateway)await gateway.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r))}}
