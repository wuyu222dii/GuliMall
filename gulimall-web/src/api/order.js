import request from './request'

/** 订单列表（REST CRUD） */
export function getOrders(params = { page: 1, limit: 10 }) {
  return request.get('/order-api/order/order/list', { params })
}

/** 支付宝支付页（返回 HTML） */
export function getAlipayForm(orderSn) {
  return request.get(`/order-api/aliPayOrder`, {
    params: { orderSn },
    responseType: 'text',
    transformResponse: [(data) => data],
  })
}
