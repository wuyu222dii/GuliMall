import request from './request'

/** Home page category tree (levels 2–3) */
export function getCatalogJson() {
  return request.get('/index/catalog.json')
}

/** Paginated SKU list (search/list pages) */
export function getSkuList(params) {
  return request.get('/api/product/skuinfo/list', { params })
}

/** SKU details */
export function getSkuInfo(skuId) {
  return request.get(`/api/product/skuinfo/info/${skuId}`)
}

/** Category tree */
export function getCategoryTree() {
  return request.get('/api/product/category/list/tree')
}
