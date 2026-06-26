import request from './request'

/** 首页轮播广告 */
export function getHomeAdvList(params = { page: 1, limit: 10 }) {
  return request.get('/coupon-api/coupon/homeadv/list', { params })
}

/** 首页专题 */
export function getHomeSubjectList(params = { page: 1, limit: 10 }) {
  return request.get('/coupon-api/coupon/homesubject/list', { params })
}
