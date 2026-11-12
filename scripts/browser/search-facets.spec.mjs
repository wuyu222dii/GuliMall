import { test, expect } from '../../gulimall-web/node_modules/@playwright/test/index.mjs'
import { assertTestEnvironment } from '../test-environment.mjs'
import { createFacetFixture } from '../search-facet-fixture.mjs'
import { openPage, closeContexts, fits, json } from './helpers.mjs'
let contexts = [], fixture
test.beforeEach(async () => { contexts = []; fixture = null; await assertTestEnvironment() })
test.afterEach(async ({}, info) => { try { await closeContexts(contexts, info) } finally { if (fixture) await fixture.remove() } })
const capacity = page => page.getByRole('combobox', { name: '规格 容量（100）', exact: true })
const count = (page, n) => expect(page.locator('.search-header')).toContainText(`共找到 ${n} 件商品`)
test('搜索规格：跨页全量选项、单选组合、逐项移除、URL刷新返回与窄屏', async ({ browser }, info) => {
  fixture = await createFacetFixture(); const page = await openPage(browser, contexts)
  await page.goto('/search?' + new URLSearchParams({ keyword: fixture.label, sort: 'price_asc' })); await count(page, 15); await expect(page.locator('.product-card')).toHaveCount(12)
  await expect(capacity(page).locator('option')).toHaveCount(3); await expect(capacity(page).locator('option', { hasText: fixture.b })).toHaveCount(1)
  const first = (await json(page, '/api/search?' + new URLSearchParams({ keyword: fixture.label, sort: 'price_asc', limit: '12' }))).page
  expect(first.list.every(sku => !sku.attrs.some(attr => attr.attrId === 100 && attr.attrValue === fixture.b))).toBe(true)
  await page.getByRole('button', { name: '下一页', exact: true }).click(); await expect(page.locator('.product-card')).toHaveCount(3); const secondUrl = page.url()
  await capacity(page).selectOption(fixture.b); await page.getByRole('button', { name: '应用筛选', exact: true }).click(); await count(page, 2); expect(new URL(page.url()).searchParams.getAll('attrs')).toEqual(['100_' + fixture.b]); expect(new URL(page.url()).searchParams.get('page')).toBe('1')
  await page.reload(); await count(page, 2); await page.goBack(); await expect(page).toHaveURL(secondUrl); await count(page, 15); await expect(page.locator('.product-card')).toHaveCount(3)
  await capacity(page).selectOption(fixture.a); await page.getByRole('combobox', { name: '规格 颜色（200）', exact: true }).selectOption('红色'); await page.getByRole('button', { name: '应用筛选', exact: true }).click(); await count(page, 14)
  await page.getByRole('button', { name: /^移除规格 容量：/ }).click(); await count(page, 14); expect(new URL(page.url()).searchParams.getAll('attrs')).toEqual(['200_红色'])
  await page.getByRole('button', { name: '清除规格 颜色（200）', exact: true }).click(); await count(page, 15)
  const legacy = new URLSearchParams({ keyword: fixture.label, catalog3Id: '900003', page: '2' }); legacy.append('brandId', '900001'); legacy.append('brandId', '900002'); legacy.append('attrs', '100_' + fixture.a); legacy.append('attrs', '100_' + fixture.a)
  await page.goto('/search?' + legacy); await count(page, 14); await expect(capacity(page).locator('option:checked')).toContainText('旧链接同时要求2项')
  await page.getByLabel('排序', { exact: true }).selectOption('price_desc'); await page.getByRole('button', { name: '应用筛选', exact: true }).click(); await count(page, 14)
  expect(new URL(page.url()).searchParams.getAll('attrs')).toEqual(['100_' + fixture.a, '100_' + fixture.a]); expect(new URL(page.url()).searchParams.getAll('brandId')).toEqual(['900001', '900002'])
  const copy = await page.context().newPage(); await copy.goto(page.url()); await count(copy, 14); await copy.close()
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); const remove = page.getByRole('button', { name: /^移除规格 容量：/ }).first(); await remove.focus(); await page.keyboard.press('Enter'); await count(page, 14); expect(new URL(page.url()).searchParams.getAll('attrs')).toEqual(['100_' + fixture.a])
  await page.screenshot({ path: info.outputPath('specification-filters-mobile.png'), fullPage: true, mask: [page.locator('input')] })
  await page.getByRole('link', { name: '清除全部条件', exact: true }).click(); await expect(page).toHaveURL(/\/search$/); await expect(page.getByRole('region', { name: '已选搜索条件', exact: true })).toHaveCount(0)
})
test('搜索规格：截断条件保留、零结果、查询失败及原URL恢复', async ({ browser }, info) => {
  fixture = await createFacetFixture(); const page = await openPage(browser, contexts), params = new URLSearchParams({ keyword: fixture.capsLabel }); params.append('attrs', '1021_常用'); params.append('attrs', '1001_值_50,中文')
  await page.goto('/search?' + params); await count(page, 1); const original = page.url()
  await expect(page.getByRole('region', { name: '规格筛选', exact: true })).toContainText('仅展示前20个属性'); await expect(page.getByText('此属性仅展示前50个值，已选值仍保留。', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^移除规格 1021：常用/ })).toBeVisible(); await expect(page.getByRole('combobox', { name: '规格 多值规格（1001）', exact: true })).toHaveValue('值_50,中文')
  await page.reload(); await count(page, 1); expect(page.url()).toBe(original)
  await page.route('**/api/search?**', route => route.abort('failed')); await page.getByLabel('排序', { exact: true }).selectOption('price_asc'); await page.getByRole('button', { name: '应用筛选', exact: true }).click(); await expect(page.getByRole('button', { name: '重试搜索', exact: true })).toBeVisible(); await expect(page.locator('.search-header')).toHaveCount(0); await expect(page.getByRole('region', { name: '规格筛选', exact: true })).toHaveCount(0)
  expect(new URL(page.url()).searchParams.getAll('attrs')).toEqual(['1021_常用', '1001_值_50,中文']); await page.unroute('**/api/search?**'); await page.getByRole('button', { name: '重试搜索', exact: true }).click(); await count(page, 1)
  const zero = new URLSearchParams({ keyword: fixture.label }); zero.append('attrs', '100_不存在的值'); await page.goto('/search?' + zero); await count(page, 0); await expect(page.getByRole('region', { name: '规格筛选', exact: true })).toContainText('当前条件下暂无可选规格')
  await page.setViewportSize({ width: 375, height: 812 }); await fits(page); await page.getByRole('button', { name: /^移除规格 100：不存在的值/ }).focus(); await page.keyboard.press('Enter'); await count(page, 15)
  await page.screenshot({ path: info.outputPath('specification-recovery-mobile.png'), fullPage: true, mask: [page.locator('input')] })
})
