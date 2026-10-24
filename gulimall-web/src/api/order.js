import request from './request'

/** Order list (REST CRUD) */
export function getOrders(params = { page: 1, limit: 10 }) {
  return request.get('/api/order/mine', { params })
}

/** Alipay payment page (returns HTML) */
export function getAlipayForm(orderSn) {
  return request.get(`/api/order/pay`, {
    params: { orderSn },
    responseType: 'text',
    transformResponse: [(data) => data],
  })
}
