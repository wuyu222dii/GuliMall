import test from 'node:test'
import assert from 'node:assert/strict'
import { readGuest, claimGuest, acknowledgeGuest, cartTotals, validQuantity } from '../gulimall-web/src/utils/cart.js'

test('legacy visitor carts survive migration and failed merge copies remain bound to their first member', () => {
  const local=readGuest(JSON.stringify({state:{items:[{skuId:1,count:2,checked:false}]}}))
  const batch=claimGuest(local,'A')
  assert.equal(local.guestItems.length,0);assert.equal(local.pending.A.items[0].count,2)
  assert.equal(claimGuest(local,'A').id,batch.id);assert.equal(claimGuest(local,'B'),null)
  local.guestItems.push({skuId:2,count:1})
  acknowledgeGuest(local,'B',batch.id);assert.ok(local.pending.A)
  acknowledgeGuest(local,'A','different-request');assert.ok(local.pending.A)
  acknowledgeGuest(local,'A',batch.id);assert.equal(local.pending.A,undefined);assert.equal(local.guestItems.length,1)
})
test('selected totals handle decimal prices, invalid items and quantity boundaries', () => {
  assert.equal(cartTotals([{count:3,checked:true,price:0.1,status:'AVAILABLE'},{count:1,checked:false,price:99,status:'OFF_SHELF'}]).totalAmount,0.3)
  assert.equal(cartTotals([{count:1,checked:true,price:null,status:'SERVICE_UNAVAILABLE'}]).readyToCheckout,false)
  assert.equal(cartTotals([{count:1,checked:true,price:null,status:'DELETED'}]).totalAmount,null)
  for (const count of [0,-1,1.5,1000,NaN]) assert.throws(()=>validQuantity(count))
  assert.throws(()=>readGuest('broken'),SyntaxError)
  assert.throws(()=>readGuest('{"version":3,"guestItems":[{"skuId":1,"count":2}]}'),/unreadable/)
})
