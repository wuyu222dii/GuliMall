import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {openPage,closeContexts,login,json,fits,sql} from './helpers.mjs'

let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
const dialog=page=>page.getByRole('alertdialog',{name:'未保存内容确认',exact:true})
async function administrator(browser){
 const page=await openPage(browser,contexts);await login(page,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken
 const post=async(path,data)=>{const r=await page.request.post('/api/admin/'+path,{headers:{'X-CSRF-Token':csrf},data});expect(r.status()).toBe(200);return r.json()}
 return {page,post}
}

test('采购完成输入：切单刷新筛选翻页退出均先确认，放弃不复活',async({browser},info)=>{
 const {page,post}=await administrator(browser)
 const ware=(await post('ware/wareinfo/save',{name:'完成保护 '+randomUUID(),address:'独立 Test'})).id,orders=[]
 for(let i=0;i<23;i++){const d=(await post('ware/purchasedetail/save',{skuId:900001,wareId:ware,skuNum:1,skuPrice:'0.00'})).id,p=(await post('ware/purchase/merge',{items:[d]})).purchaseId;await post('ware/purchase/received',[p]);orders.push({d,p})}
 const [a,b]=orders.slice(-2)
 const pendingDemand=(await post('ware/purchasedetail/save',{skuId:900001,wareId:ware,skuNum:1,skuPrice:'0.00'})).id,unreceived=(await post('ware/purchase/merge',{items:[pendingDemand]})).purchaseId
 await page.goto('/admin/procurement');await page.getByRole('button',{name:'采购单',exact:true}).click()
 await page.getByLabel('查找仓库选项',{exact:true}).fill(String(ware));await page.getByRole('button',{name:'查询仓库选项',exact:true}).click();await page.getByLabel('按仓库筛选',{exact:true}).selectOption(String(ware))
 const row=id=>page.getByRole('row').filter({has:page.getByRole('cell',{name:String(id),exact:true})}),open=id=>row(id).getByRole('button',{name:'查看明细',exact:true}).click()
 const result=id=>page.getByLabel('需求 '+id+' 完成结果',{exact:true}),reason=page.getByLabel('失败原因',{exact:true})
 await open(a.p);await expect(result(a.d)).toHaveValue('3');await open(b.p);await expect(dialog(page)).toHaveCount(0)
 await open(a.p);await result(a.d).selectOption('4');await reason.fill('保留的失败原因')
 async function keep(action){await action();await expect(dialog(page)).toBeVisible();await dialog(page).getByRole('button',{name:'继续编辑',exact:true}).click();await expect(result(a.d)).toHaveValue('4');await expect(reason).toHaveValue('保留的失败原因')}
 await keep(()=>open(b.p));await keep(()=>row(unreceived).getByRole('button',{name:'领取',exact:true}).click());await keep(()=>page.getByRole('button',{name:'刷新数据',exact:true}).click())
 await keep(()=>page.getByLabel('按状态筛选',{exact:true}).selectOption('2'));await expect(page.getByLabel('按状态筛选',{exact:true})).toHaveValue('')
 await keep(()=>page.getByRole('button',{name:'下一页',exact:true}).click());await keep(()=>page.getByRole('button',{name:'库存',exact:true}).click())
 await keep(()=>page.getByRole('link',{name:'订单',exact:true}).click())
 await page.setViewportSize({width:375,height:812});await open(b.p);await expect(dialog(page)).toBeVisible();await fits(page);await page.keyboard.press('Escape');await expect(reason).toHaveValue('保留的失败原因')
 await open(b.p);await dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true}).click();await expect(result(b.d)).toHaveValue('3');await open(a.p);await expect(result(a.d)).toHaveValue('3');await expect(reason).toHaveCount(0)
 await result(a.d).selectOption('4');await reason.fill('保留的失败原因');let logouts=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/logout'))logouts++})
 await keep(()=>page.getByRole('button',{name:'退出登录',exact:true}).click());expect(logouts).toBe(0);expect((await page.request.get('/api/auth/me')).status()).toBe(200)
 await page.getByRole('button',{name:'退出登录',exact:true}).click();await dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true}).click();await expect.poll(()=>logouts).toBe(1);await expect.poll(async()=>(await page.request.get('/api/auth/me')).status()).toBe(401)
 expect(sql('SELECT status FROM gulimall_wms_test.wms_purchase WHERE id='+a.p+';')).toBe('2')
})

test('商品编辑：保存上传中阻止离开，退出先确认且只发一次',async({browser},info)=>{
 const {page,post}=await administrator(browser),label='商品保护 '+randomUUID()
 const id=(await post('product/spuinfo/editor',{spuName:label,spuDescription:'阶段33',catalogId:900003,brandId:900001,weight:'0.2',images:['/demo-product.svg'],decript:[],baseAttrs:[],skus:[{skuName:label,skuTitle:label,price:'1.00',images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:'标准'}]}]})).id
 await page.goto('/admin/products/'+id+'/edit');await page.getByLabel('商品名称',{exact:true}).fill(label+' 修改')
 let releaseSave,enteredSave;const saving=new Promise(r=>enteredSave=r),savePause=new Promise(r=>releaseSave=r)
 await page.route('**/api/admin/product/spuinfo/editor',async route=>{enteredSave();await savePause;await route.continue()})
 await page.getByRole('button',{name:'保存商品与 SKU',exact:true}).click();await saving;await page.getByRole('link',{name:'返回列表',exact:true}).click();await expect(dialog(page)).toBeVisible();await expect(dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true})).toBeDisabled()
 releaseSave();await expect(page.getByText('商品与 SKU 已保存；已上架商品已加入搜索同步队列，请在同步页面查看结果。',{exact:true})).toBeVisible();await expect(dialog(page)).toHaveCount(0);await page.unroute('**/api/admin/product/spuinfo/editor')
 let releaseUpload,enteredUpload;const uploading=new Promise(r=>enteredUpload=r),uploadPause=new Promise(r=>releaseUpload=r)
 await page.route('**/api/admin/thirdparty/images',async route=>{enteredUpload();await uploadPause;await route.continue()})
 await page.getByLabel('上传商品图片',{exact:true}).setInputFiles('scripts/fixtures/upload.png');await uploading;await page.getByRole('link',{name:'返回列表',exact:true}).click();await expect(dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true})).toBeDisabled()
 releaseUpload();await expect(page.getByText('图片已上传，可在各 SKU 中选择使用。',{exact:true})).toBeVisible();await dialog(page).getByRole('button',{name:'继续编辑',exact:true}).click();await page.unroute('**/api/admin/thirdparty/images')
 await page.getByRole('button',{name:'保存商品与 SKU',exact:true}).click();await expect(page.getByRole('button',{name:'保存商品与 SKU',exact:true})).toBeEnabled()
 await page.getByLabel('商品名称',{exact:true}).fill(label+' 未保存');let logouts=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/logout'))logouts++})
 await page.getByRole('button',{name:'退出登录',exact:true}).click();await expect(dialog(page)).toBeVisible();await page.keyboard.press('Escape');expect(logouts).toBe(0);expect((await page.request.get('/api/auth/me')).status()).toBe(200)
 if(info.project.name==='edge')await page.setViewportSize({width:375,height:812})
 await page.getByRole('button',{name:'退出登录',exact:true}).click();await fits(page);await page.screenshot({path:info.outputPath('product-logout-confirm.png'),fullPage:false});await dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true}).click();await expect.poll(()=>logouts).toBe(1);await expect.poll(async()=>(await page.request.get('/api/auth/me')).status()).toBe(401)
})
