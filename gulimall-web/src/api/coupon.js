import request from './request'

/** Home page carousel ads */
export function getHomeAdvList(params = { page: 1, limit: 10 }) {
  return request.get('/coupon-api/coupon/homeadv/list', { params })
}

/** Home page featured topics */
export function getHomeSubjectList(params = { page: 1, limit: 10 }) {
  return request.get('/coupon-api/coupon/homesubject/list', { params })
}
