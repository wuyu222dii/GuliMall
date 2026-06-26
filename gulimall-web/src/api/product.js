import request from './request'

/** 首页二三级分类树 */
export function getCatalogJson() {
  return request.get('/index/catalog.json')
}

/** SKU 分页列表（搜索/列表页） */
export function getSkuList(params) {
  return request.get('/api/product/skuinfo/list', { params })
}

/** SKU 详情 */
export function getSkuInfo(skuId) {
  return request.get(`/api/product/skuinfo/info/${skuId}`)
}

/** 分类树 */
export function getCategoryTree() {
  return request.get('/api/product/category/list/tree')
}
