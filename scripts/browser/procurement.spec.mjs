import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync,writeFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {assertTestEnvironment} from '../test-environment.mjs'
import {json,sql,login,openPage,closeContexts,fits,reloadProtected} from './helpers.mjs'

let contexts=[]
test.beforeEach(async()=>{contexts=[];await assertTestEnvironment()})
test.afterEach(async({},info)=>closeContexts(contexts,info))
function warehouseService(action) {
 const env={...process.env};delete env.PSModulePath
 const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/services.ps1',action,'-Modules','ware'],{env,stdio:'ignore',windowsHide:true,timeout:30000})
 expect(r.status).toBe(0)
}

test('采购风险：切换明细失败不能操作旧单，新增响应丢失不能重复创建',async({browser},info)=>{
 const page=await openPage(browser,contexts)
 await login(page,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken
 const create=async(path,data)=>{const r=await page.request.post('/api/admin/ware/'+path,{headers:{'X-CSRF-Token':csrf},data});expect(r.status()).toBe(200);return r.json()}
 const ware=(await create('wareinfo/save',{name:'采购风险 '+randomUUID(),address:'独立测试仓库'})).id
 const purchases=[]
 for(const count of [2,3]){const demand=(await create('purchasedetail/save',{skuId:900001,wareId:ware,skuNum:count,skuPrice:'0.00'})).id;const purchase=(await create('purchase/merge',{items:[demand]})).purchaseId;await create('purchase/received',[purchase]);purchases.push(purchase)}
 await page.goto('/admin/procurement');await page.getByRole('button',{name:'采购单',exact:true}).click()
 const row=id=>page.getByRole('row').filter({has:page.getByRole('cell',{name:String(id),exact:true})})
 await row(purchases[0]).getByRole('button',{name:'查看明细',exact:true}).click();await expect(page.getByRole('button',{name:'完成并入库',exact:true})).toBeEnabled()
 let release,entered;const blocked=new Promise(r=>entered=r),pause=new Promise(r=>release=r)
 await page.route('**/purchase/info/'+purchases[1],async route=>{entered();await pause;await route.abort('failed')})
 await row(purchases[1]).getByRole('button',{name:'查看明细',exact:true}).click();await blocked
 const staleWhileLoading=await page.getByRole('button',{name:'完成并入库',exact:true}).isVisible()
 expect.soft(staleWhileLoading,'B 明细尚未返回时不应保留可提交的 A').toBe(false)
 release();await expect(page.getByRole('alert')).toBeVisible()
 const staleAfterFailure=await page.getByRole('button',{name:'完成并入库',exact:true}).isVisible()
 expect.soft(staleAfterFailure,'B 查询失败后不能继续提交旧 A').toBe(false)
 await page.unroute('**/purchase/info/'+purchases[1]);await page.getByRole('button',{name:'采购需求',exact:true}).click()
 await page.getByLabel('查找仓库选项',{exact:true}).fill(String(ware));await page.getByRole('button',{name:'查询仓库选项',exact:true}).click()
 await page.getByLabel('入库仓库',{exact:true}).selectOption(String(ware));await page.getByLabel('搜索 SKU 名称或编号',{exact:true}).fill('900001');await page.getByLabel('采购 SKU',{exact:true}).selectOption('900001');await page.getByLabel('采购数量',{exact:true}).fill('7')
 let posted=0,inflight=0
 await page.route('**/purchasedetail/save',async route=>{posted++;inflight++;try{await route.fetch();await route.abort('failed')}finally{inflight--}})
 const save=page.getByRole('button',{name:'保存采购需求',exact:true})
 await save.evaluate(button=>{button.form.requestSubmit();button.form.requestSubmit()})
 await expect.poll(()=>posted>0&&inflight===0).toBe(true);await expect(page.getByRole('alert')).toBeVisible()
 expect.soft(posted,'同一表单连续提交只允许发出一次写入').toBe(1)
 await expect.soft(save,'新增结果未知时不得再次新增').toBeDisabled()
 const created=Number(sql(`SELECT COUNT(*) FROM gulimall_wms_test.wms_purchase_detail WHERE ware_id=${ware} AND sku_id=900001 AND sku_num=7;`))
 expect.soft(created,'真实保存响应丢失仍只能生成一条本次需求').toBe(1)
 writeFileSync('.tools/stage27-procurement-observation-'+info.project.name+'.json',JSON.stringify({staleWhileLoading,staleAfterFailure,posted,created,ware,purchases},null,2)+'\n')
 await reloadProtected(page);await expect(save).toBeDisabled();await expect(page.getByLabel('采购数量',{exact:true})).toHaveValue('7')
 await page.unroute('**/purchasedetail/save')
 const originalKey='gulimall-procurement:'+(await json(page,'/api/auth/me')).user.username
 const original=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),originalKey)
 expect(original.payload.creationRequestId).toMatch(/^[a-f0-9-]{36}$/)
 await page.getByRole('button',{name:'查询原创建结果',exact:true}).click()
 const candidate=(await json(page,'/api/admin/ware/purchasedetail/list?wareId='+ware+'&key=900001')).page.list.find(d=>d.skuNum===7)
 await expect(page.getByText('编辑未分配需求 #'+candidate.id,{exact:true})).toBeVisible();await save.click();await expect(save).toBeEnabled()
 expect(sql('SELECT COUNT(*) FROM gulimall_wms_test.wms_purchase_detail WHERE ware_id='+ware+' AND sku_num=7;')).toBe('1')
 // Existing pre-stage32 snapshots retain the manual candidate path rather than inventing a key.
 delete original.payload.creationRequestId
 await page.evaluate(({key,request})=>sessionStorage.setItem(key,JSON.stringify(request)),{key:originalKey,request:original});await reloadProtected(page)
 await page.getByRole('button',{name:'查询候选需求',exact:true}).click();await page.getByRole('button',{name:'核对此需求 '+candidate.id,exact:true}).click();await page.getByRole('button',{name:'确认此需求为本次新增',exact:true}).click()
})

async function administrator(browser) {
 const page=await openPage(browser,contexts)
 await login(page,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
 const csrf=(await json(page,'/api/auth/csrf')).csrfToken
 const post=async(path,data)=>{const r=await page.request.post(path,{headers:{'X-CSRF-Token':csrf},data});expect(r.status()).toBe(200);return r.json()}
 return {page,csrf,post}
}
test('采购分页：超过五十 SKU、跨页合并目标与故障依赖隔离',async({browser},info)=>{
 const {page,post}=await administrator(browser),label='采购分页 '+randomUUID()
 if(info.project.name==='edge')await page.setViewportSize({width:375,height:812})
 const ware=(await post('/api/admin/ware/wareinfo/save',{name:label,address:'独立分页仓库'})).id
 const product=(await post('/api/admin/product/spuinfo/editor',{creationRequestId:randomUUID(),spuName:label,spuDescription:'分页选择验收',catalogId:900003,brandId:900001,weight:'0.2',images:['/demo-product.svg'],decript:['/demo-product.svg'],baseAttrs:[],skus:Array.from({length:61},(_,i)=>({skuName:label+' '+i,skuTitle:label+' '+i,price:'1.00',images:[{imgUrl:'/demo-product.svg',defaultImg:1}],attr:[{attrId:900002,attrName:'颜色',attrValue:'编号'+i}]}))})).id
 const skus=(await json(page,'/api/admin/product/spuinfo/editor/'+product)).product.skus
 const targetIds=[]
 for(let i=0;i<23;i++){const demand=(await post('/api/admin/ware/purchasedetail/save',{skuId:skus[0].skuId,wareId:ware,skuNum:1,skuPrice:'0.00'})).id;targetIds.push((await post('/api/admin/ware/purchase/merge',{items:[demand]})).purchaseId)}
 let stockRequests=0;await page.route('**/waresku/list**',route=>{stockRequests++;return route.abort('failed')})
 await page.goto('/admin/procurement');await page.getByLabel('查找仓库选项',{exact:true}).fill(String(ware));await page.getByRole('button',{name:'查询仓库选项',exact:true}).click()
 await page.getByLabel('按仓库筛选',{exact:true}).selectOption(String(ware));await expect(page.locator('.admin-table tbody tr')).toHaveCount(20)
 await page.getByLabel('搜索 SKU 名称或编号',{exact:true}).fill(label)
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'下一页 SKU 选项',exact:true}).click()
 const chosen=skus.at(-1).skuId
 await page.getByLabel('采购 SKU',{exact:true}).selectOption(String(chosen));await page.getByRole('button',{name:'上一页 SKU 选项',exact:true}).click();await expect(page.getByLabel('采购 SKU',{exact:true})).toHaveValue(String(chosen))
 await page.getByLabel('入库仓库',{exact:true}).selectOption(String(ware))
 const response=page.waitForResponse(r=>r.url().endsWith('/purchasedetail/save')&&r.request().method()==='POST')
 await page.getByRole('button',{name:'保存采购需求',exact:true}).click();const saved=await response;expect(saved.status()).toBe(200);const demand=(await saved.json()).id
 await expect(page.getByRole('button',{name:'保存采购需求',exact:true})).toBeEnabled();await page.getByLabel('选择需求 '+demand,{exact:true}).check()
 await page.getByRole('button',{name:'下一页合并目标',exact:true}).click();await page.getByLabel('合并目标',{exact:true}).selectOption(String(targetIds[0]));await page.getByRole('button',{name:'上一页合并目标',exact:true}).click();await expect(page.getByLabel('合并目标',{exact:true})).toHaveValue(String(targetIds[0]))
 await page.getByRole('button',{name:/合并选中需求/}).click();await expect(page.getByText('需求已合并到采购单 #'+targetIds[0]+'，领取后可完成入库。',{exact:true})).toBeVisible()
 expect((await json(page,'/api/admin/ware/purchasedetail/info/'+demand)).purchaseDetail.purchaseId).toBe(targetIds[0]);expect(stockRequests).toBe(0)
 await page.getByLabel('查询采购单编号',{exact:true}).fill(String(targetIds[0]));await page.getByRole('button',{name:'查询采购记录',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 await page.getByRole('button',{name:'库存',exact:true}).click();await expect(page.getByRole('alert')).toContainText('采购或库存查询失败');await expect(page.getByText('暂无匹配库存，完成采购后会增加库存。',{exact:true})).toHaveCount(0)
 await page.unroute('**/waresku/list**');await page.goBack();await expect(page.getByLabel('查询采购单编号',{exact:true})).toHaveValue(String(targetIds[0]));await page.getByRole('button',{name:'查询采购记录',exact:true}).click();await expect(page.locator('.admin-table tbody tr')).toHaveCount(1)
 await page.setViewportSize({width:375,height:812});await fits(page);await page.screenshot({path:info.outputPath('procurement-paged-mobile.png'),fullPage:true})
})
test('采购恢复：合并领取响应丢失、原完成结果重试及库存只处理一次',async({browser},info)=>{
 const {page,post,csrf}=await administrator(browser),ware=(await post('/api/admin/ware/wareinfo/save',{name:'采购恢复 '+randomUUID(),address:'恢复验收仓库'})).id
 const demands=[]
 for(const [skuId,skuNum]of [[900001,4],[900002,5]])demands.push((await post('/api/admin/ware/purchasedetail/save',{skuId,wareId:ware,skuNum,skuPrice:'0.00'})).id)
 await page.goto('/admin/procurement');for(const id of demands)await page.getByLabel('选择需求 '+id,{exact:true}).check()
 let mergeRequests=0,purchase,receiveRequests=0,finishRequests=0,committed=0
 await page.route('**/purchase/merge',async route=>{mergeRequests++;purchase=(await(await route.fetch()).json()).purchaseId;await route.abort('failed')})
 await page.getByRole('button',{name:/合并选中需求/}).click();await expect(page.getByRole('alert')).toContainText('原操作待核对')
 await reloadProtected(page);await page.unroute('**/purchase/merge');await page.getByRole('button',{name:'查询原操作结果',exact:true}).click();await expect(page.getByText('原采购操作待核对',{exact:true})).toHaveCount(0)
 await page.route('**/purchase/received',async route=>{receiveRequests++;await route.fetch();await route.abort('failed')})
 const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:String(purchase),exact:true})})
 await row.getByRole('button',{name:'领取',exact:true}).click();await expect(page.getByRole('alert')).toContainText('原操作待核对');await reloadProtected(page);await page.unroute('**/purchase/received');await page.getByRole('button',{name:'查询原操作结果',exact:true}).click()
 const finish=page.getByRole('button',{name:'完成并入库',exact:true});await expect(finish).toBeEnabled()
 await page.getByLabel('需求 '+demands[1]+' 完成结果',{exact:true}).selectOption('4');await page.getByLabel('失败原因',{exact:true}).fill('缺货')
 await page.route('**/purchase/done',async route=>{finishRequests++;if(finishRequests>1){await route.fetch();committed++}await route.abort('failed')})
 await finish.evaluate(button=>{button.form.requestSubmit();button.form.requestSubmit()});await expect(page.getByRole('alert')).toContainText('原操作待核对')
 const storageKey='gulimall-procurement:'+(await json(page,'/api/auth/me')).user.username
 const original=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),storageKey)
 expect(original.type).toBe('finish');expect(original.payload.items.find(i=>i.itemId===demands[1]).reason).toBe('缺货')
 try { warehouseService('Stop') } finally { warehouseService('Start') }
 await expect.poll(async()=>{try{return(await page.request.get('/api/admin/ware/purchase/info/'+purchase)).status()}catch{return 0}},{timeout:60000}).toBe(200)
 await reloadProtected(page);await expect(page.getByLabel('失败原因',{exact:true})).toHaveValue('缺货');await expect(finish).toBeDisabled();await page.getByRole('button',{name:'查询原操作结果',exact:true}).click()
 const retry=page.getByRole('button',{name:'重试原请求',exact:true});await expect(retry).toBeVisible();await retry.evaluate(button=>{button.click();button.click()});await expect(page.getByRole('alert')).toContainText('原操作待核对')
 expect(await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),storageKey)).toEqual(original)
 await page.unroute('**/purchase/done');await page.getByRole('button',{name:'查询原操作结果',exact:true}).click();await expect(page.getByText('原采购操作待核对',{exact:true})).toHaveCount(0)
 await post('/api/admin/ware/purchase/done',original.payload);await post('/api/admin/ware/purchase/done',original.payload)
 const changed={...original.payload,items:original.payload.items.map(i=>({...i,status:3,reason:''}))}
 expect((await page.request.post('/api/admin/ware/purchase/done',{headers:{'X-CSRF-Token':csrf},data:changed})).status()).toBe(409)
 expect(sql('SELECT stock FROM gulimall_wms_test.wms_ware_sku WHERE ware_id='+ware+' AND sku_id=900001;')).toBe('4')
 expect(sql('SELECT COUNT(*) FROM gulimall_wms_test.wms_ware_sku WHERE ware_id='+ware+' AND sku_id=900002;')).toBe('0')
 expect(mergeRequests).toBe(1);expect(receiveRequests).toBe(1);expect(finishRequests).toBe(2);expect(committed).toBe(1)
 writeFileSync('.tools/stage27-unknown-workflow-'+info.project.name+'.json',JSON.stringify({mergeRequests,receiveRequests,finishRequests,committed,stock:4,failedStock:0,warehouseRestarted:true,originalSnapshotRetained:true,purchase,ware},null,2)+'\n')
})
test('采购保存已确认但列表失败仍绑定原需求；损坏记录不得静默清空',async({browser})=>{
 const {page,post}=await administrator(browser),ware=(await post('/api/admin/ware/wareinfo/save',{name:'采购反馈 '+randomUUID(),address:'反馈验收仓库'})).id
 await page.goto('/admin/procurement');await page.getByLabel('查找仓库选项',{exact:true}).fill(String(ware));await page.getByRole('button',{name:'查询仓库选项',exact:true}).click();await page.getByLabel('入库仓库',{exact:true}).selectOption(String(ware));await page.getByLabel('采购 SKU',{exact:true}).selectOption('900001')
 await page.route('**/purchasedetail/list**',route=>route.abort('failed'))
 const response=page.waitForResponse(r=>r.url().endsWith('/purchasedetail/save')&&r.request().method()==='POST');await page.getByRole('button',{name:'保存采购需求',exact:true}).click();const id=(await(await response).json()).id
 await expect(page.getByText('编辑未分配需求 #'+id,{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('采购或库存查询失败')
 await page.getByRole('button',{name:'保存采购需求',exact:true}).click();await expect(page.getByRole('button',{name:'保存采购需求',exact:true})).toBeEnabled()
 expect(sql('SELECT COUNT(*) FROM gulimall_wms_test.wms_purchase_detail WHERE ware_id='+ware+';')).toBe('1')
 await page.unroute('**/purchasedetail/list**')
 const key='gulimall-procurement:'+(await json(page,'/api/auth/me')).user.username
 await page.evaluate(key=>sessionStorage.setItem(key,'broken'),key);await reloadProtected(page);await expect(page.getByRole('button',{name:'保存采购需求',exact:true})).toBeDisabled();expect(await page.evaluate(key=>sessionStorage.getItem(key),key)).toBe('broken')
 await expect(page.getByText('标签页记录无法读取或保存，暂停采购写入。',{exact:false})).toBeVisible()
})
