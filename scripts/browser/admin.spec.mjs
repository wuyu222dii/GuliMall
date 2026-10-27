import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {assertTestEnvironment} from '../test-environment.mjs'
import {json,sql,login,register,openPage,closeContexts,fits} from './helpers.mjs'
let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
const account=()=>JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8'))
async function write(page,path,data,method='POST'){
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken,r=await page.request.fetch(path,{method,headers:{'X-CSRF-Token':csrf},data})
 expect(r.status()).toBe(200);const result=await r.json();expect(result.code).toBe(0);return result
}
async function product(page,name,options={}){
 const cat=options.catalogId||900003,id=(await write(page,'/api/admin/product/spuinfo/editor',{creationRequestId:randomUUID(),spuName:name,spuDescription:'后台导航验收',catalogId:cat,brandId:options.brandId||900001,weight:'0.2',images:['/demo-product.svg'],decript:['/demo-product.svg'],baseAttrs:[],skus:[{skuName:name,skuTitle:name,price:'0.10',images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:cat===900003?[{attrId:900002,attrName:'颜色',attrValue:'标准'}]:[]}]})).id
 const sku=(await json(page,'/api/admin/product/spuinfo/editor/'+id)).product.skus[0].skuId
 return {id,sku}
}
test('后台商品：组合筛选、两页往返、编辑保存恢复和名称失败降级',async({browser},info)=>{
 const page=await openPage(browser,contexts),label='后台筛选 '+randomUUID();await login(page,account())
 const otherBrand=(await write(page,'/api/admin/product/admin/catalog/brands',{name:label+' 品牌',firstLetter:'P',showStatus:1,sort:0})).id
 const otherCategory=(await write(page,'/api/admin/product/admin/catalog/categories',{name:label+' 分类',catLevel:3,parentCid:900002,sort:0})).id
 const ids=[];for(let i=0;i<21;i++)ids.push((await product(page,label+' 草稿 '+i)).id)
 const up=await product(page,label+' 已上架');await write(page,'/api/admin/product/search-sync/'+up.id+'/publish?status=1',{})
 await product(page,label+' 其他品牌',{brandId:otherBrand});await product(page,label+' 其他分类',{catalogId:otherCategory})
 await page.goto('/admin/products');await page.getByLabel('商品名称或 SPU 编号',{exact:true}).fill(label);await page.getByLabel('商品分类',{exact:true}).selectOption('900003');await page.getByLabel('商品品牌',{exact:true}).selectOption('900001');await page.getByLabel('商品上架状态',{exact:true}).selectOption('0');await page.getByRole('button',{name:'查询',exact:true}).click()
 await expect(page.locator('.admin-table tbody tr')).toHaveCount(20);await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 const listUrl=page.url();expect(new URL(listUrl).searchParams.get('page')).toBe('2');await page.reload();await expect(page.getByLabel('商品品牌',{exact:true})).toHaveValue('900001');await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 await page.goBack();await expect(page.locator('.admin-table tbody tr')).toHaveCount(20);await page.goForward();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 const names=(await json(page,'/api/admin/product/admin/catalog')).data,brand=names.brands.find(b=>b.brandId===900001).name
 await expect(page.locator('.admin-table tbody')).toContainText(brand);await page.getByRole('link',{name:'编辑 SPU / SKU',exact:true}).click()
 await expect(page).toHaveURL(new RegExp('/admin/products/'+ids[0]+'/edit\\?'))
 const edited=label+' 草稿 已修改';await page.getByLabel('商品名称',{exact:true}).fill(edited);await page.getByRole('button',{name:'保存商品与 SKU',exact:true}).click();await expect(page.getByRole('button',{name:'保存商品与 SKU',exact:true})).toBeEnabled();await page.reload();await expect(page.getByLabel('商品名称',{exact:true})).toHaveValue(edited)
 await page.getByRole('link',{name:'返回列表',exact:true}).click();await expect(page).toHaveURL(listUrl);await expect(page.locator('.admin-table tbody')).toContainText(edited)
 await page.route('**/api/admin/product/admin/catalog',route=>route.abort('failed'));await page.reload();await expect(page.getByRole('alert')).toContainText('分类或品牌选项加载失败');await expect(page.locator('.admin-table tbody')).toContainText(edited);await expect(page.getByLabel('商品分类',{exact:true})).toHaveValue('900003')
 await page.unroute('**/api/admin/product/admin/catalog');await page.getByRole('button',{name:'重试分类品牌',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.locator('.admin-table tbody')).toContainText(brand)
 await page.setViewportSize({width:375,height:812});await fits(page);await page.getByLabel('商品上架状态',{exact:true}).selectOption('1');await page.getByRole('button',{name:'查询',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);await expect(page.locator('.admin-table tbody')).toContainText(label+' 已上架');await fits(page);await page.screenshot({path:info.outputPath('admin-products-mobile.png'),fullPage:true})
 await page.goto('/admin/products?status=invalid');await expect(page.getByRole('alert')).toContainText('筛选状态不正确');await expect(page.getByText('没有符合条件的商品。',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'清除商品筛选',exact:true}).click();await expect(page).toHaveURL(/\/admin\/products$/)
})
test('管理订单：独立详情、URL 页码恢复、重登回跳、会员拒绝和未付款发货门禁',async({browser},info)=>{
 const admin=await openPage(browser,contexts),member=await openPage(browser,contexts),run='admin28_'+randomUUID().replaceAll('-','').slice(0,10),orders=[];await login(admin,account())
 const item=await product(admin,run),demand=(await write(admin,'/api/admin/ware/purchasedetail/save',{skuId:item.sku,wareId:900001,skuNum:30,skuPrice:'0.00'})).id,purchase=(await write(admin,'/api/admin/ware/purchase/merge',{items:[demand]})).purchaseId
 await write(admin,'/api/admin/ware/purchase/received',[purchase]);await write(admin,'/api/admin/ware/purchase/done',{id:purchase,items:[{itemId:demand,status:3}]});await write(admin,'/api/admin/product/search-sync/'+item.id+'/publish?status=1',{})
 await register(member,run);const address=(await write(member,'/api/member/addresses',{name:'订单导航会员',phone:'13800000001',province:'浙江省',city:'杭州市',region:'西湖区',detailAddress:'独立测试地址',defaultStatus:1})).id
 try {
  for(let i=0;i<21;i++){await write(member,'/api/cart',undefined,'DELETE');await write(member,'/api/cart/items',{skuId:item.sku,count:1});const c=(await write(member,'/api/order/mine/confirm',{})).confirmation;const order=(await write(member,'/api/order/mine/submit',{token:c.token,addressId:address})).result.order;expect(order.status).toBe(0);orders.push(order)}
  await admin.goto('/admin/orders?status=0&page=2');const wanted=orders[0],row=admin.getByRole('row').filter({hasText:wanted.orderSn});await expect(row).toBeVisible();const listUrl=admin.url();await admin.reload();await expect(row).toBeVisible();await row.getByRole('link',{name:'详情 / 物流',exact:true}).click()
  const detailUrl=admin.url();expect(new URL(detailUrl).pathname).toBe('/admin/orders/'+wanted.id);await admin.reload();await expect(admin.getByRole('heading',{name:'订单详情：待付款',exact:true})).toBeVisible();await expect(admin.getByRole('button',{name:'确认发货',exact:true})).toHaveCount(0)
  const csrf=(await json(admin,'/api/auth/csrf')).csrfToken;expect((await admin.request.post('/api/admin/order/order/'+wanted.id+'/ship',{headers:{'X-CSRF-Token':csrf},data:{deliveryCompany:'不能发货',deliverySn:'NO-SHIP'}})).status()).toBe(409)
  await admin.getByRole('link',{name:'返回订单查询',exact:true}).click();await expect(admin).toHaveURL(listUrl);await expect(admin.getByLabel('订单状态',{exact:true})).toHaveValue('0')
  const anonymous=await openPage(browser,contexts);await anonymous.goto(detailUrl);await expect(anonymous).toHaveURL(/\/admin\/login\?redirect=/);expect(new URL(anonymous.url()).searchParams.get('redirect')).toBe(new URL(detailUrl).pathname+new URL(detailUrl).search)
  try {await anonymous.getByLabel('管理员账号',{exact:true}).fill(account().username);await anonymous.getByLabel('密码',{exact:true}).fill(account().password);await anonymous.getByRole('button',{name:'登录',exact:true}).click();await expect(anonymous).toHaveURL(detailUrl)}catch{throw new Error('后台详情重登回跳失败，凭据已隐藏')}
  expect((await member.request.get('/api/admin/order/order/info/'+wanted.id)).status()).toBe(403);expect((await member.request.get('/api/admin/order/order/'+wanted.id+'/processing')).status()).toBe(403)
  await member.goto(detailUrl);await expect(member).toHaveURL(/\/admin\/login/);await expect(member.getByText(wanted.orderSn,{exact:true})).toHaveCount(0)
  await admin.getByLabel('完整订单号',{exact:true}).fill(wanted.orderSn);await admin.getByRole('button',{name:'查询订单',exact:true}).click();await expect(admin.locator('.admin-table tbody tr')).toHaveCount(1);expect(new URL(admin.url()).searchParams.get('orderSn')).toBe(wanted.orderSn)
  await admin.getByRole('button',{name:'清除订单条件',exact:true}).click();await expect(admin).toHaveURL(/\/admin\/orders$/)
  await admin.goto('/admin/orders?status=wrong');await expect(admin.getByRole('alert')).toContainText('筛选状态不正确');await expect(admin.getByText('暂无匹配订单。',{exact:true})).toHaveCount(0)
  await admin.goto('/admin/orders/999999999');await expect(admin.getByRole('alert')).toContainText('订单不存在');await expect(admin.getByRole('button',{name:'确认发货',exact:true})).toHaveCount(0)
  await admin.goto(detailUrl);await expect(admin.getByRole('heading',{name:'订单详情：待付款',exact:true})).toBeVisible();await admin.setViewportSize({width:375,height:812});await fits(admin);await admin.getByRole('link',{name:'返回订单查询',exact:true}).click();await expect(admin).toHaveURL(listUrl);await admin.screenshot({path:info.outputPath('admin-orders-mobile.png'),fullPage:true})
 } finally {
  for(const order of orders)await write(member,'/api/order/mine/'+order.id+'/cancel',{})
  await expect.poll(()=>sql('SELECT stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id='+item.sku+' AND ware_id=900001;'),{timeout:60000}).toBe('0')
 }
})
function elasticsearch(action){const r=spawnSync('docker',['compose',...(action==='stop'?['stop','elasticsearch']:['up','-d','--wait','--wait-timeout','120','elasticsearch'])],{stdio:'ignore',windowsHide:true,timeout:150000});expect(r.status).toBe(0)}
async function syncRow(page,id){
 await page.reload()
 const link=page.getByRole('link',{name:'编辑商品 '+id,exact:true})
 for(let i=0;i<30;i++){await expect(page.locator('.admin-table')).toBeVisible();if(await link.count())return page.getByRole('row').filter({has:link});const next=page.getByRole('button',{name:'下一页',exact:true});if(!await next.isEnabled())break;const response=page.waitForResponse(r=>r.url().includes('/api/admin/product/search-sync?'));await next.click();const data=(await(await response).json()).page;if(data.list.length)await expect(page.getByRole('link',{name:'编辑商品 '+data.list[0].spu_id,exact:true})).toBeVisible()}
 throw new Error('当前同步任务未在受限分页内找到')
}
test('同步任务：真实 ES 故障、重试时间、错误保留、编辑链接和提交完成区分',async({browser},info)=>{
 const page=await openPage(browser,contexts);await login(page,account());const item=await product(page,'同步可见性 '+randomUUID());let stopped=false
 try {
  stopped=true;elasticsearch('stop');const csrf=(await json(page,'/api/auth/csrf')).csrfToken
  expect((await page.request.post('/api/admin/product/search-sync/'+item.id+'/publish?status=1',{headers:{'X-CSRF-Token':csrf},data:{}})).status()).toBe(503)
  await page.goto('/admin/products/sync');let row=await syncRow(page,item.id);await expect(row).toContainText('失败待重试');await expect(row).toContainText('更新：');await expect(page.getByRole('columnheader',{name:'下次重试 / 最近更新',exact:true})).toBeVisible()
  await row.getByRole('button',{name:'立即同步',exact:true}).click();await expect(page.getByRole('alert')).toContainText('目标状态已保存');await expect(page.locator('.admin-table')).toBeVisible();await expect(page.getByRole('alert')).toContainText('目标状态已保存')
  elasticsearch('start');stopped=false;row=await syncRow(page,item.id);await row.getByRole('button',{name:'立即同步',exact:true}).click();await expect(page.getByText('此商品已重新同步。',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'刷新结果',exact:true}).click();row=await syncRow(page,item.id);await expect(row).toContainText('已同步，无失败重试');await row.getByRole('link',{name:'编辑商品 '+item.id,exact:true}).click();await expect(page).toHaveURL(new RegExp('/admin/products/'+item.id+'/edit$'));await page.getByRole('link',{name:'查看搜索同步',exact:true}).click()
  await page.route('**/api/admin/product/search-sync?**',route=>route.abort('failed'));await page.getByRole('button',{name:'刷新结果',exact:true}).click();await expect(page.getByRole('alert')).toContainText('同步记录查询失败');await expect(page.getByText('暂无同步任务，可从商品库全量重建。',{exact:true})).toHaveCount(0);await page.unroute('**/api/admin/product/search-sync?**')
  await page.getByRole('button',{name:'从商品库全量重建',exact:true}).click();await expect(page.getByText('全量重建任务已持久化，请刷新查看每个商品的同步结果',{exact:true})).toBeVisible()
  await page.setViewportSize({width:375,height:812});await fits(page);await page.screenshot({path:info.outputPath('admin-sync-mobile.png'),fullPage:true})
 } finally { if(stopped)elasticsearch('start') }
})