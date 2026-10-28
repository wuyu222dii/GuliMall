import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {json,register,openPage,closeContexts,fits} from './helpers.mjs'
let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))

test('交付回归：分类读取失败不冒充空结果，恢复后键盘和窄屏仍可用',async({browser},info)=>{
 const page=await openPage(browser,contexts);await page.setViewportSize({width:375,height:812})
 await page.route('**/api/product/categories',route=>route.abort('failed'));await page.goto('/#all-categories')
 await expect(page.getByRole('alert').filter({hasText:'分类查询失败'})).toBeVisible();await expect(page.getByText('暂无分类数据',{exact:true})).toHaveCount(0);await expect(page.getByText('暂无分类数据。',{exact:true})).toHaveCount(0)
 await page.unroute('**/api/product/categories');await page.getByRole('button',{name:'重试分类',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'分类查询失败'})).toHaveCount(0)
 const root=page.locator('#all-categories').getByText('演示数码',{exact:true});await expect(root).toBeVisible();await root.focus();await root.press('Enter');await expect(page.locator('#all-categories').getByRole('link',{name:'智能手机',exact:true})).toBeVisible();await fits(page);await page.screenshot({path:info.outputPath('category-failure-recovered-mobile.png')})
})

test('交付回归：空表单不误拦，脏表单明确退出后会话失效且不留地址草稿',async({browser},info)=>{
 const page=await openPage(browser,contexts),name='退出31 '+randomUUID().slice(0,8),id=await register(page,'h31_'+randomUUID().replaceAll('-','').slice(0,10))
 await page.getByRole('link',{name:'收货地址',exact:true}).click();await page.getByRole('button',{name:'新增地址',exact:true}).click();await page.getByRole('button',{name:'取消编辑',exact:true}).click();await expect(page.getByRole('alertdialog',{name:'未保存内容确认',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'新增地址',exact:true}).click();await page.getByLabel('收件人',{exact:true}).fill(name);await page.setViewportSize({width:375,height:812});let sent=0
 page.on('request',request=>{if(request.url().endsWith('/api/auth/logout')&&request.method()==='POST')sent++})
 await page.getByRole('button',{name:'退出登录',exact:true}).click();const dialog=page.getByRole('alertdialog',{name:'未保存内容确认',exact:true});await expect(dialog).toBeVisible();expect(sent).toBe(0);expect((await json(page,'/api/auth/me')).user.id).toBe(id)
 await dialog.getByRole('button',{name:'确认放弃并继续',exact:true}).click();await expect(page.getByRole('link',{name:'你好，请登录',exact:true})).toBeVisible();await expect(page).toHaveURL('http://127.0.0.1:8080/');expect(sent).toBe(1)
 expect((await page.request.get('/api/auth/me')).status()).toBe(401);expect((await page.request.get('/api/order/mine')).status()).toBe(401);expect(await page.evaluate(text=>![...Object.values(localStorage),...Object.values(sessionStorage)].some(v=>v.includes(text)),name)).toBe(true)
 await page.goto('/member/address');await expect(page).toHaveURL(/\/login\?redirect=/);await fits(page);await page.screenshot({path:info.outputPath('logout-protected-mobile.png')})
})
