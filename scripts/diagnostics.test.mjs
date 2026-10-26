import test from 'node:test'
import assert from 'node:assert/strict'
import {diagnose} from './simulation-diagnostics.mjs'
test('diagnostics identify failed dependencies and expose only actionable state',async()=>{
  const ports={product:10001,member:8000,coupon:7001,ware:11000,order:9000,search:12000,'auth-server':20000,'third-party':30000,cart:18000,gateway:88}
  const down=new Set(),run=args=>({status:0,stdout:args[0]==='info'?'linux':JSON.stringify(['mysql','redis','nacos','elasticsearch','rabbitmq'].map(Service=>({Service,Name:'gulimall-test-'+Service+'-1',State:down.has(Service)?'exited':'running',Health:'healthy'})))})
  const request=async url=>{if(url.includes('18170'))return Response.json({mode:'LOCAL_TEST',ready:!down.has('payment'),persistent:true});if(url.includes('8080'))return new Response('html');const name=new URL(url).searchParams.get('serviceName').replace('gulimall-','');return Response.json({hosts:[{healthy:true,ip:'127.0.0.1',port:ports[name]}]})}
  const options={run,request,probe:async p=>!(p===11000&&down.has('ware')),environment:'Test'}
  assert.equal((await diagnose(options)).healthy,true)
  for(const name of ['elasticsearch','rabbitmq','ware','payment']){down.add(name);const report=await diagnose(options);assert.equal(report.healthy,false);const check=report.checks.find(c=>c.name===({ware:'gulimall-ware',payment:'模拟网关'}[name]||name));assert.equal(check.state,'unavailable');assert(check.reason&&check.recovery);down.clear()}
  const offline=await diagnose({...options,run:()=>({status:1,stdout:''})});assert.equal(offline.checks[0].state,'unavailable');assert(!JSON.stringify(offline).includes('password'))
})
