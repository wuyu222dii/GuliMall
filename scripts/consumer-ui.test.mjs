import test from 'node:test'
import assert from 'node:assert/strict'
import {consumerQuery} from '../gulimall-web/src/utils/consumer.js'
import {memberRedirect} from '../gulimall-web/src/utils/payment.js'

test('address and owned-order URLs reject ambiguous scalars and unsafe login targets',()=>{
 assert.deepEqual(consumerQuery('address','page=2'),{page:'2'})
 assert.equal(memberRedirect('/member/address?page=2'),'/member/address?page=2')
 assert.equal(memberRedirect('/member/orders/1?page=2&status=0'),'/member/orders/1?page=2&status=0')
 for(const query of ['page=0','page=01','page=1000001','page=1&page=2','memberId=2','limit=10','page=NaN'])assert.throws(()=>consumerQuery('address',query))
 for(const query of ['status=10','status=0&status=1','orderSn=wrong','unknown=x'])assert.throws(()=>consumerQuery('orders',query))
 for(const path of ['//evil.test/member/address?page=2','/member/address?page=2#x','/member/address?page=2&page=3','/member/address?redirect=/admin','/member/orders?memberId=2'])assert.equal(memberRedirect(path),'/')
})
test('search URLs retain repeated brands and literal comma attribute values with category aliases',()=>{
 const value=consumerQuery('search','catalog3Id=3&brandId=1,2&brandId=3&attrs=1_红,蓝&attrs=2_128GB&page=2&max=0')
 assert.equal(value.catalogId,'3');assert.equal(value.max,'0');assert.deepEqual(value.brandId,['1','2','3']);assert.deepEqual(value.attrs,['1_红,蓝','2_128GB'])
 assert.equal(consumerQuery('search','catalogId=3&catalog3Id=3').catalogId,'3');assert.equal(consumerQuery('search','catalogId=0').catalogId,'')
})
test('search URL validation matches the public window and refuses unknown or conflicting filters',()=>{
 for(const query of ['page=834','page=1&page=2','sort=bad','sort=','keyword=x&keyword=y','catalogId=1&catalog3Id=2','brandId=0','brandId=','attrs=1_','attrs=wrong','max=1e2','min=2&max=1','hasStock=2','hasStock=01','unknown=x','limit=50','keyword='+'a'.repeat(101)])assert.throws(()=>consumerQuery('search',query),query)
 assert.equal(consumerQuery('search','page=833&min=0&max=999999999999.99&hasStock=0').page,'833')
})
