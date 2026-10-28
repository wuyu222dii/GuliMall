export const productStatuses = { 0: '草稿 / 已下架', 1: '已上架', 2: '历史下架' }
export function adminQuery(kind, search) {
  const params = new URLSearchParams(search)
  const productFields = ['page', 'key', 'status', 'brandId', 'catalogId']
  const fields = ({ products: productFields, orders: ['page', 'orderSn', 'status'], sync: [...productFields, 'syncPage', 'syncSpuId', 'syncState'], procurement: ['tab', 'page', 'wareId', 'status', 'key', 'skuId', 'purchaseId'], catalog: ['kind', 'page', 'key', 'catalogId', 'status', 'type'] })[kind]
  if (!fields) throw new Error('查询类型不正确。')
  if ([...params.keys()].some(key => !fields.includes(key) || params.getAll(key).length !== 1)) throw new Error('查询参数不正确，请清除条件后重试。')
  const result = Object.fromEntries(fields.map(key => [key, params.get(key) ?? (['page', 'syncPage'].includes(key) ? '1' : key === 'tab' ? 'demands' : key === 'kind' ? 'categories' : '')]))
  if (!/^[1-9][0-9]{0,6}$/.test(result.page) || Number(result.page) > 1000000) throw new Error('页码不正确，请清除条件后重试。')
  if (result.status && !({ products: /^[0-2]$/, sync: /^[0-2]$/, orders: /^[0-9]$/, procurement: /^[0-4]$/, catalog: /^[01]$/ })[kind].test(result.status)) throw new Error('筛选状态不正确。')
  if (kind === 'products' || kind === 'sync') {
    if (result.key.length > 100 || ['brandId', 'catalogId'].some(key => result[key] && !/^[1-9][0-9]{0,17}$/.test(result[key]))) throw new Error('商品筛选条件不正确。')
  } else if (kind === 'orders' && result.orderSn && !/^[a-f0-9]{32}$/.test(result.orderSn)) throw new Error('请填写完整的 32 位订单号。')
  if (kind === 'sync' && (!/^[1-9][0-9]{0,5}$/.test(result.syncPage) || Number(result.syncPage) > 100000 || result.syncSpuId && !/^[1-9][0-9]{0,17}$/.test(result.syncSpuId) || result.syncState && !/^[0-2]$/.test(result.syncState))) throw new Error('同步查询条件不正确。')
  if (kind === 'procurement') {
    if (!['demands', 'purchases', 'stock', 'warehouses'].includes(result.tab) || ['wareId', 'skuId', 'purchaseId'].some(key => result[key] && !/^[1-9][0-9]{0,17}$/.test(result[key]))) throw new Error('采购查询条件不正确。')
    if (result.key.length > 100 || result.tab !== 'warehouses' && result.key && !/^[1-9][0-9]{0,17}$/.test(result.key)) throw new Error('采购查询编号不正确。')
    if (result.tab !== 'purchases' && result.purchaseId || result.tab !== 'stock' && result.skuId || ['stock', 'warehouses'].includes(result.tab) && result.status || result.tab === 'stock' && result.key || result.tab === 'warehouses' && result.wareId) throw new Error('当前页签不支持这些查询条件。')
  }
  if (kind === 'catalog') {
    if (!['categories', 'brands', 'groups', 'attrs'].includes(result.kind) || result.key.length > 100 || result.catalogId && !/^[1-9][0-9]{0,17}$/.test(result.catalogId) || result.type && !/^[01]$/.test(result.type)) throw new Error('资料查询条件不正确。')
    if (!['groups', 'attrs'].includes(result.kind) && result.catalogId || !['brands', 'attrs'].includes(result.kind) && result.status || result.kind !== 'attrs' && result.type) throw new Error('当前资料类型不支持这些条件。')
  }
  return result
}
export function adminListUrl(kind, search) {
  const base = '/admin/' + kind
  try { adminQuery(kind, search); return base + (search ? search.startsWith('?') ? search : '?' + search : '') } catch { return base }
}
export function syncProductListUrl(search) {
  adminQuery('sync', search)
  const params = new URLSearchParams(search)
  for (const key of ['syncPage', 'syncSpuId', 'syncState']) params.delete(key)
  return adminListUrl('products', params.toString())
}
export function adminRedirect(value) {
  try {
    if (!value?.startsWith('/admin/')) return '/admin/products'
    const url = new URL(value, 'http://app.local')
    if (url.origin !== 'http://app.local' || url.hash) return '/admin/products'
    const products = /^\/admin\/products(?:\/(?:new|sync|[1-9][0-9]{0,18}\/edit))?$/.test(url.pathname)
    const orders = /^\/admin\/orders(?:\/[1-9][0-9]{0,18})?$/.test(url.pathname)
    if (products || orders) { adminQuery(url.pathname === '/admin/products/sync' ? 'sync' : products ? 'products' : 'orders', url.search); return url.pathname + url.search }
    if (['/admin/products/catalog', '/admin/procurement'].includes(url.pathname)) { adminQuery(url.pathname === '/admin/procurement' ? 'procurement' : 'catalog', url.search); return url.pathname + url.search }
  } catch { /* A malformed login target cannot become a navigation destination. */ }
  return '/admin/products'
}
