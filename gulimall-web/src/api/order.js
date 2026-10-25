import request from './request'
const ownerConfig = (owner) => ({ headers: { 'X-Cart-Owner': String(owner) } })
export const confirmOrder = (owner) => request.post('/api/order/mine/confirm', {}, ownerConfig(owner))
export const submitOrder = (owner, token, addressId) => request.post('/api/order/mine/submit', { token, addressId }, ownerConfig(owner))
export const getSubmission = (owner, token) => request.get(`/api/order/mine/submissions/${token}`, ownerConfig(owner))
export const retireConfirmation = (owner, token) => request.post(`/api/order/mine/submissions/${token}/retire`, {}, ownerConfig(owner))
export const getOrder = (id) => request.get(`/api/order/mine/${id}`)

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
