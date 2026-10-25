export const orderStatuses = { 0: 'Pending payment', 1: 'Paid', 2: 'Shipped', 3: 'Completed', 4: 'Closed', 5: 'Invalid order', 6: 'Creating — inventory pending', 7: 'Closing — release pending', 8: 'Closing — payment result pending', 9: 'Payment exception — manual review required' }
export function paymentTarget(action, mode) {
  const url = new URL(action)
  const sandbox = mode === 'ALIPAY_SANDBOX' && url.protocol === 'https:' && ['openapi-sandbox.dl.alipaydev.com', 'openapi.alipaydev.com'].includes(url.hostname) && !url.port
  const local = mode === 'LOCAL_TEST' && url.protocol === 'http:' && url.hostname === '127.0.0.1'
  if ((!sandbox && !local) || url.pathname !== '/gateway.do' || url.username || url.password || url.hash) throw new Error('Payment gateway is not an allowed sandbox or local test endpoint.')
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
  if (!parsed) throw new Error('Payment form is incomplete; query the original order before retrying.')
  const form = document.createElement('form')
  form.action = paymentTarget(parsed.getAttribute('action'), mode); form.method = 'POST'; form.hidden = true
  const inputs = [...parsed.querySelectorAll('input[type="hidden"]')], seen = new Set()
  if (!inputs.length || inputs.length > 50) throw new Error('Payment fields are incomplete.')
  for (const source of inputs) {
    if (!/^[a-z_]{1,64}$/.test(source.name) || seen.has(source.name) || source.value.length > 32768) throw new Error('Payment fields are invalid.')
    seen.add(source.name)
    const input = document.createElement('input'); input.type = 'hidden'; input.name = source.name; input.value = source.value; form.append(input)
  }
  const actionFields = new URL(form.action).searchParams
  if (!(seen.has('sign') || actionFields.has('sign')) || !(seen.has('biz_content') || actionFields.has('biz_content'))) throw new Error('Signed payment fields are missing.')
  document.body.append(form); HTMLFormElement.prototype.submit.call(form)
}
