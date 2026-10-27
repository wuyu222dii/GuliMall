import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {base,json,sql,login,signIn,register,fits,checkOwnOrderNavigation,openPage,closeContexts} from './helpers.mjs'
let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
async function api(page,path,body){
 try{const csrf=(await json(page,'/api/auth/csrf')).csrfToken;const r=await page.request.post(base+path,{headers:{'X-CSRF-Token':csrf},data:body});expect(r.status()).toBe(200);const result=await r.json();expect(result.code).toBe(0);return result}catch{throw new Error('Edge 独立夹具接口失败：'+path)}
}
async function product(admin,run){
 const id=(await api(admin,'/api/admin/product/spuinfo/editor',{spuName:'Edge 验收 '+run,spuDescription:'本地隔离浏览器验收',catalogId:900003,brandId:900001,weight:'0.2',images:['/demo-product.svg'],decript:['/demo-product.svg'],baseAttrs:[{attrId:900001,attrValues:'8GB',showDesc:1}],skus:[{skuName:'Edge '+run,skuTitle:'Edge '+run,price:'1.25',images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:'红色'}]}]})).id
 const sku=(await json(admin,`/api/admin/product/spuinfo/editor/${id}`)).product.skus[0].skuId
 const demand=(await api(admin,'/api/admin/ware/purchasedetail/save',{skuId:sku,wareId:900001,skuNum:10,skuPrice:'1.00'})).id,purchase=(await api(admin,'/api/admin/ware/purchase/merge',{items:[demand]})).purchaseId
 await api(admin,'/api/admin/ware/purchase/received',[purchase]);await api(admin,'/api/admin/ware/purchase/done',{id:purchase,items:[{itemId:demand,status:3}]});await api(admin,`/api/admin/product/search-sync/${id}/publish?status=1`,{})
 await expect.poll(async()=>(await json(admin,'/api/search?keyword='+run)).page.list.some(s=>s.skuId===sku)).toBe(true)
 return sku
}
async function address(page){
 await page.getByRole('link',{name:'收货地址',exact:true}).click();await page.getByRole('button',{name:'新增地址',exact:true}).click()
 for(const[name,value]of Object.entries({'收件人':'Edge 模拟会员','手机号':'13800000001','省份':'浙江省','城市':'杭州市','区县':'西湖区','详细地址':'独立浏览器验收19号'}))await page.getByLabel(name,{exact:true}).fill(value)
 await page.getByRole('checkbox',{name:'设为默认地址',exact:true}).check();await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('独立浏览器验收19号',{exact:false})).toBeVisible()
}
async function buy(page,sku,count=1){await page.goto('/product/'+sku);await page.getByLabel('数量',{exact:true}).fill(String(count));await page.getByRole('button',{name:'加购并前往购物车',exact:true}).click();await page.getByRole('button',{name:'结算已选商品',exact:true}).click()}
async function submit(page){const sent=page.waitForResponse(r=>r.url().endsWith('/mine/submit')&&r.request().method()==='POST');await page.getByRole('button',{name:'提交订单',exact:true}).click();const r=await sent;expect(r.status()).toBe(200);return(await r.json()).result.order}
async function payment(page){await page.getByRole('link',{name:'付款 / 库存状态',exact:true}).click();await page.getByRole('button',{name:'打开模拟付款',exact:true}).click();await expect(page.getByText(/不使用真实资金或账号/)).toBeVisible()}
async function cancel(page,order){
 await page.goto('/member/orders');const row=page.locator('.order-summary').filter({hasText:order.orderSn});await row.getByRole('button',{name:'取消待付款订单',exact:true}).click();await row.getByRole('button',{name:'确认取消',exact:true}).click()
 await expect.poll(async()=>(await json(page,`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.inventoryStatus).toBe(2)
}
async function tabTo(page,target){for(let i=0;i<80;i++){await page.keyboard.press('Tab');if(await target.evaluate(el=>el===document.activeElement)){await expect(target).toBeFocused();return}}throw new Error('键盘无法到达目标控件')}
function save(info,record){mkdirSync('.tools/test/browser-runs',{recursive:true});writeFileSync('.tools/test/browser-runs/'+record.run+'.json',JSON.stringify({...record,project:info.project.name,browserVersion:info.project.name==='edge'?record.browserVersion:undefined,complete:true,realServices:false},null,2)+'\n')}

test('Edge 关键交易：真实登录、付款履约、失败放弃和取消',async({browser},info)=>{
 const run='ui19_'+randomUUID().replaceAll('-','').slice(0,8),admin=await openPage(browser,contexts),member=await openPage(browser,contexts),account={username:run,password:'Edge_'+randomUUID()+'!'}
 await login(admin,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')));const sku=await product(admin,run),memberId=await register(member,account.username,account.password);await address(member)
 await member.getByRole('button',{name:'退出登录',exact:true}).click();await member.goto('/login?redirect=%2Fcart');await signIn(member,account);await expect(member).toHaveURL(/\/cart$/)
 await member.goto('/search?keyword='+run);await expect(member.locator('.product-card')).toHaveCount(1);await member.locator('.product-card').click();await member.getByLabel('数量',{exact:true}).fill('2');await member.getByRole('button',{name:'加购并前往购物车',exact:true}).click();await member.getByRole('button',{name:'结算已选商品',exact:true}).click()
 const order=await submit(member),confirmationUrl=member.url();expect(Number(order.payAmount)).toBe(2.50);await payment(member);await member.getByRole('button',{name:'确认模拟付款',exact:true}).click();await expect.poll(async()=>(await json(member,`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.fulfillmentReady).toBe(true)
 await admin.goto('/admin/orders');await admin.getByLabel('完整订单号',{exact:true}).fill(order.orderSn);await admin.getByRole('button',{name:'查询订单',exact:true}).click();await admin.getByRole('row').filter({hasText:order.orderSn}).getByRole('link',{name:'详情 / 物流',exact:true}).click();await admin.getByLabel('物流公司',{exact:true}).fill('Edge 模拟物流');await admin.getByLabel('运单号',{exact:true}).fill('EDGE-'+run.replaceAll('_','-'));await admin.getByRole('button',{name:'确认发货',exact:true}).click();await expect(admin.getByText(/发货已确认/)).toBeVisible()
 await member.goto('/member/orders');await member.getByRole('button',{name:'确认收货',exact:true}).click();await member.getByRole('button',{name:'确认已收到包裹',exact:true}).click();await expect(member.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();await member.reload();await expect(member.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();await member.screenshot({path:info.outputPath('edge-completed.png'),fullPage:true})
 await checkOwnOrderNavigation(member,order)
 await buy(member,sku);await member.getByRole('button',{name:'开始下一次确认',exact:true}).click();const cancelled=await submit(member);await payment(member);await member.getByRole('button',{name:'模拟付款失败',exact:true}).click();await member.getByRole('link',{name:'返回订单',exact:true}).click();await expect(member.getByRole('heading',{name:'待付款',exact:true})).toBeVisible();await member.getByRole('button',{name:'打开模拟付款',exact:true}).click();await member.getByRole('link',{name:'返回订单（不付款）',exact:true}).click();await cancel(member,cancelled)
 expect(sql(`SELECT stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku}`)).toBe('8\t0')
 const other=await openPage(browser,contexts);await register(other,run+'b');await other.goto('/member/orders');await expect(other.getByText('暂无订单',{exact:true})).toBeVisible();expect((await other.request.get(base+`/api/order/mine/${order.id}`)).status()).toBe(403);await other.goto(confirmationUrl);await expect(other.getByRole('alert')).toContainText('不能使用其他会员的确认单')
 save(info,{run,sku,memberId,completed:order.orderSn,cancelled:cancelled.orderSn,browserVersion:browser.version(),successAndCancel:true,memberIsolation:true})
})

test('Edge 边界：窄屏键盘、同一确认多标签提交、会话失效与返回刷新',async({browser},info)=>{
 const run='ui19_'+randomUUID().replaceAll('-','').slice(0,8),admin=await openPage(browser,contexts),member=await openPage(browser,contexts),account={username:run,password:'Edge_'+randomUUID()+'!'}
 await login(admin,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')));const sku=await product(admin,run),memberId=await register(member,account.username,account.password);await address(member)
 await member.setViewportSize({width:375,height:812});await member.goto('/search');const search=member.getByRole('textbox',{name:'搜索商品',exact:true});await tabTo(member,search);await member.keyboard.type(run);await member.keyboard.press('Enter');await expect(member.locator('.product-card')).toHaveCount(1);await tabTo(member,member.locator('.product-card'));await member.keyboard.press('Enter')
 await tabTo(member,member.getByRole('button',{name:'加购并前往购物车',exact:true}));await member.keyboard.press('Enter');await expect(member).toHaveURL(/\/cart$/);const checked=member.getByRole('checkbox',{name:'勾选 SKU '+sku,exact:true});await tabTo(member,checked);await member.keyboard.press('Space');await expect(checked).not.toBeChecked();await expect(checked).toBeEnabled();await tabTo(member,checked);await member.keyboard.press('Space');await expect(checked).toBeChecked();await expect(checked).toBeEnabled();await fits(member)
 await tabTo(member,member.getByRole('button',{name:'结算已选商品',exact:true}));await member.keyboard.press('Enter');await expect(member.getByRole('button',{name:'提交订单',exact:true})).toBeEnabled();await fits(member)
 await member.reload();await expect(member.getByRole('button',{name:'提交订单',exact:true})).toBeEnabled();expect(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_order_submit WHERE member_id=${memberId}`)).toBe('1')
 const other=await member.context().newPage();await other.goto(member.url());await expect(other.getByRole('button',{name:'提交订单',exact:true})).toBeEnabled()
 const [first,second]=await Promise.all([submit(member),submit(other)]);expect(first.orderSn).toBe(second.orderSn);expect(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_order WHERE member_id=${memberId}`)).toBe('1');expect(sql(`SELECT stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku}`)).toBe('1')
 await other.getByRole('button',{name:'退出登录',exact:true}).click();await member.getByRole('button',{name:'查询原提交',exact:true}).click();await expect(member).toHaveURL(/\/login\?redirect=/);await signIn(member,account);await expect(member).toHaveURL(/\/checkout\?confirmation=/);await expect(member.getByText('订单号： '+first.orderSn,{exact:true})).toBeVisible()
 await member.getByRole('link',{name:'查看购物车',exact:true}).click();await member.goBack();await member.reload();await expect(member.getByText('订单号： '+first.orderSn,{exact:true})).toBeVisible();await payment(member);await member.getByRole('link',{name:'返回订单（不付款）',exact:true}).click()
 await tabTo(member,member.getByRole('link',{name:'我的订单',exact:true}).first());await member.keyboard.press('Enter');await tabTo(member,member.getByRole('button',{name:'取消待付款订单',exact:true}));await member.keyboard.press('Enter');const confirm=member.getByRole('button',{name:'确认取消',exact:true});await tabTo(member,confirm);const box=await confirm.boundingBox();expect(box.x>=0&&box.x+box.width<=376).toBe(true);await member.keyboard.press('Enter')
 await expect.poll(async()=>(await json(member,`/api/order/mine/${first.orderSn}/payment-status`)).payment.order.inventoryStatus).toBe(2);expect(sql(`SELECT stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id=${sku}`)).toBe('10\t0');await fits(member);await member.screenshot({path:info.outputPath('edge-mobile-keyboard.png'),fullPage:true})
 await other.goto('/checkout');await expect(other.getByRole('heading',{name:'已关闭',exact:true})).toBeVisible();expect(sql(`SELECT COUNT(*) FROM gulimall_oms_test.oms_order WHERE member_id=${memberId}`)).toBe('1')
 save(info,{run,sku,memberId,orderSn:first.orderSn,browserVersion:browser.version(),duplicateTabs:true,serverSessionInvalidatedByLogout:true,reloginPreservedSubmission:true,backRefresh:true,mobileKeyboard:true})
})
