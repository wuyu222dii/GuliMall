import { test, expect } from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { assertTestEnvironment } from '../test-environment.mjs'
import { openPage, closeContexts, register, login, signIn, json, fits, reloadProtected, sql } from './helpers.mjs'
let contexts = []
test.beforeEach(async () => { contexts = []; await assertTestEnvironment() })
test.afterEach(async ({}, info) => closeContexts(contexts, info))
const unique = () => 'c40_' + randomUUID().replaceAll('-', '').slice(0, 10)
async function fillAddress(page, name) { for (const [label, value] of Object.entries({ 收件人: name, 手机号: '13800000001', 省份: '浙江省', 城市: '杭州市', 区县: '西湖区', 详细地址: '原内容恢复40号' })) await page.getByLabel(label, { exact: true }).fill(value) }
async function reference(page, key) { const value = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key); expect(Object.keys(value).sort()).toEqual(['fingerprint', 'requestId']); expect(value.requestId).toMatch(/^[a-f0-9-]{36}$/); expect(value.fingerprint).toMatch(/^[a-f0-9]{64}$/); return value }
async function member(browser) { const page = await openPage(browser, contexts), account = { username: unique(), password: 'Creation_' + randomUUID() + '!' }, id = await register(page, account.username, account.password); await page.goto('/member/address'); return { page, id, key: 'gulimall-address-creation:' + id, account } }

test('地址持久回执：丢响应后同号重试、刷新查询、删除后不复活及会员隔离', async ({ browser }, info) => {
  const { page, id, key } = await member(browser), name = unique(), requests = []
  let drop = true
  await page.route('**/api/member/addresses', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    requests.push(route.request().postDataJSON())
    if (drop) { expect((await route.fetch()).status()).toBe(200); return route.abort('failed') }
    return route.continue()
  })
  await page.getByRole('button', { name: '新增地址', exact: true }).click(); await fillAddress(page, name); await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('新增结果尚未确认')
  await expect(page.getByRole('region', { name: '地址原创建请求', exact: true })).toBeVisible()
  const first = await reference(page, key); expect(requests[0].creationRequestId).toBe(first.requestId)
  await expect(page.getByLabel('收件人', { exact: true })).toBeDisabled()
  drop = false; await page.getByRole('button', { name: '重试原请求', exact: true }).click()
  await expect(page.getByRole('region', { name: '已确认地址结果', exact: true })).toBeVisible()
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]); expect((await json(page, '/api/member/addresses')).page.totalCount).toBe(1)
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull()
  drop = true; await page.getByRole('button', { name: '新增地址', exact: true }).click(); await fillAddress(page, unique()); await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('新增结果尚未确认'); const second = await reference(page, key)
  await reloadProtected(page); await expect(page.getByRole('region', { name: '已确认地址结果', exact: true })).toBeVisible(); expect(requests).toHaveLength(3)
  const receipt = await json(page, '/api/member/addresses/creation/' + second.requestId); expect(receipt.found).toBe(true)
  const csrf = (await json(page, '/api/auth/csrf')).csrfToken
  expect((await page.request.delete('/api/member/addresses', { data: [receipt.id], headers: { 'X-CSRF-Token': csrf } })).status()).toBe(200)
  await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), { key, value: second }); await page.reload()
  await expect(page.getByRole('region', { name: '地址原创建请求', exact: true })).toContainText('已删除，旧请求不能复活地址')
  await expect(page.getByRole('button', { name: '重试原请求', exact: true })).toHaveCount(0); expect(requests).toHaveLength(3)
  const other = await member(browser); expect((await json(other.page, '/api/member/addresses/creation/' + second.requestId)).found).toBe(false)
  expect((await page.request.get('/api/member/addresses', { headers: { 'X-Address-Owner': String(other.id) } })).status()).toBe(409)
  expect(sql(`SELECT COUNT(*) FROM gulimall_ums_test.ums_address_creation_receipt WHERE member_id=${id};`)).toBe('2')
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); await page.getByRole('button', { name: '已核对，放弃本次表单', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: '地址原创建请求', exact: true })).toHaveCount(0); await page.screenshot({ path: info.outputPath('address-receipt-mobile.png'), fullPage: true, mask: [page.locator('input')] })
})

test('地址未执行请求：刷新只读查询、原内容指纹匹配后显式重试与损坏记录阻断', async ({ browser }) => {
  const { page, key, account } = await member(browser), name = unique(), requests = []
  let block = true
  await page.route('**/api/member/addresses', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    requests.push(route.request().postDataJSON()); return block ? route.abort('failed') : route.continue()
  })
  await page.getByRole('button', { name: '新增地址', exact: true }).click(); await fillAddress(page, name); await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('新增结果尚未确认'); const original = await reference(page, key)
  await reloadProtected(page); await expect(page.getByRole('status').filter({ hasText: '原请求尚未查到，请重新输入原内容' })).toBeVisible()
  expect(requests).toHaveLength(1); await expect(page.getByLabel('收件人', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: '退出登录', exact: true }).click(); await page.getByRole('alertdialog', { name: '未保存内容确认', exact: true }).getByRole('button', { name: '确认放弃并继续', exact: true }).click()
  await expect(page.getByRole('button', { name: '退出登录', exact: true })).toHaveCount(0); await page.goto('/member/address'); await signIn(page, account)
  await expect(page.getByRole('status').filter({ hasText: '原请求尚未查到，请重新输入原内容' })).toBeVisible(); expect(await reference(page, key)).toEqual(original); expect(requests).toHaveLength(1)
  await fillAddress(page, '不匹配原内容'); await page.getByRole('button', { name: '重试原请求', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('原请求指纹不一致'); expect(requests).toHaveLength(1)
  await page.getByRole('button', { name: '查询原创建结果', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: '原请求尚未查到，请重新输入原内容' })).toBeVisible()
  await expect(page.getByLabel('收件人', { exact: true })).toHaveValue('不匹配原内容')
  block = false; await page.getByLabel('收件人', { exact: true }).fill(name); await page.getByRole('button', { name: '重试原请求', exact: true }).click()
  await expect(page.getByRole('region', { name: '已确认地址结果', exact: true })).toBeVisible(); expect(requests).toHaveLength(2); expect(requests[1].creationRequestId).toBe(original.requestId)
  await page.evaluate(key => sessionStorage.setItem(key, '{broken'), key); await page.reload()
  await expect(page.getByRole('region', { name: '地址原创建请求', exact: true })).toContainText('原创建请求记录无法读取')
  await expect(page.getByRole('button', { name: '新增地址', exact: true })).toBeDisabled(); expect(requests).toHaveLength(2)
  await page.getByRole('button', { name: '已核对，放弃本次表单', exact: true }).click(); await expect(page.getByRole('button', { name: '新增地址', exact: true })).toBeEnabled()
})

test('仓库持久回执：丢响应、刷新恢复、原编号编辑、原内容重试与查询上下文', async ({ browser }, info) => {
  const page = await openPage(browser, contexts), account = JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE, 'utf8')), requests = []
  await login(page, account); const key = 'gulimall-warehouse-creation:' + account.username, name = unique()
  await page.goto('/admin/procurement?tab=warehouses&key=' + name); let commit = true, drop = true
  await page.route('**/api/admin/ware/wareinfo/save', async route => {
    requests.push(route.request().postDataJSON())
    if (drop) { if (commit) expect((await route.fetch()).status()).toBe(200); return route.abort('failed') }
    return route.continue()
  })
  await page.getByLabel('仓库名称', { exact: true }).fill(name); await page.getByLabel('仓库地址', { exact: true }).fill('仓库回执40号'); await page.getByRole('button', { name: '保存仓库', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('原请求号保持不变'); const first = await reference(page, key)
  await reloadProtected(page); const confirmed = page.getByRole('region', { name: '已确认仓库结果', exact: true }); await expect(confirmed).toBeVisible()
  expect(new URL(page.url()).searchParams.get('key')).toBe(name); expect(requests).toHaveLength(1)
  const receipt = await json(page, '/api/admin/ware/wareinfo/creation/' + first.requestId)
  await page.getByRole('button', { name: '查看已保存仓库 ' + receipt.id, exact: true }).click(); await page.getByRole('button', { name: '编辑已保存仓库 ' + receipt.id, exact: true }).click()
  await page.getByLabel('仓库地址', { exact: true }).fill('原编号编辑40号'); await page.getByRole('button', { name: '保存仓库', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: '仓库资料已保存' })).toBeVisible()
  expect(requests).toHaveLength(1); expect((await json(page, '/api/admin/ware/wareinfo/info/' + receipt.id)).wareInfo.address).toBe('原编号编辑40号')
  await page.getByRole('button', { name: '取消仓库编辑', exact: true }).click(); commit = false
  await page.getByLabel('仓库名称', { exact: true }).fill(name + '_未执行'); await page.getByLabel('仓库地址', { exact: true }).fill('未执行后恢复40号'); await page.getByRole('button', { name: '保存仓库', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('原请求号保持不变'); const second = await reference(page, key)
  await reloadProtected(page); await expect(page.getByRole('status').filter({ hasText: '原请求尚未查到，请重新输入原内容' })).toBeVisible(); expect(requests).toHaveLength(2)
  await page.getByLabel('仓库名称', { exact: true }).fill(name + '_未执行'); await page.getByLabel('仓库地址', { exact: true }).fill('未执行后恢复40号')
  drop = false; await page.getByRole('button', { name: '重试原请求', exact: true }).click(); await expect(confirmed).toBeVisible(); expect(requests).toHaveLength(3); expect(requests[2].creationRequestId).toBe(second.requestId)
  expect(new URL(page.url()).searchParams.get('key')).toBe(name)
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); await page.getByLabel('仓库地址', { exact: true }).focus(); await page.keyboard.press('Tab'); await page.screenshot({ path: info.outputPath('warehouse-receipt-mobile.png'), fullPage: true, mask: [page.locator('input')] })
})
