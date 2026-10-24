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

export const searchProducts = (params) => request.get('/api/search', { params })
