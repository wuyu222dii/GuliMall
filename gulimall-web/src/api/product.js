import request from './request'

/** Paginated SKU list (search/list pages) */
export function getSkuList(params) {
  return request.get('/api/product/items', { params })
}

/** SKU details */
export function getSkuInfo(skuId) {
  return request.get(`/api/product/items/${skuId}`)
}

/** Category tree */
export function getCategoryTree() {
  return request.get('/api/product/categories')
}

export function getBrands(catalogId) {
  return request.get('/api/product/brands', { params: { catalogId } })
}

export function checkPurchase(skuId) {
  return request.get(`/api/product/items/${skuId}/purchase-check`)
}

export async function checkCartItems(items) {
  if (items.some((item) => !Number.isInteger(item.count) || item.count < 1 || item.count > 999)) {
    throw new Error('Quantity must be a whole number from 1 to 999.')
  }
  return Promise.all(items.map(async (item) => {
    try { return { ...item, ...(await checkPurchase(item.skuId)).skuInfo } }
    catch (error) { throw new Error(`${item.skuName}: ${error.message}`) }
  }))
}
