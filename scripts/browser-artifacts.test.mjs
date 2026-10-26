import test from 'node:test'
import assert from 'node:assert/strict'
import {safeTraceEvent} from './browser-artifacts.mjs'
test('browser traces retain action timing without typed secrets, cookies, responses or error echoes',()=>{
  const secret='do-not-retain-password-code-cookie'
  const events=[{type:'before',callId:'1',apiName:'locator.fill',startTime:1,params:{value:secret}},{type:'after',callId:'1',endTime:2,result:secret,error:{message:secret,stack:secret}},{type:'log',message:secret},{type:'resource-snapshot',snapshot:{request:{headers:[secret]}}},{type:'context-options',version:8,options:{viewport:{width:375,height:812},httpCredentials:{password:secret},storageState:{cookies:[secret]}}}].map(safeTraceEvent).filter(Boolean)
  assert(!JSON.stringify(events).includes(secret));assert.equal(events.length,3);assert.equal(events[0].apiName,'locator.fill');assert.equal(events[1].endTime,2);assert.equal(events[2].options.viewport.width,375)
})
