import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {assertTestEnvironment} from '../test-environment.mjs'
import {openPage,closeContexts,login,submitAdminLogin,json,sql,fits,reloadProtected} from './helpers.mjs'

let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
const dialog=page=>page.getByRole('alertdialog',{name:'未保存内容确认',exact:true})
async function administrator(browser){
 const page=await openPage(browser,contexts),account=JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8'));await login(page,account)
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken
 const post=async(path,data)=>{const r=await page.request.post('/api/admin/'+path,{headers:{'X-CSRF-Token':csrf},data});expect(r.status()).toBe(200);return r.json()}
 return {page,post,account}
}
async function discard(page){await expect(dialog(page)).toBeVisible();await dialog(page).getByRole('button',{name:'确认放弃并继续',exact:true}).click();await expect(dialog(page)).toHaveCount(0)}

test('采购 URL：分页刷新复制返回和未知请求跨页签精确恢复',async({browser})=>{
 const {page,post}=await administrator(browser),ware=(await post('ware/wareinfo/save',{name:'URL采购 '+randomUUID(),address:'独立 Test'})).id
 for(let i=0;i<23;i++)await post('ware/purchasedetail/save',{skuId:900001,wareId:ware,skuNum:1,skuPrice:'0.00'})
 await page.goto('/admin/procurement?tab=demands&wareId='+ware+'&page=2');await expect(page.locator('.admin-table tbody tr')).toHaveCount(3);await page.reload();await expect(page.locator('.admin-table tbody tr')).toHaveCount(3)
 await page.getByLabel('查询 SKU 或采购单编号',{exact:true}).fill('900001');await page.getByRole('button',{name:'查询采购记录',exact:true}).click();await expect(page).toHaveURL(/key=900001/);await expect(page.locator('.admin-table tbody tr')).toHaveCount(20)
 await page.getByRole('button',{name:'下一页',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(3);const copied=page.url(),duplicate=await page.context().newPage();await duplicate.goto(copied);await expect(duplicate.locator('.admin-table tbody tr')).toHaveCount(3);await duplicate.close()
 await page.goBack();await expect(page.locator('.admin-table tbody tr')).toHaveCount(20)
 await page.getByLabel('查找仓库选项',{exact:true}).fill(String(ware));await page.getByRole('button',{name:'查询仓库选项',exact:true}).click();await page.getByLabel('入库仓库',{exact:true}).selectOption(String(ware));await page.getByLabel('搜索 SKU 名称或编号',{exact:true}).fill('900001');await page.getByLabel('采购 SKU',{exact:true}).selectOption('900001');await page.getByLabel('采购数量',{exact:true}).fill('7')
 let aborted;const lost=new Promise(resolve=>aborted=resolve)
 await page.route('**/purchasedetail/save',async route=>{try{const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed')}finally{aborted()}});await page.getByRole('button',{name:'保存采购需求',exact:true}).click();await lost;await expect(page.getByRole('alert')).toContainText('原操作待核对')
 const key='gulimall-procurement:'+(await json(page,'/api/auth/me')).user.username,original=await page.evaluate(k=>sessionStorage.getItem(k),key),requestId=JSON.parse(original).payload.creationRequestId
 await page.unroute('**/purchasedetail/save');await page.getByRole('button',{name:'库存',exact:true}).click();await discard(page);await expect(page).toHaveURL(/tab=stock/);expect(await page.evaluate(k=>sessionStorage.getItem(k),key)).toBe(original)
 await reloadProtected(page);expect(await page.evaluate(k=>sessionStorage.getItem(k),key)).toBe(original);await page.getByRole('button',{name:'查询原创建结果',exact:true}).click()
 const found=await json(page,'/api/admin/ware/purchasedetail/creation/'+requestId);await expect(page.getByText('编辑未分配需求 #'+found.id,{exact:true})).toBeVisible();await expect(page).toHaveURL(/tab=demands/);await page.getByRole('button',{name:'保存采购需求',exact:true}).click();await expect(page.getByRole('button',{name:'保存采购需求',exact:true})).toBeEnabled()
 expect(sql("SELECT COUNT(*) FROM gulimall_wms_test.wms_purchase_detail WHERE creation_request_id='"+requestId+"';")).toBe('1')
})

test('基础资料与仓库 URL：脏表单确认、越界替换和管理员重登回跳',async({browser},info)=>{
 const {page,post,account}=await administrator(browser),label='URL资料 '+randomUUID()
 for(let i=0;i<23;i++)await post('product/admin/catalog/brands',{name:label+' '+i,firstLetter:'U',sort:0,showStatus:1,logo:'/demo-product.svg'})
 const catalogQuery=new URLSearchParams({kind:'brands',key:label,page:'2'})
 await page.goto('/admin/products/catalog?'+catalogQuery);await expect(page.locator('.admin-table tbody tr')).toHaveCount(3);await page.reload();await expect(page.getByLabel('查询名称或编号',{exact:true})).toHaveValue(label)
 await page.getByRole('button',{name:'编辑',exact:true}).first().click();await page.getByLabel('品牌名称',{exact:true}).fill('未保存品牌');const before=page.url()
 await page.getByRole('button',{name:'上一页',exact:true}).click();await dialog(page).getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page).toHaveURL(before);await expect(page.getByLabel('品牌名称',{exact:true})).toHaveValue('未保存品牌')
 await page.getByRole('button',{name:'上一页',exact:true}).click();await discard(page);await expect(page.locator('.admin-table tbody tr')).toHaveCount(20);const first=page.url()
 await page.goto('/admin/products/catalog?'+new URLSearchParams({kind:'brands',key:label,page:'999'}));await expect(page).toHaveURL(/page=2/);await expect(page.locator('.admin-table tbody tr')).toHaveCount(3);await page.goBack();await expect(page).toHaveURL(first)
 for(let i=0;i<12;i++)await post('ware/wareinfo/save',{name:label+' '+i,address:'独立仓库 '+i})
 await page.goto('/admin/procurement?'+new URLSearchParams({tab:'warehouses',key:label,page:'2'}));await expect(page.locator('.admin-table tbody tr')).toHaveCount(2);await page.reload();await expect(page.locator('.admin-table tbody tr')).toHaveCount(2)
 await page.getByRole('button',{name:/^编辑仓库 /}).first().click();await page.getByLabel('仓库地址',{exact:true}).fill('未保存仓库地址');await page.getByRole('button',{name:'上一页',exact:true}).click();await dialog(page).getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page.getByLabel('仓库地址',{exact:true})).toHaveValue('未保存仓库地址')
 await page.setViewportSize({width:375,height:812});await page.getByRole('button',{name:'上一页',exact:true}).click();await fits(page);await page.screenshot({path:info.outputPath('warehouse-query-confirm.png'),fullPage:false});await discard(page);await expect(page.locator('.admin-table tbody tr')).toHaveCount(10);const returnTo=page.url()
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken;expect((await page.request.post('/api/auth/logout',{headers:{'X-CSRF-Token':csrf},data:{}})).status()).toBe(200)
 await page.goto(returnTo);await expect(page).toHaveURL(/\/admin\/login\?redirect=/);await submitAdminLogin(page,account);await expect(page).toHaveURL(returnTo);await expect(page.locator('.admin-table tbody tr')).toHaveCount(10)
 await page.goto('/admin/products/catalog?kind=brands&type=1');await expect(page.getByRole('alert')).toContainText('当前资料类型');await page.getByRole('button',{name:'清除无效查询',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0)
})

test('同步任务 URL：精确筛选、状态和刷新恢复、错误重试与商品往返',async({browser},info)=>{
 const {page,post}=await administrator(browser),label='URL同步 '+randomUUID()
 const id=(await post('product/spuinfo/editor',{spuName:label,spuDescription:'导航验收',catalogId:900003,brandId:900001,weight:'0.2',images:['/demo-product.svg'],decript:[],baseAttrs:[],skus:[{skuName:label,skuTitle:label,price:'1.00',images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:'标准'}]}]})).id
 await post('product/search-sync/'+id+'/publish?status=0',{})
 const list='/admin/products?'+new URLSearchParams({key:label,brandId:'900001',status:'0',page:'1'});await page.goto(list);await page.getByRole('link',{name:'同步记录 '+id,exact:true}).click();await expect(page.getByLabel('精确 SPU 编号',{exact:true})).toHaveValue(String(id));await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 await page.getByLabel('同步状态筛选',{exact:true}).selectOption('1');await page.getByRole('button',{name:'查询同步任务',exact:true}).click();await page.reload();await expect(page.getByLabel('同步状态筛选',{exact:true})).toHaveValue('1');await expect(page).toHaveURL(/syncState=1/)
 await page.route('**/api/admin/product/search-sync?*',route=>route.abort('failed'));await page.getByRole('button',{name:'刷新结果',exact:true}).click();await expect(page.getByRole('alert')).toContainText('同步记录查询失败');await expect(page.getByText('暂无同步任务，可从商品库全量重建。',{exact:true})).toHaveCount(0);await page.unroute('**/api/admin/product/search-sync?*');await page.getByRole('button',{name:'刷新结果',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 await page.getByRole('link',{name:'编辑商品 '+id,exact:true}).click();expect(page.url()).not.toContain('syncState');await page.getByRole('link',{name:'查看搜索同步',exact:true}).click();await expect(page.getByLabel('精确 SPU 编号',{exact:true})).toHaveValue(String(id))
 await page.getByRole('button',{name:'清除同步条件',exact:true}).click();await expect(page.getByLabel('精确 SPU 编号',{exact:true})).toHaveValue('');await page.getByLabel('精确 SPU 编号',{exact:true}).fill(String(id));await page.getByRole('button',{name:'查询同步任务',exact:true}).click()
 if(info.project.name==='edge')await page.setViewportSize({width:375,height:812});await fits(page);await page.screenshot({path:info.outputPath('sync-query.png'),fullPage:false})
 await page.getByRole('link',{name:'返回商品',exact:true}).click();await expect(page).toHaveURL('http://127.0.0.1:8080'+list)
})
