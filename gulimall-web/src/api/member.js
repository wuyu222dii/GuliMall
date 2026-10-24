import request from './request'
export const getAddressList = (params = { page: 1, limit: 20 }) => request.get('/api/member/addresses', { params })
export const getAddressInfo = (id) => request.get(`/api/member/addresses/${id}`)
export const saveAddress = (data) => request.post('/api/member/addresses', data)
export const updateAddress = (data) => request.put(`/api/member/addresses/${data.id}`, data)
export const deleteAddress = (ids) => request.delete('/api/member/addresses', { data: ids })
