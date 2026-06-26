import request from './request'

/** 批量查询 SKU 是否有库存 */
export function getSkuHasStock(skuIds) {
  return request.post('/api/ware/waresku/hasstock', skuIds)
}
