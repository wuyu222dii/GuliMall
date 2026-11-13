import { test, expect } from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import { readFileSync } from 'node:fs'
import { createCatalogFixture } from '../catalog-fixture.mjs'
import { json, login, openPage, closeContexts, fits } from './helpers.mjs'
let contexts = [], fixture
test.beforeEach(async () => { contexts = []; fixture = await createCatalogFixture() })
test.afterEach(async ({}, info) => { try { if (fixture) { fixture.sql(`DELETE FROM gulimall_pms_test.pms_attr_attrgroup_relation WHERE attr_id BETWEEN ${fixture.start} AND ${fixture.start + fixture.count - 1};`); fixture.remove() } } finally { await closeContexts(contexts, info) } })
const account = () => JSON.parse(readFileSync(process.env.GULIMALL_ADMIN_ACCESS_FILE, 'utf8'))
const row = (page, id) => page.locator('.admin-table tbody tr').filter({ has: page.getByRole('cell', { name: new RegExp('^' + id + '(?: · 当前定位)?$') }) })
async function write(page, kind, data) { const csrf = (await json(page, '/api/auth/csrf')).csrfToken, result = await page.request.post('/api/admin/product/admin/catalog/' + kind, { headers: { 'X-CSRF-Token': csrf }, data }); expect(result.status()).toBe(200); return result.json() }

test('后台分页：大样本URL返回、独立详情、保存定位、查询故障与原输入保护', async ({ browser }, info) => {
  const page = await openPage(browser, contexts), calls = []
  await login(page, account()); page.on('request', request => { if (request.method() === 'GET') calls.push(new URL(request.url()).pathname) })
  await page.goto('/admin/products/catalog?kind=brands&key=' + fixture.label + '&page=2')
  await expect(row(page, fixture.start + 20)).toBeVisible(); await expect(page.locator('.admin-table tbody tr')).toHaveCount(20)
  const second = page.url(); await page.reload(); await expect(row(page, fixture.start + 20)).toBeVisible()
  await page.getByRole('button', { name: '下一页', exact: true }).click(); await expect(row(page, fixture.start + 40)).toBeVisible()
  await page.goBack(); await expect(page).toHaveURL(second); await expect(row(page, fixture.start + 20)).toBeVisible()
  const id = fixture.start + 39
  await row(page, id).getByRole('button', { name: '编辑', exact: true }).click(); await expect(page.getByLabel('品牌名称', { exact: true })).toHaveValue(fixture.rows[39].name)
  await page.getByLabel('品牌名称', { exact: true }).fill(fixture.rows[39].name + ' 已编辑')
  await page.getByRole('button', { name: '下一页', exact: true }).click(); await page.getByRole('button', { name: '继续编辑', exact: true }).click(); await expect(page).toHaveURL(second)
  await page.getByRole('button', { name: '保存基础资料', exact: true }).click(); await expect(row(page, id)).toContainText('已编辑'); await expect(page.getByText(new RegExp('已定位品牌 #' + id))).toBeVisible()
  await page.route('**/api/admin/product/admin/catalog/brands/page?*', route => route.abort('failed'))
  await page.getByRole('button', { name: '刷新基础资料', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('品牌名称', { exact: true })).toBeDisabled(); await expect(row(page, id)).toContainText('已编辑')
  await page.unroute('**/api/admin/product/admin/catalog/brands/page?*'); await page.getByRole('button', { name: '重新加载资料', exact: true }).click(); await expect(page.getByLabel('品牌名称', { exact: true })).toBeEnabled()
  expect(calls).not.toContain('/api/admin/product/admin/catalog'); expect(calls).toContain('/api/admin/product/admin/catalog/brands/' + id)
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); await page.screenshot({ path: info.outputPath('catalog-pagination-mobile.png'), fullPage: true })
})

test('按需选项：分组详情与跨页回填、商品品牌查找、375px键盘及旧元数据兼容', async ({ browser }, info) => {
  const page = await openPage(browser, contexts), id = fixture.start + 199
  await login(page, account())
  await write(page, 'attrs', { attrId: id, attrName: fixture.rows[199].name, catelogId: 900003, attrType: 1, enable: 1, attrGroupId: id })
  await page.goto('/admin/products/catalog?kind=attrs&key=' + id)
  await row(page, id).getByRole('button', { name: '编辑', exact: true }).click()
  const group = page.getByLabel('属性分组', { exact: true }); await expect(group).toHaveValue(String(id)); await expect(group.locator('option:checked')).toHaveText(fixture.rows[199].name)
  await page.getByLabel('查找属性分组', { exact: true }).fill(fixture.rows[200].name); await page.getByRole('button', { name: '查找属性分组', exact: true }).click(); await expect(group.locator('option')).toContainText([fixture.rows[200].name])
  await group.selectOption(String(fixture.start + 200)); await page.getByRole('button', { name: '保存基础资料', exact: true }).click(); await expect(page.getByText('属性已保存。', { exact: true })).toBeVisible()
  expect((await json(page, '/api/admin/product/admin/catalog/attrs/' + id)).data.attrGroupId).toBe(fixture.start + 200)
  await page.goto('/admin/products?brandId=' + id); const brand = page.getByLabel('商品品牌', { exact: true })
  await expect(brand).toHaveValue(String(id)); await expect(brand.locator('option:checked')).toHaveText(fixture.rows[199].name)
  await page.getByLabel('查找商品品牌', { exact: true }).fill(fixture.label); await page.getByRole('button', { name: '查找商品品牌', exact: true }).click(); await expect(page.getByText('商品品牌第 1 / 12 页', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一页商品品牌', exact: true }).click(); await expect(brand.locator('option')).toContainText([fixture.rows[20].name]); await expect(brand).toHaveValue(String(id))
  await page.setViewportSize({ width: 375, height: 812 }); await page.getByLabel('查找商品品牌', { exact: true }).fill(fixture.rows[239].name); await page.getByLabel('查找商品品牌', { exact: true }).press('Enter'); await expect(brand.locator('option')).toContainText([fixture.rows[239].name])
  await brand.selectOption(String(fixture.start + 239)); await page.getByRole('button', { name: '查询', exact: true }).click(); await expect(page).toHaveURL(new RegExp('brandId=' + (fixture.start + 239))); await fits(page)
  const legacy = (await json(page, '/api/admin/product/admin/catalog')).data; expect(legacy.brands.some(row => row.brandId === id)).toBe(true)
  await page.screenshot({ path: info.outputPath('catalog-options-mobile.png'), fullPage: true })
})
