export const productStatuses = { 0: '草稿 / 已下架', 1: '已上架', 2: '历史下架' }
export function adminQuery(kind, search) {
  const params = new URLSearchParams(search)
  const fields = kind === 'products' ? ['page', 'key', 'status', 'brandId', 'catalogId'] : ['page', 'orderSn', 'status']
  if ([...params.keys()].some(key => !fields.includes(key) || params.getAll(key).length !== 1)) throw new Error('查询参数不正确，请清除条件后重试。')
  const result = Object.fromEntries(fields.map(key => [key, params.get(key) ?? (key === 'page' ? '1' : '')]))
  if (!/^[1-9][0-9]{0,6}$/.test(result.page) || Number(result.page) > 1000000) throw new Error('页码不正确，请清除条件后重试。')
  if (result.status && !(kind === 'products' ? /^[0-2]$/ : /^[0-9]$/).test(result.status)) throw new Error('筛选状态不正确。')
  if (kind === 'products') {
    if (result.key.length > 100 || ['brandId', 'catalogId'].some(key => result[key] && !/^[1-9][0-9]{0,17}$/.test(result[key]))) throw new Error('商品筛选条件不正确。')
  } else if (result.orderSn && !/^[a-f0-9]{32}$/.test(result.orderSn)) throw new Error('请填写完整的 32 位订单号。')
  return result
}
export function adminListUrl(kind, search) {
  const base = '/admin/' + kind
  try { adminQuery(kind, search); return base + (search ? search.startsWith('?') ? search : '?' + search : '') } catch { return base }
}
export function adminRedirect(value) {
  try {
    if (!value?.startsWith('/admin/')) return '/admin/products'
    const url = new URL(value, 'http://app.local')
    if (url.origin !== 'http://app.local' || url.hash) return '/admin/products'
    const products = /^\/admin\/products(?:\/(?:new|sync|[1-9][0-9]{0,18}\/edit))?$/.test(url.pathname)
    const orders = /^\/admin\/orders(?:\/[1-9][0-9]{0,18})?$/.test(url.pathname)
    if (products || orders) { adminQuery(products ? 'products' : 'orders', url.search); return url.pathname + url.search }
    if (['/admin/products/catalog', '/admin/procurement'].includes(url.pathname) && !url.search) return url.pathname
  } catch { /* A malformed login target cannot become a navigation destination. */ }
  return '/admin/products'
}
