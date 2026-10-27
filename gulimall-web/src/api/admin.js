import request from './request'

export const getCatalog = () => request.get('/api/admin/product/admin/catalog')
export const saveCatalog = (kind, data) => request.post(`/api/admin/product/admin/catalog/${kind}`, data)
export const deleteCatalog = (kind, id) => request.delete(`/api/admin/product/admin/catalog/${kind}/${id}`)
export const listProducts = (params) => request.get('/api/admin/product/spuinfo/list', { params })
export const getProductEditor = (id) => request.get(`/api/admin/product/spuinfo/editor/${id}`)
export const saveProduct = (data) => request.post('/api/admin/product/spuinfo/editor', data)
export const listSkus = (params) => request.get('/api/admin/product/skuinfo/list', { params })
export const uploadImage = (file) => {
  const form = new FormData()
  form.append('file', file)
  return request.post('/api/admin/thirdparty/images', form)
}
export const warehouses = (params = { page: 1, limit: 20 }) => request.get('/api/admin/ware/wareinfo/list', { params })
export const saveWarehouse = (data) => request.post('/api/admin/ware/wareinfo/save', data)
export const updateWarehouse = (data) => request.post('/api/admin/ware/wareinfo/update', data)
export const listDemands = (params) => request.get('/api/admin/ware/purchasedetail/list', { params })
export const saveDemand = (data) => request.post(`/api/admin/ware/purchasedetail/${data.id ? 'update' : 'save'}`, data)
export const deleteDemand = (id) => request.post('/api/admin/ware/purchasedetail/delete', [id])
export const listPurchases = (params) => request.get('/api/admin/ware/purchase/list', { params })
export const getPurchase = (id) => request.get(`/api/admin/ware/purchase/info/${id}`)
export const mergeDemands = (data) => request.post('/api/admin/ware/purchase/merge', data)
export const receivePurchase = (id) => request.post('/api/admin/ware/purchase/received', [id])
export const finishPurchase = (data) => request.post('/api/admin/ware/purchase/done', data)
export const listStock = (params) => request.get('/api/admin/ware/waresku/list', { params })
export const listOrders = (params) => request.get('/api/admin/order/order/list', { params })

export const publishProduct = (id, status) => request.post(`/api/admin/product/search-sync/${id}/publish`, null, { params: { status }, timeout: 25000 })
export const listSearchSync = (params) => request.get('/api/admin/product/search-sync', { params })
export const retrySearchSync = (id) => request.post(`/api/admin/product/search-sync/${id}/retry`, null, { timeout: 25000 })
export const rebuildSearch = () => request.post('/api/admin/product/search-sync/rebuild')

export const findProductCreation = (requestId) => request.get(`/api/admin/product/spuinfo/creation/${requestId}`)
