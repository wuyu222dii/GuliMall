import request from './request'
const ownerConfig = (owner) => ({ headers: { 'X-Cart-Owner': String(owner) } })
export const confirmOrder = (owner) => request.post('/api/order/mine/confirm', {}, ownerConfig(owner))
export const submitOrder = (owner, token, addressId) => request.post('/api/order/mine/submit', { token, addressId }, ownerConfig(owner))
export const getSubmission = (owner, token) => request.get(`/api/order/mine/submissions/${token}`, ownerConfig(owner))
export const retireConfirmation = (owner, token) => request.post(`/api/order/mine/submissions/${token}/retire`, {}, ownerConfig(owner))
export const getOrder = (id, owner) => request.get(`/api/order/mine/${id}`, ownerConfig(owner))

/** Order list (REST CRUD) */
export function getOrders(params = { page: 1, limit: 10 }, owner) {
  return request.get('/api/order/mine', { params, ...ownerConfig(owner) })
}

export const getAlipayForm = (owner, orderSn) => request.post(`/api/order/mine/${orderSn}/payment`, {}, ownerConfig(owner))
export const getPaymentStatus = (owner, orderSn) => request.get(`/api/order/mine/${orderSn}/payment-status`, ownerConfig(owner))
export const retryPaymentEvents = (orderSn) => request.post(`/api/admin/order/payments/${orderSn}/retry`, {})
export const cancelOrder = (owner, id) => request.post(`/api/order/mine/${id}/cancel`, {}, ownerConfig(owner))
export const receiveOrder = (owner, id) => request.post(`/api/order/mine/${id}/receive`, {}, ownerConfig(owner))
export const getAdminOrder = (id) => request.get(`/api/admin/order/order/info/${id}`)
export const getOrderProcessing = (id) => request.get(`/api/admin/order/order/${id}/processing`)
export const shipOrder = (id, shipment) => request.post(`/api/admin/order/order/${id}/ship`, shipment)
