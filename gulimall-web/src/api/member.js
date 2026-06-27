import request from './request'

/** Shipping address list */
export function getAddressList(params = { page: 1, limit: 20 }) {
  return request.get('/api/member/memberreceiveaddress/list', { params })
}

export function getAddressInfo(id) {
  return request.get(`/api/member/memberreceiveaddress/info/${id}`)
}

export function saveAddress(data) {
  return request.post('/api/member/memberreceiveaddress/save', data)
}

export function updateAddress(data) {
  return request.post('/api/member/memberreceiveaddress/update', data)
}

export function deleteAddress(ids) {
  return request.post('/api/member/memberreceiveaddress/delete', ids)
}
