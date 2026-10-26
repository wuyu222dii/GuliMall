import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {assertRestoreEnvironment,restoreSql,docker} from '../demo-restore-guard.mjs'
import {json,login,signIn,register,openPage,closeContexts} from './helpers.mjs'
import {orderStatuses} from '../../gulimall-web/src/utils/payment.js'
let contexts=[]
test.afterEach(async({},info)=>closeContexts(contexts,info))
test('Demo 冷恢复：原交易可读、完整模拟交易及持久释放意图',async({browser},info)=>{
 contexts=[];const ctx=assertRestoreEnvironment(),sql=query=>restoreSql(ctx,query),file=name=>join(ctx.source,'.tools',name),fixture=JSON.parse(readFileSync(file('restore-fixture.json'),'utf8')),phase=process.env.GULIMALL_DEMO_RESTORE_PHASE
 const admin=await openPage(browser,contexts),member=await openPage(browser,contexts)
 await login(admin,JSON.parse(readFileSync(file('restore-admin.json'),'utf8')));await admin.goto('/admin/orders')
 const originals=JSON.parse(readFileSync(file('original-state.json'),'utf8')).orders
 for(const original of originals){
  await admin.getByLabel('完整订单号',{exact:true}).fill(original.sn);await admin.getByRole('button',{name:'查询订单',exact:true}).click();await admin.getByRole('row').filter({hasText:original.sn}).getByRole('button',{name:'详情 / 物流',exact:true}).click()
  const current=(await json(admin,`/api/admin/order/order/info/${original.id}`)).order;await expect(admin.getByRole('heading',{name:/订单详情/})).toContainText(orderStatuses[current.status]);expect(Number(current.payAmount)).toBe(Number(original.amount))
 }
 if(phase==='prepare'){
  const account={username:fixture.run,password:'Restore_'+randomUUID()+'!'};fixture.memberId=await register(member,account.username,account.password);writeFileSync(file('restore-member.json'),JSON.stringify(account)+'\n')
  await member.getByRole('link',{name:'收货地址',exact:true}).click();await member.getByRole('button',{name:'新增地址',exact:true}).click()
  for(const[name,value]of Object.entries({'收件人':'恢复模拟会员','手机号':'13800000001','省份':'浙江省','城市':'杭州市','区县':'西湖区','详细地址':'恢复副本验收20号'}))await member.getByLabel(name,{exact:true}).fill(value)
  await member.getByRole('checkbox',{name:'设为默认地址',exact:true}).check();await member.getByRole('button',{name:'保存',exact:true}).click();await expect(member.getByText('恢复副本验收20号',{exact:false})).toBeVisible()
 }else{
  await member.goto('/login?redirect=%2Fmember%2Forders');await signIn(member,JSON.parse(readFileSync(file('restore-member.json'),'utf8')));await expect(member.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();await expect(member.getByRole('heading',{name:'已关闭',exact:true})).toBeVisible();await expect(member.getByText(/恢复模拟会员/)).toHaveCount(2)
 }
 await member.goto('/search?keyword='+fixture.run);await expect(member.locator('.product-card')).toHaveCount(1);await member.locator('.product-card').click();await member.getByRole('button',{name:'立即购买',exact:true}).click();await member.getByRole('button',{name:'结算已选商品',exact:true}).click()
 const submit=async()=>{const pending=member.waitForResponse(r=>r.url().endsWith('/mine/submit')&&r.request().method()==='POST');await member.getByRole('button',{name:'提交订单',exact:true}).click();const r=await pending;expect(r.status()).toBe(200);return(await r.json()).result.order}
 const order=await submit();expect(Number(order.payAmount)).toBe(0.10)
 await member.getByRole('link',{name:'付款 / 库存状态',exact:true}).click();await member.getByRole('button',{name:'打开模拟付款',exact:true}).click();await expect(member.getByText(/不使用真实资金或账号/)).toBeVisible();await member.getByRole('button',{name:'确认模拟付款',exact:true}).click();await expect.poll(async()=>(await json(member,`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.fulfillmentReady).toBe(true)
 await admin.getByLabel('完整订单号',{exact:true}).fill(order.orderSn);await admin.getByRole('button',{name:'查询订单',exact:true}).click();await admin.getByRole('row').filter({hasText:order.orderSn}).getByRole('button',{name:'详情 / 物流',exact:true}).click();await admin.getByLabel('物流公司',{exact:true}).fill('恢复副本模拟物流');await admin.getByLabel('运单号',{exact:true}).fill('RESTORE20-'+order.id);await admin.getByRole('button',{name:'确认发货',exact:true}).click();await expect(admin.getByText(/发货已确认/)).toBeVisible()
 await member.goto('/member/orders');const row=member.locator('.order-summary').filter({hasText:order.orderSn});await row.getByRole('button',{name:'确认收货',exact:true}).click();await row.getByRole('button',{name:'确认已收到包裹',exact:true}).click();await expect(row.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();await member.screenshot({path:info.outputPath('restore-'+phase+'-completed.png'),fullPage:true})
 if(phase==='prepare'){
  fixture.completed=order.orderSn;await member.goto('/product/'+fixture.sku);await member.getByRole('button',{name:'立即购买',exact:true}).click();await member.getByRole('button',{name:'结算已选商品',exact:true}).click();await member.getByRole('button',{name:'开始下一次确认',exact:true}).click();const pending=await submit();fixture.pending=pending.orderSn
  await member.getByRole('link',{name:'付款 / 库存状态',exact:true}).click();await member.getByRole('button',{name:'打开模拟付款',exact:true}).click();await member.getByRole('link',{name:'返回订单（不付款）',exact:true}).click()
  assertRestoreEnvironment();docker(['compose','stop','rabbitmq'])
  await member.goto('/member/orders');const cancel=member.locator('.order-summary').filter({hasText:pending.orderSn});await cancel.getByRole('button',{name:'取消待付款订单',exact:true}).click();await cancel.getByRole('button',{name:'确认取消',exact:true}).click();await expect(cancel.getByRole('heading',{name:'已关闭',exact:true})).toBeVisible()
  expect(sql(`SELECT status,inventory_status FROM gulimall_oms_demo.oms_order WHERE order_sn='${pending.orderSn}'`)).toBe('4\t0');expect(sql(`SELECT stock,stock_locked FROM gulimall_wms_demo.wms_ware_sku WHERE sku_id=${fixture.sku}`)).toBe('4\t1')
 }else fixture.afterRecovery=order.orderSn
 writeFileSync(file('restore-fixture.json'),JSON.stringify(fixture,null,2)+'\n')
})
