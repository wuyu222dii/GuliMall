import test from 'node:test'
import assert from 'node:assert/strict'
import {parseProcurementRequest,demandMatches,purchaseMatches} from '../gulimall-web/src/utils/procurement.js'
test('procurement snapshots reject damaged, invalid and ambiguous requests without replacing them',()=>{
 const request={type:'save',payload:{id:null,skuId:1,wareId:2,skuNum:3,skuPrice:'1.20'}}
 assert.deepEqual(parseProcurementRequest(JSON.stringify(request)),request);assert.equal(parseProcurementRequest(null),null)
 for(const raw of ['','broken','{}',JSON.stringify({type:'save',payload:{...request.payload,skuNum:0}}),JSON.stringify({type:'merge',payload:{items:[1,1]}}),JSON.stringify({type:'finish',payload:{id:1,items:[{itemId:2,status:4,reason:''}]}})])assert.throws(()=>parseProcurementRequest(raw))
})
test('demand comparison only checks contents; the page must explicitly confirm a candidate ID',()=>{
 const submitted={skuId:1,wareId:2,skuNum:3,skuPrice:'1.20'}
 assert(demandMatches({id:9,...submitted,skuPrice:1.2},submitted));assert(demandMatches({id:10,...submitted},submitted))
 assert(!demandMatches({...submitted,skuNum:4},submitted));assert(!demandMatches({...submitted,wareId:4},submitted))
})
test('receipt confirmation requires the same complete purchase, results and failure reasons',()=>{
 const request={id:1,items:[{itemId:2,status:3,reason:''},{itemId:3,status:4,reason:' 缺货 '}]},result={purchase:{id:1,status:4},items:[{id:2,status:3,failureReason:''},{id:3,status:4,failureReason:'缺货'}]}
 assert(purchaseMatches(result,request));assert(!purchaseMatches({...result,purchase:{id:9,status:4}},request))
 assert(!purchaseMatches({...result,items:result.items.slice(0,1)},request));assert(!purchaseMatches({...result,purchase:{id:1,status:2}},request))
 assert(!purchaseMatches({...result,items:[result.items[0],{...result.items[1],failureReason:'其他原因'}]},request))
})
