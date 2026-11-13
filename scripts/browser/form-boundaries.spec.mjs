import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {openPage,closeContexts,register,login,json,fits} from './helpers.mjs'

let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
const dialog=page=>page.getByRole('alertdialog',{name:'未保存内容确认',exact:true})
async function brand(browser){
 const page=await openPage(browser,contexts);await login(page,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken,name='品牌边界 '+randomUUID()
 const response=await page.request.post('/api/admin/product/admin/catalog/brands',{headers:{'X-CSRF-Token':csrf},data:{name,firstLetter:'A',logo:'',sort:0,showStatus:1}})
 expect(response.status()).toBe(200);const id=(await response.json()).id
 await page.goto('/admin/products/catalog?kind=brands&key='+encodeURIComponent(name));await page.getByRole('row').filter({hasText:name}).getByRole('button',{name:'编辑',exact:true}).click()
 await expect(page.getByLabel('品牌名称',{exact:true})).toHaveValue(name);return {page,id,name}
}
async function rejectReload(page){
 const pending=page.waitForEvent('dialog');await page.evaluate(()=>{setTimeout(()=>location.reload(),0)})
 const warning=await pending;expect(warning.type()).toBe('beforeunload');await warning.dismiss()
}

test('地址新增丢响应：冻结原输入、刷新核对、显式结束及账号边界',async({browser},info)=>{
 const page=await openPage(browser,contexts),name='未知地址 '+randomUUID().slice(0,8),address='独立测试地址36号'
 await register(page,'a36_'+randomUUID().replaceAll('-','').slice(0,8));await page.goto('/member/address');await page.getByRole('button',{name:'新增地址',exact:true}).click()
 for(const[label,value]of Object.entries({'收件人':name,'手机号':'13800000001','省份':'浙江省','城市':'杭州市','区县':'西湖区','详细地址':address}))await page.getByLabel(label,{exact:true}).fill(value)
 let creates=0
 await page.route('**/api/member/addresses',async route=>{if(route.request().method()!=='POST')return route.continue();creates++;if(creates===1)return route.continue({postData:JSON.stringify({...route.request().postDataJSON(),defaultStatus:2})});const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed')})
 await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('alert')).toContainText('默认地址状态不正确');await expect(page.getByLabel('收件人',{exact:true})).toBeEnabled();await expect(page.getByLabel('收件人',{exact:true})).toHaveValue(name);expect((await json(page,'/api/member/addresses')).page.list).toHaveLength(0)
 await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByRole('alert')).toContainText('新增结果尚未确认')
 for(const label of ['收件人','手机号','省份','城市','区县','详细地址'])await expect(page.getByLabel(label,{exact:true})).toBeDisabled()
 await expect(page.getByRole('checkbox',{name:'设为默认地址',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'保存',exact:true})).toBeDisabled()
 await page.getByRole('button',{name:'刷新地址',exact:true}).click();await expect(page.locator('.address-item')).toHaveCount(1);await expect(page.getByLabel('收件人',{exact:true})).toHaveValue(name)
 const saved=(await json(page,'/api/member/addresses')).page.list;expect(saved).toHaveLength(1);expect(saved[0].name).toBe(name);expect(saved[0].detailAddress).toBe(address);expect(creates).toBe(2)
 expect(await page.evaluate(value=>[localStorage,sessionStorage].some(s=>Object.values(s).some(v=>v.includes(value))),name)).toBe(false)
 await rejectReload(page);await expect(page.getByLabel('收件人',{exact:true})).toHaveValue(name)
 await page.setViewportSize({width:375,height:812});await page.getByRole('link',{name:'收货地址',exact:true}).focus();await page.getByRole('button',{name:'退出登录',exact:true}).click()
 await expect(dialog(page)).toBeVisible();await fits(page);await page.keyboard.press('Escape');expect((await page.request.get('/api/auth/me')).status()).toBe(200)
 await page.screenshot({path:info.outputPath('address-unknown-mobile.png'),fullPage:true,mask:[page.locator('input')]})
 await page.getByRole('button',{name:'已核对，放弃本次表单',exact:true}).click();await expect(page.locator('.address-form')).toHaveCount(0)
 await page.getByRole('button',{name:'新增地址',exact:true}).click();await expect(page.getByLabel('收件人',{exact:true})).toHaveValue('');await expect(page.getByLabel('收件人',{exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(page.getByRole('button',{name:'退出登录',exact:true})).toHaveCount(0);await expect(dialog(page)).toHaveCount(0)
 await register(page,'b36_'+randomUUID().replaceAll('-','').slice(0,8));await page.goto('/member/address');await expect(page.getByText('暂无收货地址',{exact:true})).toBeVisible();await expect(page.locator('.address-form')).toHaveCount(0)
})

test('干净品牌上传中：离开退出刷新被保护，失败可恢复，窄屏键盘可用',async({browser},info)=>{
 const {page,id,name}=await brand(browser),originalUrl=page.url();let release,entered,logouts=0
 const pause=new Promise(r=>release=r),pending=new Promise(r=>entered=r)
 page.on('request',r=>{if(r.url().endsWith('/api/auth/logout')&&r.method()==='POST')logouts++})
 await page.route('**/api/admin/thirdparty/images',async route=>{entered();await pause;await route.continue()})
 try{
  await page.getByLabel('上传品牌图片',{exact:true}).setInputFiles('scripts/fixtures/upload.png');await pending
  await page.getByRole('link',{name:'订单',exact:true}).click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true})).toBeDisabled();expect(page.url()).toBe(originalUrl)
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(dialog(page)).toBeVisible();expect(logouts).toBe(0);expect((await page.request.get('/api/auth/me')).status()).toBe(200)
  await page.setViewportSize({width:375,height:812});await fits(page);await expect(dialog(page).getByRole('button',{name:'继续编辑',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(dialog(page).getByRole('button',{name:'继续编辑',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(dialog(page)).toHaveCount(0)
  await rejectReload(page)
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/admin/thirdparty/images')&&r.request().method()==='POST');release();expect((await uploaded).status()).toBe(200)
  await expect(page.getByLabel('品牌图片地址',{exact:true})).toHaveValue(/^\/api\/media\//);await page.unroute('**/api/admin/thirdparty/images')
  await page.getByRole('link',{name:'订单',exact:true}).click();await expect(dialog(page)).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByLabel('品牌图片地址',{exact:true})).toHaveValue(/^\/api\/media\//)
  await page.getByRole('button',{name:'保存基础资料',exact:true}).click();await expect(page.getByText('品牌已保存。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'保存基础资料',exact:true})).toBeEnabled();expect(logouts).toBe(0)
  const persisted=(await json(page,'/api/admin/product/admin/catalog')).data.brands.find(b=>b.brandId===id);expect(persisted.logo).toMatch(/^\/api\/media\//)
  const row=page.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})});await row.getByRole('button',{name:'编辑',exact:true}).click()
  const failed=page.waitForResponse(r=>r.url().endsWith('/api/admin/thirdparty/images')&&r.request().method()==='POST');await page.getByLabel('上传品牌图片',{exact:true}).setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});expect((await failed).status()).toBe(400)
  await expect(page.getByLabel('品牌图片地址',{exact:true})).toBeEnabled();await expect(page.getByLabel('品牌图片地址',{exact:true})).toHaveValue(persisted.logo)
  await page.screenshot({path:info.outputPath('brand-upload-mobile.png'),fullPage:true,mask:[page.locator('input')]})
  await page.getByRole('link',{name:'订单',exact:true}).click();await expect(page).toHaveURL(/\/admin\/orders/);await expect(dialog(page)).toHaveCount(0)
 }finally{release()}
})

test('干净品牌保存中：先等待结果再退出，只读加载和空闲表单不误拦',async({browser})=>{
 const {page,name}=await brand(browser);let release,entered,logouts=0
 const pause=new Promise(r=>release=r),pending=new Promise(r=>entered=r)
 page.on('request',r=>{if(r.url().endsWith('/api/auth/logout')&&r.method()==='POST')logouts++})
 await page.route('**/api/admin/product/admin/catalog/brands',async route=>{entered();await pause;await route.continue()})
 try{
  await page.getByRole('button',{name:'保存基础资料',exact:true}).click();await pending;await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true})).toBeDisabled();expect(logouts).toBe(0)
  await page.keyboard.press('Escape');await page.getByRole('link',{name:'返回商品列表',exact:true}).click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true})).toBeDisabled();await rejectReload(page)
  release();await expect(page.getByText('品牌已保存。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'保存基础资料',exact:true})).toBeEnabled();await expect(dialog(page)).toHaveCount(0);expect(logouts).toBe(0)
  await page.unroute('**/api/admin/product/admin/catalog/brands');const row=page.getByRole('row').filter({has:page.getByRole('cell',{name,exact:true})});await row.getByRole('button',{name:'编辑',exact:true}).click()
  await page.getByLabel('品牌名称',{exact:true}).fill('未保存品牌 '+randomUUID());await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(dialog(page)).toBeVisible();await page.keyboard.press('Escape');expect(logouts).toBe(0)
  await page.getByRole('button',{name:'退出登录',exact:true}).click();await dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true}).click();await expect.poll(()=>logouts).toBe(1);await expect.poll(async()=>(await page.request.get('/api/auth/me')).status()).toBe(401)
  await login(page,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
  let releaseRead,enteredRead;const readPause=new Promise(r=>releaseRead=r),reading=new Promise(r=>enteredRead=r)
  await page.route('**/api/admin/product/admin/catalog/brands/page?*',async route=>{enteredRead();await readPause;await route.continue()})
  try{await page.goto('/admin/products/catalog?kind=brands');await reading;await page.getByRole('link',{name:'订单',exact:true}).click();await expect(page).toHaveURL(/\/admin\/orders/);await expect(dialog(page)).toHaveCount(0)}finally{releaseRead()}
 }finally{release()}
})
