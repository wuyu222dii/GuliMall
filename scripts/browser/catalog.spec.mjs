import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {json,login,register,openPage,closeContexts,fits} from './helpers.mjs'
let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
const account=()=>JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8'))
async function create(page,kind,data){const csrf=(await json(page,'/api/auth/csrf')).csrfToken,r=await page.request.post('/api/admin/product/admin/catalog/'+kind,{headers:{'X-CSRF-Token':csrf},data});expect(r.status()).toBe(200);return(await r.json()).id}
const row=(page,id)=>page.locator('.admin-table tbody tr').filter({has:page.getByRole('cell',{name:new RegExp('^'+id+'(?: · 当前定位)?$')})})
async function query(page,key,filters={}){await page.getByLabel('查询名称或编号',{exact:true}).fill(String(key));for(const[label,value]of Object.entries(filters))await page.getByLabel(label,{exact:true}).selectOption(String(value));await page.getByRole('button',{name:'查询资料',exact:true}).click()}
async function tab(page,label){await page.getByRole('group',{name:'基础资料类型',exact:true}).getByRole('button',{name:label,exact:true}).click()}

test('基础资料查询：四类分页、分类路径、保存定位和引用删除保护',async({browser},info)=>{
 const page=await openPage(browser,contexts),label='资料29 '+randomUUID().slice(0,12),ids={categories:[],brands:[],groups:[],attrs:[]};await login(page,account())
 for(let i=0;i<21;i++)ids.categories.push(await create(page,'categories',{name:label+' 分类 '+i,catLevel:1,parentCid:0,sort:0}))
 const parent=await create(page,'categories',{name:label+' 二级',catLevel:2,parentCid:ids.categories[0],sort:0}),leaf=await create(page,'categories',{name:label+' 三级',catLevel:3,parentCid:parent,sort:0})
 for(let i=0;i<21;i++){
  ids.brands.push(await create(page,'brands',{name:label+' 品牌 '+i,firstLetter:'P',sort:0,showStatus:1}))
  ids.groups.push(await create(page,'groups',{attrGroupName:label+' 分组 '+i,catelogId:900003,sort:0}))
  ids.attrs.push(await create(page,'attrs',{attrName:label+' 属性 '+i,catelogId:900003,attrType:0,enable:0}))
 }
 await create(page,'brands',{name:label+' 品牌 隐藏',firstLetter:'P',sort:0,showStatus:0});await create(page,'groups',{attrGroupName:label+' 分组 其他分类',catelogId:leaf,sort:0})
 await create(page,'attrs',{attrName:label+' 属性 基础',catelogId:900003,attrType:1,enable:1,attrGroupId:900001});await create(page,'attrs',{attrName:label+' 属性 其他分类',catelogId:leaf,attrType:0,enable:0})
 const seed=(await json(page,'/api/product/items/900001')).item
 await page.goto('/admin/products/catalog');await query(page,leaf);await expect(row(page,leaf)).toContainText(label+' 分类 0 / '+label+' 二级 / '+label+' 三级');await expect(row(page,leaf)).toContainText('父分类 #'+parent)
 const kinds=[['categories','分类',{}],['brands','品牌',{'筛选资料状态':'1'}],['groups','属性分组',{'筛选所属分类':'900003'}],['attrs','属性',{'筛选所属分类':'900003','筛选资料状态':'0','筛选属性类型':'0'}]]
 for(const[kind,name,filters]of kinds){
  await tab(page,name);const word=label+' '+(kind==='groups'?'分组':name);await query(page,word,filters);await expect(page.locator('.admin-table tbody tr')).toHaveCount(20);await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
  const id=ids[kind].at(-1);await row(page,id).getByRole('button',{name:'编辑',exact:true}).click();const renamed=kind==='brands'?'筛选外 '+label:word+' 已修改'
  await page.getByLabel(name+'名称',{exact:true}).fill(renamed);await page.getByRole('button',{name:'保存基础资料',exact:true}).click();await expect(page.getByText(name+'已保存。',{exact:true})).toBeVisible();await expect(row(page,id)).toContainText(renamed);await expect(row(page,id)).toContainText('当前定位');await expect(page.getByRole('status').filter({hasText:'已定位'+name+' #'+id})).toBeVisible()
  await expect(page.getByLabel('查询名称或编号',{exact:true})).toHaveValue(kind==='brands'?'':word)
  await page.getByRole('button',{name:'清除资料条件',exact:true}).click();await query(page,id);await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);await expect(row(page,id)).toContainText(renamed)
 }
 for(const[kind,name]of kinds){
  await tab(page,name);await query(page,900001);await row(page,900001).getByRole('button',{name:'删除',exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/catalog/'+kind+'/900001')&&r.request().method()==='DELETE');await page.getByRole('button',{name:'确认删除',exact:true}).click();expect((await response).status()).toBe(409);await expect(page.getByRole('alert')).toContainText('不能删除');await expect(row(page,900001)).toBeVisible()
 }
 expect((await json(page,'/api/product/items/900001')).item).toEqual(seed)
 const meta=(await json(page,'/api/admin/product/admin/catalog')).data
 for(const kind of ['brands','groups','attrs'])expect(meta[kind].filter(r=>ids[kind].includes(r[{brands:'brandId',groups:'attrGroupId',attrs:'attrId'}[kind]]))).toHaveLength(21)
 const member=await openPage(browser,contexts);await register(member,'c29_'+randomUUID().replaceAll('-','').slice(0,12));expect((await member.request.get('/api/admin/product/admin/catalog')).status()).toBe(403);const csrf=(await json(member,'/api/auth/csrf')).csrfToken;expect((await member.request.delete('/api/admin/product/admin/catalog/brands/900001',{headers:{'X-CSRF-Token':csrf}})).status()).toBe(403)
 await page.setViewportSize({width:375,height:812});await tab(page,'属性');await query(page,label+' 属性',{'筛选所属分类':'900003','筛选资料状态':'0','筛选属性类型':'0'});await expect(page.locator('.admin-table tbody tr')).toHaveCount(20);await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1);await fits(page);await page.screenshot({path:info.outputPath('catalog-filters-mobile.png'),fullPage:true})
})

test('基础资料删除：末页回退、已删除后刷新失败、重复点击与未知结果核对',async({browser},info)=>{
 const page=await openPage(browser,contexts),label='删除29 '+randomUUID().slice(0,12),ids=[];await login(page,account())
 for(let i=0;i<21;i++)ids.push(await create(page,'brands',{name:label+' '+i,firstLetter:'D',sort:0,showStatus:1}))
 await page.goto('/admin/products/catalog');await tab(page,'品牌');await query(page,label);await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 await page.setViewportSize({width:375,height:812});await row(page,ids.at(-1)).getByRole('button',{name:'删除',exact:true}).click();await page.route('**/api/admin/product/admin/catalog',route=>route.abort('failed'));await page.getByRole('button',{name:'确认删除',exact:true}).click()
 await expect(page.getByText('品牌已删除。',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('删除已确认，但列表刷新失败');await expect(page.getByLabel('品牌名称',{exact:true})).toBeDisabled();await expect(page.getByText('当前显示上次成功加载的基础资料，重新加载成功前暂停修改。',{exact:true})).toBeVisible()
 await page.unroute('**/api/admin/product/admin/catalog');await page.getByRole('button',{name:'重新加载资料',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(20);await expect(page.getByLabel('查询名称或编号',{exact:true})).toHaveValue(label);await expect(page.getByText('第 1 / 1 页',{exact:true})).toBeVisible();await expect(row(page,ids.at(-1))).toHaveCount(0)
 const id=ids.at(-2),path='**/api/admin/product/admin/catalog/brands/'+id;let sent=0
 await page.route(path,async route=>{sent++;await route.fetch();await route.abort('failed')});await row(page,id).getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:'确认删除',exact:true}).evaluate(button=>{button.click();button.click()})
 await expect(page.getByRole('alert')).toContainText('删除结果请重新加载核对');expect(sent).toBe(1);await expect(page.getByText('品牌已删除。',{exact:true})).toHaveCount(0);await expect(page.getByLabel('品牌名称',{exact:true})).toBeDisabled()
 await page.unroute(path);await page.getByRole('button',{name:'重新加载资料',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(19);await expect(page.getByText('最新资料中未找到原编号 #'+id+'，请核对结果；未自动重发原操作。',{exact:true})).toBeVisible();expect(sent).toBe(1);expect((await json(page,'/api/admin/product/admin/catalog')).data.brands.some(b=>b.brandId===id)).toBe(false)
 await query(page,'不存在 '+label);await expect(page.getByText('没有匹配的资料，请调整条件或新增。',{exact:true})).toBeVisible();await page.getByRole('button',{name:'清除资料条件',exact:true}).click();await fits(page);await page.screenshot({path:info.outputPath('catalog-delete-mobile.png'),fullPage:true})
})
