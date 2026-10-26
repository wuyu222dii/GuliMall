import {test,expect} from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {randomUUID,randomInt} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {assertTestEnvironment} from '../test-environment.mjs'
import {saveSafeTrace} from '../browser-artifacts.mjs'

const base='http://127.0.0.1:8080'
async function json(page,path){const r=await page.request.get(base+path);expect(r.status()).toBe(200);return r.json()}
function sql(query){assert(/^SELECT\s/.test(query));const r=spawnSync('docker',['compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -ugulimall --batch --skip-column-names'],{input:query,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Read-only test assertion failed');return r.stdout.trim()}
async function login(page,account){try{await page.goto('/admin/login');await page.getByLabel('管理员账号',{exact:true}).fill(account.username);await page.getByLabel('密码',{exact:true}).fill(account.password);await page.getByRole('button',{name:'登录',exact:true}).click();await expect(page.getByRole('heading',{name:'商品列表',exact:true})).toBeVisible()}catch{throw new Error('测试管理员登录失败（敏感输入已隐藏）')}}
async function register(page,username){
  try{
    await page.goto('/register');await page.getByLabel('用户名',{exact:true}).fill(username);await page.getByLabel('手机号',{exact:true}).fill('136'+String(randomInt(100000000)).padStart(8,'0'))
    await page.getByRole('button',{name:'获取验证码',exact:true}).click()
    const message=await page.getByRole('status').filter({hasText:'开发验证码：'}).innerText(),code=message.match(/开发验证码：(\d{6})/)[1]
    await page.getByLabel('验证码',{exact:true}).fill(code);await page.getByLabel('密码',{exact:true}).fill('Browser_'+randomUUID().slice(0,12)+'!')
    await page.getByRole('button',{name:'注册',exact:true}).click();await expect(page.getByRole('button',{name:'退出登录',exact:true})).toBeVisible()
    return (await json(page,'/api/auth/me')).user.id
  }catch{throw new Error('开发验证码注册失败（密码与验证码已隐藏）')}
}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}
let activeContexts=[],activePages=[]
test.afterEach(async({},info)=>{
  const failed=info.status!==info.expectedStatus
  for(let i=0;i<activeContexts.length;i++){
    try{if(failed&&!activePages[i].isClosed())await activePages[i].screenshot({path:info.outputPath('failure-'+i+'.png'),fullPage:true,mask:[activePages[i].locator('input'),activePages[i].locator('[role="status"]')]})}catch{/* A closed page cannot be captured. */}
    try{if(failed){const raw=info.outputPath('raw-'+i+'.zip');await activeContexts[i].tracing.stop({path:raw});saveSafeTrace(raw,info.outputPath('trace-'+i+'.zip'))}else await activeContexts[i].tracing.stop()}finally{await activeContexts[i].close()}
  }
})

for(const round of [1,2])test(`模拟商城完整浏览器交易，第 ${round} 轮`,async({browser},info)=>{
  activeContexts=[];activePages=[]
  await assertTestEnvironment()
  const run='ui16_'+randomUUID().replaceAll('-','').slice(0,8),label='浏览器回归 '+run,contexts=[],pages=[]
  activeContexts=contexts;activePages=pages
  const context=async()=>{const c=await browser.newContext({baseURL:base,viewport:{width:1280,height:800}});contexts.push(c);await c.route('**/*',route=>{const url=new URL(route.request().url());return ['http:','https:'].includes(url.protocol)&&url.hostname!=='127.0.0.1'?route.abort():route.continue()});await c.tracing.start({screenshots:false,snapshots:false,sources:false});const p=await c.newPage();pages.push(p);return p}
  const admin=await context(),member=await context()
  let record
    await test.step('管理员上传图片并创建双 SKU',async()=>{
      await login(admin,JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE,'utf8')))
      await admin.getByRole('link',{name:'新建商品',exact:true}).click();await admin.getByRole('button',{name:'填入双 SKU 示例',exact:true}).click()
      await admin.getByLabel('商品名称',{exact:true}).fill(label)
      for(let i=1;i<=2;i++){await admin.getByLabel(`SKU ${i} 名称`,{exact:true}).fill(label+(i===1?' 红色':' 蓝色'));await admin.getByLabel(`SKU ${i} 标题`,{exact:true}).fill(label+(i===1?' 红色':' 蓝色'));await admin.getByLabel(`SKU ${i} 售价`,{exact:true}).fill(i===1?'0.10':'3.45')}
      await admin.getByLabel('上传商品图片',{exact:true}).setInputFiles(resolve('scripts/fixtures/upload.png'))
      await expect(admin.getByText('图片已上传，可在各 SKU 中选择使用。',{exact:true})).toBeVisible()
      for(let i=1;i<=2;i++)await admin.getByRole('listbox',{name:`SKU ${i} 图片`,exact:true}).selectOption({label:'图片 2'})
      const saved=admin.waitForResponse(r=>r.url().endsWith('/api/admin/product/spuinfo/editor')&&r.request().method()==='POST')
      await admin.getByRole('button',{name:/保存商品/}).click();const response=await saved;expect(response.status()).toBe(200);const id=(await response.json()).id
      await expect(admin).toHaveURL(new RegExp('/admin/products/'+id+'/edit$'))
      const product=(await json(admin,'/api/admin/product/spuinfo/editor/'+id)).product
      expect(product.skus).toHaveLength(2);expect(product.skus.every(s=>s.images[0].imgUrl.startsWith('/api/media/'))).toBe(true)
      record={run,productId:id,skus:product.skus.map(s=>s.skuId),round}
    })
    await test.step('采购需求合并、领取、完成并上架检索',async()=>{
      await admin.getByRole('link',{name:'采购与库存',exact:true}).click();await admin.getByLabel('搜索 SKU 名称或编号',{exact:true}).fill(label)
      await expect(admin.getByRole('combobox',{name:'采购 SKU',exact:true}).locator('option')).toHaveCount(3)
      const demands=[]
      for(const sku of record.skus){await admin.getByRole('combobox',{name:'采购 SKU',exact:true}).selectOption(String(sku));await admin.getByRole('combobox',{name:'入库仓库',exact:true}).selectOption('900001');await admin.getByLabel('采购数量',{exact:true}).fill('10');await admin.getByLabel('预计采购总金额（元）',{exact:true}).fill('1.00');const saved=admin.waitForResponse(r=>r.url().endsWith('/purchasedetail/save')&&r.request().method()==='POST');await admin.getByRole('button',{name:'保存采购需求',exact:true}).click();const r=await saved;expect(r.status()).toBe(200);demands.push((await r.json()).id);await expect(admin.getByRole('button',{name:'保存采购需求',exact:true})).toBeEnabled()}
      for(const id of demands)await admin.getByLabel('选择需求 '+id,{exact:true}).check()
      const merged=admin.waitForResponse(r=>r.url().endsWith('/purchase/merge')&&r.request().method()==='POST');await admin.getByRole('button',{name:/合并选中需求/}).click();const r=await merged;expect(r.status()).toBe(200);record.purchaseId=(await r.json()).purchaseId
      const row=admin.getByRole('row').filter({has:admin.getByRole('cell',{name:String(record.purchaseId),exact:true})});await row.getByRole('button',{name:'领取',exact:true}).click();await admin.getByRole('button',{name:'完成并入库',exact:true}).click();await expect(admin.getByText('采购结果已保存，成功项已入库。',{exact:true})).toBeVisible()
      await admin.getByRole('link',{name:'商品管理',exact:true}).click();await admin.getByLabel('商品名称或 SPU 编号',{exact:true}).fill(String(record.productId));await admin.getByRole('button',{name:'查询',exact:true}).click();await admin.getByRole('row').filter({hasText:label}).getByRole('button',{name:'上架',exact:true}).click();await expect(admin.getByText('目标状态与搜索索引已同步。',{exact:true})).toBeVisible()
    })
    await test.step('会员开发码注册、地址、搜索及购物车',async()=>{
      record.memberId=await register(member,run+'a');await member.getByRole('link',{name:'收货地址',exact:true}).click();await member.getByRole('button',{name:'新增地址',exact:true}).click()
      for(const[name,value]of Object.entries({'收件人':'浏览器模拟会员','手机号':'13800000001','省份':'浙江省','城市':'杭州市','区县':'西湖区','详细地址':'独立测试地址16号'}))await member.getByLabel(name,{exact:true}).fill(value)
      await member.getByRole('button',{name:'保存',exact:true}).click();await expect(member.getByText('独立测试地址16号',{exact:false})).toBeVisible()
      await member.goto('/search?keyword='+encodeURIComponent(run));await expect(member.locator('.product-card')).toHaveCount(2);await member.locator('.product-card').filter({hasText:label+' 红色'}).click();await member.getByLabel('数量',{exact:true}).fill('3');await member.getByRole('button',{name:'加入购物车',exact:true}).click();await expect(member.getByText('已加入购物车。',{exact:false})).toBeVisible()
      await member.goto('/product/'+record.skus[1]);await member.getByRole('button',{name:'立即购买',exact:true}).click();await expect(member).toHaveURL(/\/cart$/);await expect(member.locator('.cart-total')).toContainText('¥3.75');await member.getByRole('button',{name:'结算已选商品',exact:true}).click()
    })
    await test.step('真实提交、模拟付款、库存确认、发货与收货',async()=>{
      const submitted=member.waitForResponse(r=>r.url().endsWith('/mine/submit')&&r.request().method()==='POST');await member.getByRole('button',{name:'提交订单',exact:true}).click();const sr=await submitted;expect(sr.status()).toBe(200);const order=(await sr.json()).result.order;record.orderId=order.id;record.orderSn=order.orderSn;expect(Number(order.payAmount)).toBe(3.75)
      await member.getByRole('link',{name:'付款 / 库存状态',exact:true}).click();await member.getByRole('button',{name:'打开模拟付款',exact:true}).click();await expect(member.getByText('当前为本地模拟付款，不是支付宝沙箱，不使用真实资金或账号。',{exact:true})).toBeVisible();await member.getByRole('button',{name:'确认模拟付款',exact:true}).click()
      await expect.poll(async()=>(await json(member,`/api/order/mine/${record.orderSn}/payment-status`)).payment.order.fulfillmentReady).toBe(true)
      await admin.getByRole('link',{name:'订单',exact:true}).click();await admin.getByLabel('完整订单号',{exact:true}).fill(record.orderSn);await admin.getByRole('button',{name:'查询订单',exact:true}).click();await admin.getByRole('row').filter({hasText:record.orderSn}).getByRole('button',{name:'详情 / 物流',exact:true}).click();await expect(admin.getByRole('heading',{name:'处理进度',exact:true})).toBeVisible();expect((await json(admin,`/api/admin/order/order/${order.id}/processing`)).processing.fulfillmentReady).toBe(true)
      await admin.getByLabel('物流公司',{exact:true}).fill('本地模拟物流');await admin.getByLabel('运单号',{exact:true}).fill('BROWSER-'+run.replaceAll('_','-'));await admin.getByRole('button',{name:'确认发货',exact:true}).click();await expect(admin.getByText(/发货已确认/)).toBeVisible()
      await member.goto('/member/orders');await member.getByRole('button',{name:'查看订单 '+record.orderSn,exact:true}).click();await expect(member.locator('.order-details > p').filter({hasText:'BROWSER-'+run.replaceAll('_','-')})).toBeVisible();await member.getByRole('button',{name:'确认收货',exact:true}).click();await member.getByRole('button',{name:'确认已收到包裹',exact:true}).click();await expect(member.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();await member.screenshot({path:info.outputPath('completed.png'),fullPage:true})
      await member.goto('/payment/'+record.orderSn);await expect(member.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();let polls=0;const track=r=>{if(r.url().includes('/payment-status'))polls++};member.on('request',track);await new Promise(r=>setTimeout(r,5500));member.off('request',track);expect(polls).toBe(0)
    })
    await test.step('连续购买、模拟失败、放弃付款及取消释放',async()=>{
      await member.goto('/product/'+record.skus[0]);await member.getByRole('button',{name:'立即购买',exact:true}).click();await member.getByRole('button',{name:'结算已选商品',exact:true}).click();await member.getByRole('button',{name:'开始下一次确认',exact:true}).click();const sent=member.waitForResponse(r=>r.url().endsWith('/mine/submit')&&r.request().method()==='POST');await member.getByRole('button',{name:'提交订单',exact:true}).click();const order=(await(await sent).json()).result.order;record.cancelledOrderSn=order.orderSn;record.cancelledOrderId=order.id
      expect(Number(order.payAmount)).toBe(0.10)
      await member.getByRole('link',{name:'付款 / 库存状态',exact:true}).click();await member.getByRole('button',{name:'打开模拟付款',exact:true}).click();await member.getByRole('button',{name:'模拟付款失败',exact:true}).click();await expect(member.getByText(/订单仍待付款/)).toBeVisible();await member.getByRole('link',{name:'返回订单',exact:true}).click();await expect(member.getByRole('heading',{name:'待付款',exact:true})).toBeVisible()
      await member.getByRole('button',{name:'打开模拟付款',exact:true}).click();await member.getByRole('link',{name:'返回订单（不付款）',exact:true}).click();await expect(member.getByRole('heading',{name:'待付款',exact:true})).toBeVisible();await member.getByRole('link',{name:'我的订单',exact:true}).first().click();await member.getByRole('button',{name:'取消待付款订单',exact:true}).click();await member.getByRole('button',{name:'确认取消',exact:true}).click()
      await expect.poll(async()=>(await json(member,`/api/order/mine/${order.orderSn}/payment-status`)).payment.order.inventoryStatus).toBe(2);expect((await json(member,`/api/order/mine/${order.id}`)).order.status).toBe(4)
      for(const id of record.skus)assert(Number.isSafeInteger(id));expect(sql(`SELECT stock,stock_locked FROM gulimall_wms_test.wms_ware_sku WHERE sku_id IN (${record.skus.join(',')}) ORDER BY sku_id;`)).toBe('7\t0\n9\t0')
    })
    await test.step('会员隔离、刷新与窄屏导航和结算',async()=>{
      const other=await context();await register(other,run+'b');await other.goto('/member/orders');await expect(other.getByText('暂无订单',{exact:true})).toBeVisible();expect((await other.request.get(base+`/api/order/mine/${record.orderId}`)).status()).toBe(403);await other.goto('/payment/'+record.orderSn);await expect(other.getByRole('alert')).toBeVisible()
      await member.setViewportSize({width:375,height:812});await member.goto('/checkout');await expect(member.getByRole('heading',{name:'已关闭',exact:true})).toBeVisible();await expect(member.getByRole('button',{name:'开始下一次确认',exact:true})).toBeVisible();await fits(member);await member.screenshot({path:info.outputPath('mobile-checkout.png'),fullPage:true});await member.getByRole('link',{name:'我的订单',exact:true}).first().click();await member.reload();await expect(member.getByRole('heading',{name:'已完成',exact:true})).toBeVisible();await fits(member);await member.screenshot({path:info.outputPath('mobile-orders.png'),fullPage:true})
      mkdirSync('.tools/test/browser-runs',{recursive:true});writeFileSync('.tools/test/browser-runs/'+run+'.json',JSON.stringify({...record,complete:true,realServices:false},null,2)+'\n')
    })
})
