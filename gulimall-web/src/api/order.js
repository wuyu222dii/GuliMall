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

export const getAlipayForm = (owner, orderSn) => request.post(`/api/order/mine/${orderSn}/payment`, {}, ownerConfig(owner))
export const getPaymentStatus = (owner, orderSn) => request.get(`/api/order/mine/${orderSn}/payment-status`, ownerConfig(owner))
export const retryPaymentEvents = (orderSn) => request.post(`/api/admin/order/payments/${orderSn}/retry`, {})
