const id = value => Number.isSafeInteger(value) && value > 0
const ids = values => Array.isArray(values) && values.length > 0 && values.length <= 100 && values.every(id) && new Set(values).size === values.length
export function parseProcurementRequest(raw) {
  if (raw === null) return null
  const request = JSON.parse(raw), p = request?.payload
  let valid = false
  if (p && request.type === 'save') valid = (p.id == null || id(p.id)) && id(p.skuId) && id(p.wareId) && Number.isInteger(p.skuNum) && p.skuNum >= 1 && p.skuNum <= 1000000 && /^\d{1,12}(\.\d{1,2})?$/.test(String(p.skuPrice))
  if (p?.creationRequestId != null) valid = valid && request.type === 'save' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(p.creationRequestId)
  if (p && request.type === 'merge') valid = (p.purchaseId == null || id(p.purchaseId)) && ids(p.items)
  if (p && ['receive', 'delete'].includes(request.type)) valid = id(p.id)
  if (p && request.type === 'finish') valid = id(p.id) && Array.isArray(p.items) && ids(p.items.map(item => item?.itemId)) && p.items.every(item => [3, 4].includes(item.status) && typeof item.reason === 'string' && item.reason.length <= 255 && (item.status === 3 || item.reason.trim()))
  if (!valid) throw new Error('采购操作记录不完整，请先核对原需求或采购单。')
  return request
}
export function demandMatches(actual, submitted) {
  return actual && ['skuId', 'wareId', 'skuNum'].every(key => actual[key] === submitted[key]) && Number(actual.skuPrice).toFixed(2) === Number(submitted.skuPrice).toFixed(2)
}
export function purchaseMatches(result, submitted) {
  return result?.purchase.id === submitted.id && [3, 4].includes(result.purchase.status) && result.items.length === submitted.items.length && submitted.items.every(item => result.items.some(actual => actual.id === item.itemId && actual.status === item.status && (actual.failureReason || '') === (item.status === 3 ? '' : item.reason.trim())))
}
export function receiptSignature(items) {
  return JSON.stringify(items.map(item => ({ itemId: item.itemId, status: item.status, reason: item.status === 4 ? item.reason : '' })).sort((a, b) => a.itemId - b.itemId))
}
