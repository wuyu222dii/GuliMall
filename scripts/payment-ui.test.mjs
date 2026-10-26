import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentTarget, memberRedirect, paymentSettled } from '../gulimall-web/src/utils/payment.js'
test('payment polling stops only for completed orders or confirmed closed releases', () => {
  assert.equal(paymentSettled({status:3}),true)
  assert.equal(paymentSettled({status:4,inventoryStatus:2}),true)
  for(const status of [0,1,2,4,6,7,8,9,undefined])assert.equal(paymentSettled({status,inventoryStatus:0}),false)
})
test('payment actions accept only sandbox endpoints or explicitly marked loopback tests', () => {
  assert.ok(paymentTarget('https://openapi-sandbox.dl.alipaydev.com/gateway.do', 'ALIPAY_SANDBOX'))
  assert.ok(paymentTarget('http://127.0.0.1:18170/gateway.do', 'LOCAL_TEST'))
  for (const url of ['https://openapi.alipay.com/gateway.do', 'https://evil.test/gateway.do', 'javascript:alert(1)', 'https://user@openapi-sandbox.dl.alipaydev.com/gateway.do', 'https://openapi-sandbox.dl.alipaydev.com/evil', 'http://127.0.0.1:18170/gateway.do']) assert.throws(() => paymentTarget(url, 'ALIPAY_SANDBOX'))
  assert.throws(() => paymentTarget('http://localhost:18170/gateway.do', 'LOCAL_TEST'))
})
test('payment return login redirects retain the exact order while rejecting external destinations', () => {
  const sn = 'a'.repeat(32)
  for (const url of ['/cart', '/payment/' + sn, '/payment/return?orderSn=' + sn]) assert.equal(memberRedirect(url), url)
  assert.equal(memberRedirect('/payment/return?orderSn=' + sn + '&trade_status=TRADE_SUCCESS&sign=ignored'), '/payment/return?orderSn=' + sn)
  for (const url of ['//evil.test', 'https://evil.test', '/payment/return?orderSn=bad', '/payment/' + sn + '?next=//evil.test']) assert.equal(memberRedirect(url), '/')
})

test('checkout login redirects preserve one confirmation and never accept arbitrary navigation targets',()=>{
  const token='12345678-abcd-1234-abcd-123456789abc',path='/checkout?confirmation='+token
  assert.equal(memberRedirect(path),path);assert.equal(memberRedirect(path+'&next=https://evil.test'),path)
  for(const target of ['/checkout?confirmation=bad',path+'#ignored',path+'&confirmation='+token,'https://evil.test'+path,'//evil.test'+path])assert.equal(memberRedirect(target),'/')
})
