import test from 'node:test'
import assert from 'node:assert/strict'
import {adminQuery,adminRedirect,adminListUrl,syncProductListUrl} from '../gulimall-web/src/utils/admin.js'
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

test('procurement URLs separate warehouse names, exact stock IDs and purchase detail contexts',()=>{
 assert.equal(adminQuery('procurement','tab=purchases&page=2&wareId=1&status=2&purchaseId=3').purchaseId,'3')
 assert.equal(adminQuery('procurement','tab=warehouses&key=测试仓库&page=2').key,'测试仓库')
 assert.equal(adminQuery('procurement','tab=stock&skuId=1&wareId=2').skuId,'1')
 for(const query of ['tab=other','tab=stock&status=1','tab=demands&purchaseId=1','tab=warehouses&wareId=1','key=name','page=1&page=2','secret=x','skuId=0'])assert.throws(()=>adminQuery('procurement',query))
 assert.equal(adminRedirect('/admin/procurement?tab=purchases&page=2&purchaseId=3'),'/admin/procurement?tab=purchases&page=2&purchaseId=3')
})

test('catalog URLs only retain filters applicable to the selected metadata type',()=>{
 assert.equal(adminQuery('catalog','kind=attrs&page=2&catalogId=3&status=0&type=1').status,'0')
 for(const query of ['kind=no','kind=categories&status=1','kind=brands&type=0','kind=groups&status=1','kind=attrs&type=2','kind=attrs&catalogId=-1','page=0','kind=brands&kind=attrs'])assert.throws(()=>adminQuery('catalog',query))
 assert.equal(adminRedirect('/admin/products/catalog?kind=brands&page=2&key=abc'),'/admin/products/catalog?kind=brands&page=2&key=abc')
})

test('sync pagination and filters never replace the original product return context',()=>{
 const query='key=phone&page=3&brandId=2&syncPage=4&syncSpuId=9&syncState=0'
 assert.equal(adminQuery('sync',query).syncPage,'4');assert.equal(syncProductListUrl(query),'/admin/products?key=phone&page=3&brandId=2')
 assert.equal(adminRedirect('/admin/products/sync?'+query),'/admin/products/sync?'+query)
 for(const bad of ['syncPage=0','syncPage=100001','syncState=3','syncSpuId=-1','syncSpuId=9&syncSpuId=10','unknown=x'])assert.throws(()=>adminQuery('sync',bad))
 assert.equal(adminRedirect('/admin/procurement?tab=stock&status=2'),'/admin/products')
})
