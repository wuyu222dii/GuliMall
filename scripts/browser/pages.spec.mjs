import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {register,json,login,sql,openPage,closeContexts,fits} from './helpers.mjs'
import {readFileSync} from 'node:fs'
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
test('商品创建：响应丢失、刷新恢复、原请求查询及离开确认',async({browser})=>{
 const page=await openPage(browser,contexts),name='创建防重 '+randomUUID()
 await login(page,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
 await page.getByRole('link',{name:'新建商品',exact:true}).click();await page.getByRole('button',{name:'填入双 SKU 示例',exact:true}).click();await page.getByLabel('商品名称',{exact:true}).fill(name)
 await page.route('**/api/admin/product/spuinfo/editor',async route=>{await route.fetch();await route.abort('failed')})
 await page.getByRole('button',{name:'保存商品与 SKU',exact:true}).click();await expect(page.getByRole('button',{name:'查询原创建结果',exact:true})).toBeEnabled();await expect(page.getByLabel('商品名称',{exact:true})).toBeDisabled()
 const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gulimall-product-creation')))
 expect(pending.requestId).toMatch(/^[a-f0-9-]{36}$/);expect(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_spu_info WHERE creation_request_id='${pending.requestId}'`)).toBe('1')
 await page.unroute('**/api/admin/product/spuinfo/editor')
 page.once('dialog',d=>d.accept());await page.reload();await expect(page.getByRole('button',{name:'查询原创建结果',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'重试原商品创建',exact:true}).click();await expect(page).toHaveURL(/\/admin\/products\/\d+\/edit$/)
 expect(sql(`SELECT COUNT(*) FROM gulimall_pms_test.pms_spu_info WHERE creation_request_id='${pending.requestId}'`)).toBe('1')
 const found=await json(page,'/api/admin/product/spuinfo/creation/'+pending.requestId);expect(found.found).toBe(true);expect((await json(page,'/api/admin/product/spuinfo/editor/'+found.id)).product.skus).toHaveLength(2)
 await page.getByLabel('商品名称',{exact:true}).fill(name+' 未保存')
 await page.getByRole('link',{name:'返回列表',exact:true}).click();await expect(page.getByRole('alertdialog',{name:'离开商品编辑确认',exact:true})).toBeVisible();await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page.getByLabel('商品名称',{exact:true})).toHaveValue(name+' 未保存')
 await page.getByRole('link',{name:'返回列表',exact:true}).click();await page.getByRole('button',{name:'确认离开',exact:true}).click();await expect(page).toHaveURL(/\/admin\/products$/)
})
