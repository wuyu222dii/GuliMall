import request from './request'

/** Batch check whether SKUs are in stock */
export function getSkuHasStock(skuIds) {
  return request.post('/api/ware/waresku/hasstock', skuIds)
}
