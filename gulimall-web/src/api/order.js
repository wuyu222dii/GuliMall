import request from './request'

/** Order list (REST CRUD) */
export function getOrders(params = { page: 1, limit: 10 }) {
  return request.get('/order-api/order/order/list', { params })
}

/** Alipay payment page (returns HTML) */
export function getAlipayForm(orderSn) {
  return request.get(`/order-api/aliPayOrder`, {
    params: { orderSn },
    responseType: 'text',
    transformResponse: [(data) => data],
  })
}
