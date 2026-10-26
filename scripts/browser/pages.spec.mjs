import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {register,json,openPage,closeContexts,fits} from './helpers.mjs'
let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
test('地址维护：编辑、默认、删除、分页及窄屏',async({browser},info)=>{
 const page=await openPage(browser,contexts),run='addr_'+randomUUID().replaceAll('-','').slice(0,8)
 await register(page,run);await page.getByRole('link',{name:'收货地址',exact:true}).click()
 const create=async(name)=>{
  await page.getByRole('button',{name:'新增地址',exact:true}).click()
  for(const[label,value]of Object.entries({'收件人':name,'手机号':'13800000001','省份':'浙江省','城市':'杭州市','区县':'西湖区','详细地址':'测试地址22号'}))await page.getByLabel(label,{exact:true}).fill(value)
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('收货地址已保存。',{exact:true})).toBeVisible()
 }
 await create('地址一');await create('地址二')
 const addresses=(await json(page,'/api/member/addresses')).page.list,id=addresses[0].id
 await page.getByRole('button',{name:'编辑地址 '+id,exact:true}).click();await page.getByLabel('详细地址',{exact:true}).fill('编辑后的地址22号');await page.getByRole('checkbox',{name:'设为默认地址',exact:true}).check();await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('编辑后的地址22号',{exact:false})).toBeVisible()
 const other=addresses[1].id;await page.getByRole('button',{name:'设为默认地址 '+other,exact:true}).click();await expect(page.getByText('默认地址已更新。',{exact:true})).toBeVisible();expect((await json(page,'/api/member/addresses')).page.list[0].id).toBe(other)
 await page.setViewportSize({width:375,height:812});await fits(page)
 await page.getByRole('button',{name:'删除地址 '+other,exact:true}).click();await page.getByRole('button',{name:'取消删除',exact:true}).click();await expect(page.getByRole('button',{name:'删除地址 '+other,exact:true})).toBeVisible()
 await page.getByRole('button',{name:'删除地址 '+other,exact:true}).click();await page.getByRole('button',{name:'确认删除地址',exact:true}).click();await expect(page.getByText('地址已删除。',{exact:true})).toBeVisible()
 expect((await json(page,'/api/member/addresses')).page.list.every(a=>a.defaultStatus===0)).toBe(true)
 await page.goto('/product/900001');await page.getByRole('button',{name:'立即购买',exact:true}).click();await page.getByRole('button',{name:'结算已选商品',exact:true}).click()
 await expect(page.getByRole('button',{name:'提交订单',exact:true})).toBeDisabled();await page.getByRole('radio').first().check();await expect(page.getByRole('button',{name:'提交订单',exact:true})).toBeEnabled()
 const confirmation=page.url();await page.goto('/member/address');await page.getByRole('button',{name:'删除地址 '+id,exact:true}).click();await page.getByRole('button',{name:'确认删除地址',exact:true}).click();await expect(page.getByText('地址已删除。',{exact:true})).toBeVisible()
 await page.goto(confirmation);await expect(page.getByRole('button',{name:'提交订单',exact:true})).toBeDisabled();await page.goto('/member/address')
 // Create the remaining rows through real APIs; page operations above cover the form itself.
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken
 for(let i=0;i<11;i++)expect((await page.request.post('/api/member/addresses',{headers:{'X-CSRF-Token':csrf},data:{name:'分页地址'+i,phone:'13800000001',detailAddress:'测试地址',defaultStatus:0}})).status()).toBe(200)
 await page.getByRole('button',{name:'刷新地址',exact:true}).click();await expect(page.getByRole('button',{name:'下一页',exact:true})).toBeEnabled();await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.address-item')).toHaveCount(1);await fits(page)
 await page.screenshot({path:info.outputPath('address-mobile.png'),fullPage:true})
})
