import test from 'node:test'
import assert from 'node:assert/strict'
import {adminQuery,adminRedirect,adminListUrl} from '../gulimall-web/src/utils/admin.js'
test('admin product URL filters preserve draft zero, IDs, keyword and bounded pagination',()=>{
 const q=adminQuery('products','key=phone&status=0&catalogId=1&brandId=2&page=2')
 assert.equal(q.status,'0');assert.equal(q.page,'2');assert.equal(q.brandId,'2')
 assert.equal(adminQuery('products','status=2').status,'2')
 for(const query of ['page=0','page=1000001','page=x','page=1&page=2','status=3','brandId=-1','catalogId=wrong','limit=1000','key='+('a'.repeat(101))])assert.throws(()=>adminQuery('products',query))
})
test('admin order URL filters validate complete order numbers without dropping state',()=>{
 const sn='a'.repeat(32);assert.equal(adminQuery('orders','page=2&status=0&orderSn='+sn).orderSn,sn)
 for(const query of ['status=10','orderSn=partial','status=1&status=2','memberId=2','page=1.5'])assert.throws(()=>adminQuery('orders',query))
})
test('admin login targets retain known list and detail queries and reject external or unknown targets',()=>{
 for(const value of ['/admin/orders/12?page=2&status=0','/admin/orders?orderSn='+'a'.repeat(32),'/admin/products/12/edit?key=phone&page=3','/admin/products/sync?catalogId=1','/admin/procurement'])assert.equal(adminRedirect(value),value)
 for(const value of ['https://evil.test/admin/orders','//evil.test/admin/orders','/admin/login','/admin/orders?redirect=https://evil.test','/admin/orders/12#secret','/admin/unknown','/admin/orders?page=0'])assert.equal(adminRedirect(value),'/admin/products')
})
test('admin list return links only retain the typed list query',()=>{
 assert.equal(adminListUrl('products','?brandId=1&page=2'),'/admin/products?brandId=1&page=2')
 assert.equal(adminListUrl('orders','page=2&status=3'),'/admin/orders?page=2&status=3')
 assert.equal(adminListUrl('orders','?redirect=https://evil.test'),'/admin/orders')
})
