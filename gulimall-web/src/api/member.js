import request from './request'
const ownerHeaders = owner => owner == null ? {} : { headers: { 'X-Address-Owner': String(owner) } }
export const getAddressList = (params = { page: 1, limit: 20 }, owner) => request.get('/api/member/addresses', { params, ...ownerHeaders(owner) })
export const getAddressInfo = (id, owner) => request.get(`/api/member/addresses/${id}`, ownerHeaders(owner))
export const findAddressCreation = (requestId, owner) => request.get(`/api/member/addresses/creation/${requestId}`, ownerHeaders(owner))
export const saveAddress = (data, owner) => request.post('/api/member/addresses', data, ownerHeaders(owner))
export const updateAddress = (data, owner) => request.put(`/api/member/addresses/${data.id}`, data, ownerHeaders(owner))
export const setDefaultAddress = (id, owner) => request.put(`/api/member/addresses/${id}/default`, {}, ownerHeaders(owner))
export const deleteAddress = (ids, owner) => request.delete('/api/member/addresses', { data: ids, ...ownerHeaders(owner) })
