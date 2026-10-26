export const orderStatuses = { 0: '待付款', 1: '已支付', 2: '已发货', 3: '已完成', 4: '已关闭', 5: '无效订单', 6: '创建中，等待库存确认', 7: '关闭中，等待释放确认', 8: '关闭中，等待付款确认', 9: '付款异常，需人工核对' }
export const canStartNewConfirmation = (status) => Number.isInteger(status) && status >= 0 && status <= 5
export const paymentSettled = (order) => order?.status === 3 || order?.status === 4 && order.inventoryStatus === 2
export function paymentTarget(action, mode) {
  const url = new URL(action)
  const sandbox = mode === 'ALIPAY_SANDBOX' && url.protocol === 'https:' && ['openapi-sandbox.dl.alipaydev.com', 'openapi.alipaydev.com'].includes(url.hostname) && !url.port
  const local = mode === 'LOCAL_TEST' && url.protocol === 'http:' && url.hostname === '127.0.0.1'
  if ((!sandbox && !local) || url.pathname !== '/gateway.do' || url.username || url.password || url.hash) throw new Error('付款地址不是允许的沙箱或本地模拟网关。')
  return url.href
}
export function memberRedirect(value) {
  if (['/member/orders', '/member/address', '/checkout', '/cart'].includes(value)) return value
  if (value?.startsWith('/payment/return?')) {
    const parsed = new URL(value, 'http://app.local'), numbers = parsed.searchParams.getAll('orderSn')
    if (!parsed.hash && numbers.length === 1 && /^[a-f0-9]{32}$/.test(numbers[0])) return `/payment/return?orderSn=${numbers[0]}`
  }
  return /^\/payment\/(?:[a-f0-9]{32}|return\?orderSn=[a-f0-9]{32})$/.test(value || '') ? value : '/'
}
export function submitPaymentForm(html, mode) {
  const parsed = new DOMParser().parseFromString(html, 'text/html').querySelector('form')
  if (!parsed) throw new Error('付款表单不完整，请查询原订单后再重试。')
  const form = document.createElement('form')
  form.action = paymentTarget(parsed.getAttribute('action'), mode); form.method = 'POST'; form.hidden = true
  const inputs = [...parsed.querySelectorAll('input[type="hidden"]')], seen = new Set()
  if (!inputs.length || inputs.length > 50) throw new Error('付款参数不完整。')
  for (const source of inputs) {
    if (!/^[a-z_]{1,64}$/.test(source.name) || seen.has(source.name) || source.value.length > 32768) throw new Error('付款参数无效。')
    seen.add(source.name)
    const input = document.createElement('input'); input.type = 'hidden'; input.name = source.name; input.value = source.value; form.append(input)
  }
  const actionFields = new URL(form.action).searchParams
  if (!(seen.has('sign') || actionFields.has('sign')) || !(seen.has('biz_content') || actionFields.has('biz_content'))) throw new Error('缺少已签名的付款参数。')
  document.body.append(form); HTMLFormElement.prototype.submit.call(form)
}
