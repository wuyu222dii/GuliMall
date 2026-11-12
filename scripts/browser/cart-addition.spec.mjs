import { test, expect } from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import { randomUUID } from 'node:crypto'
import { assertTestEnvironment } from '../test-environment.mjs'
import { openPage, closeContexts, register, signIn, json, fits, reloadProtected } from './helpers.mjs'
let contexts = []
test.beforeEach(async () => { contexts = []; await assertTestEnvironment() })
test.afterEach(async ({}, info) => closeContexts(contexts, info))
const region = page => page.getByRole('region', { name: '加购结果核对', exact: true })
const key = id => 'gulimall-cart-add:' + id
const attempts = page => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([key]) => key.startsWith('gulimall-checkout:'))))
async function member(browser) { const page = await openPage(browser, contexts), account = { username: 'a41_' + randomUUID().replaceAll('-', '').slice(0, 9), password: 'Add_' + randomUUID() + '!' }, id = await register(page, account.username, account.password); return { page, id, account } }
async function api(page, path, data, method = 'POST') { const csrf = (await json(page, '/api/auth/csrf')).csrfToken, response = await page.request.fetch(path, { method, headers: { 'X-CSRF-Token': csrf }, data }); expect(response.status()).toBe(200); return response.json() }
async function reference(page, id) { const value = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key(id)); expect(Object.keys(value).sort()).toEqual(['count', 'requestId', 'skuId']); expect(value.skuId).toBe(900001); expect(value.count).toBe(1); return value }

test('会员增量回执：丢响应、刷新重登只读恢复、清空后不复活及原确认令牌', async ({ browser }, info) => {
  const { page, id, account } = await member(browser)
  await api(page, '/api/member/addresses', { name: '加购测试41', phone: '13800000001', detailAddress: '独立Test', defaultStatus: 1 })
  await api(page, '/api/cart/items', { requestId: randomUUID(), skuId: 900001, count: 1 })
  await page.goto('/cart'); await page.getByRole('button', { name: '结算已选商品', exact: true }).click(); await expect(page.getByRole('button', { name: '提交订单', exact: true })).toBeEnabled()
  const originalToken = await attempts(page); expect(Object.keys(originalToken)).toHaveLength(1)
  await page.getByRole('link', { name: '购物车', exact: true }).first().click(); await page.locator('a[href="/product/900001"]').first().click()
  const writes = []; let drop = true
  await page.route('**/api/cart/items', async route => { if (route.request().method() !== 'POST') return route.continue(); writes.push(route.request().postDataJSON()); if (drop) { expect((await route.fetch()).status()).toBe(200); return route.abort('failed') } return route.continue() })
  await page.getByRole('button', { name: '加入购物车', exact: true }).click(); await expect(page.locator('.catalog-page [role="alert"]')).toContainText('加购结果未知')
  const original = await reference(page, id); expect(writes[0]).toEqual(original); expect((await json(page, '/api/cart')).cart.items[0].count).toBe(2)
  await reloadProtected(page); await expect(region(page)).toBeVisible(); expect(writes).toHaveLength(1); expect(await reference(page, id)).toEqual(original)
  const logout = page.waitForResponse(response => response.url().endsWith('/api/auth/logout') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '退出登录', exact: true }).click(); expect((await logout).status()).toBe(200); await expect(page.getByRole('button', { name: '退出登录', exact: true })).toHaveCount(0)
  await page.goto('/login?redirect=%2Fcart'); await signIn(page, account)
  await expect(region(page)).toContainText('服务端已执行过一次'); expect(writes).toHaveLength(1); expect(await attempts(page)).toEqual(originalToken)
  await api(page, '/api/cart', undefined, 'DELETE'); await page.reload(); await expect(region(page)).toContainText('旧请求不会恢复商品')
  expect((await json(page, '/api/cart')).cart.items).toHaveLength(0); expect(writes).toHaveLength(1); expect((await json(page, '/api/cart/items/requests/' + original.requestId)).executed).toBe(true)
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); const acknowledge = page.getByRole('button', { name: '已核对加购结果，继续购买', exact: true }); await expect(acknowledge).toBeEnabled(); await acknowledge.focus(); await page.keyboard.press('Enter')
  await expect(region(page)).toHaveCount(0); expect(await page.evaluate(key => sessionStorage.getItem(key), key(id))).toBeNull(); expect(await attempts(page)).toEqual(originalToken)
  drop = false; await page.goto('/product/900001'); await page.getByRole('button', { name: '加入购物车', exact: true }).click(); await expect(page.getByText('已加入购物车。', { exact: false })).toBeVisible()
  expect(writes).toHaveLength(2); expect(writes[1].requestId).not.toBe(original.requestId); expect((await json(page, '/api/cart')).cart.items[0].count).toBe(1)
  const other = await member(browser); expect((await json(other.page, '/api/cart/items/requests/' + original.requestId)).executed).toBe(false)
  await page.screenshot({ path: info.outputPath('durable-addition-mobile.png'), fullPage: true, mask: [page.locator('input')] })
})

test('会员增量未执行：原号显式重试、损坏记录确认结束及存储失败不发送', async ({ browser }, info) => {
  const { page, id } = await member(browser), writes = []; let block = true
  await page.goto('/product/900001')
  await page.route('**/api/cart/items', route => { if (route.request().method() !== 'POST') return route.continue(); writes.push(route.request().postDataJSON()); return block ? route.abort('failed') : route.continue() })
  await page.getByRole('button', { name: '加入购物车', exact: true }).click(); await expect(page.locator('.catalog-page [role="alert"]')).toContainText('加购结果未知'); const original = await reference(page, id)
  await reloadProtected(page); await page.getByRole('link', { name: '核对加购结果', exact: true }).click(); await expect(page.getByRole('button', { name: '重试原加购请求', exact: true })).toBeEnabled()
  expect(writes).toHaveLength(1); expect((await json(page, '/api/cart/items/requests/' + original.requestId)).executed).toBe(false)
  block = false; await page.getByRole('button', { name: '重试原加购请求', exact: true }).click(); await expect(region(page)).toContainText('服务端已执行过一次')
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]); expect((await json(page, '/api/cart')).cart.items[0].count).toBe(1)
  await page.getByRole('button', { name: '已核对加购结果，继续购买', exact: true }).click(); await expect(region(page)).toHaveCount(0)
  await page.evaluate(({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)), { key: key(id), value: { ...original, count: 2 } }); await page.reload()
  await expect(page.locator('.catalog-page [role="alert"]')).toContainText('原加购回执与本地记录不一致'); await expect(page.getByRole('button', { name: '已核对加购结果，继续购买', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '结束本地加购记录', exact: true }).click(); await page.getByRole('button', { name: '确认结束原加购请求', exact: true }).click(); await expect(region(page)).toHaveCount(0)
  await page.getByRole('button', { name: '刷新购物车 / 重试合并', exact: true }).click(); expect(writes).toHaveLength(2); expect((await json(page, '/api/cart')).cart.items[0].count).toBe(1)
  await page.evaluate(key => sessionStorage.setItem(key, '{broken'), key(id)); await page.reload(); await expect(region(page)).toContainText('原加购请求记录无法读取')
  await expect(page.getByRole('button', { name: '重试原加购请求', exact: true })).toHaveCount(0); await expect(page.getByRole('button', { name: '结算已选商品', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '已核对加购结果，继续购买', exact: true }).click(); await page.getByRole('button', { name: '保留原加购请求', exact: true }).click(); expect(await page.evaluate(key => sessionStorage.getItem(key), key(id))).toBe('{broken')
  await page.getByRole('button', { name: '已核对加购结果，继续购买', exact: true }).click(); await page.getByRole('button', { name: '确认结束原加购请求', exact: true }).click(); await expect(region(page)).toHaveCount(0); expect(writes).toHaveLength(2)
  await page.goto('/product/900001'); await page.evaluate(() => { const original = Storage.prototype.setItem; window.restoreAdditionStorage = () => { Storage.prototype.setItem = original }; Storage.prototype.setItem = function (key, value) { if (key.startsWith('gulimall-cart-add:')) throw new DOMException('isolated test quota', 'QuotaExceededError'); return original.call(this, key, value) } })
  await page.getByRole('button', { name: '加入购物车', exact: true }).click(); await expect(page.locator('.catalog-page [role="alert"]')).toContainText('本次未发送'); expect(writes).toHaveLength(2)
  await page.evaluate(() => window.restoreAdditionStorage()); await page.getByRole('button', { name: '刷新可售状态', exact: true }).click(); await page.getByRole('button', { name: '加入购物车', exact: true }).click(); await expect(page.getByText('已加入购物车。', { exact: false })).toBeVisible(); expect(writes).toHaveLength(3)
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); await page.screenshot({ path: info.outputPath('addition-retry-mobile.png'), fullPage: true, mask: [page.locator('input')] })
})
