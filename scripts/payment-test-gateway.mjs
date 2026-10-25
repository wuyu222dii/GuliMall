// Local verification fixture only. Never configure these keys on Alipay or a production service.
import { createServer } from 'node:http'
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const body64 = (value) => value.toString('base64')
const privateKey = (value) => createPrivateKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'pkcs8' })
const publicKey = (value) => createPublicKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'spki' })
const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'der' } })
const canonical = (params, callback = false) => Object.keys(params).filter(key => key !== 'sign' && (!callback || key !== 'sign_type') && params[key] !== '' && params[key] != null).sort().map(key => `${key}=${params[key]}`).join('&')
export const providerTime = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date)
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
export function testConfig(path = '.tools/payment-test-config.json') {
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
  const merchant = pair(), provider = pair()
  const config = { mode: 'LOCAL_TEST', appId: 'local-test-app', sellerId: 'local-test-seller', merchantPrivate: body64(merchant.privateKey), merchantPublic: body64(merchant.publicKey), providerPrivate: body64(provider.privateKey), providerPublic: body64(provider.publicKey), controlToken: randomBytes(32).toString('hex'), notifyUrl: 'http://127.0.0.1:88/api/payments/alipay/notify', returnUrl: 'http://127.0.0.1:5173/payment/return' }
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(config, null, 2)); return config
}
export async function createPaymentGateway({ config, port = 0 } = {}) {
  if (!config || config.mode !== 'LOCAL_TEST') throw new Error('Explicit local test configuration required')
  const trades = new Map(), options = { down: false, badResponseSignature: false, closeDelay: 0, closeUnknown: false, skipNotify: false }
  const sockets = new Set(), provider = privateKey(config.providerPrivate), merchant = publicKey(config.merchantPublic)
  const signed = data => sign('RSA-SHA256', Buffer.from(data), provider).toString('base64')
  const put = (sn, changes = {}) => {
    const original = trades.get(sn) || { orderSn: sn, tradeNo: 'test_' + randomUUID().replaceAll('-', ''), state: 'WAIT_BUYER_PAY', amount: '0.10', paidAt: null, nonce: randomBytes(24).toString('hex'), notifyUrl: config.notifyUrl, returnUrl: config.returnUrl + '?orderSn=' + sn }
    Object.assign(original, changes); trades.set(sn, original); return original
  }
  const notify = async (sn, overrides = {}) => {
    const trade = trades.get(sn); if (!trade) throw new Error('Unknown fixture trade')
    const params = { app_id: config.appId, seller_id: config.sellerId, out_trade_no: sn, trade_no: trade.tradeNo, trade_status: trade.state, total_amount: trade.amount, gmt_payment: trade.paidAt || providerTime(), notify_type: 'trade_status_sync', notify_id: randomUUID(), sign_type: 'RSA2', ...overrides }
    if (overrides.sign === undefined) params.sign = signed(canonical(params, true))
    const response = await fetch(trade.notifyUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(15000) })
    return { status: response.status, body: await response.text() }
  }
  const reply = (res, method, data) => {
    const signature = options.badResponseSignature ? Buffer.from('bad signature').toString('base64') : signed(JSON.stringify(data))
    res.writeHead(200, { 'Content-Type': 'application/json;charset=UTF-8' }); res.end(JSON.stringify({ [method.replaceAll('.', '_') + '_response']: data, sign: signature }))
  }
  const page = (res, html, status = 200) => { res.writeHead(status, { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' }); res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local payment verification</title><style>body{font:16px/1.6 system-ui;margin:24px;max-width:700px;color:#222}button,a{font:inherit;padding:10px 16px}strong{color:#b51e24}input{font:inherit}</style><body><h1>Local payment verification</h1><p><strong>This is not Alipay sandbox. No real funds or account are used.</strong></p>${html}</body></html>`) }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1'), chunks = []
      for await (const chunk of req) { chunks.push(chunk); if (chunks.reduce((sum, item) => sum + item.length, 0) > 262144) throw new Error('Request too large') }
      const raw = Buffer.concat(chunks).toString('utf8')
      if (url.pathname === '/control') {
        if (req.headers.authorization !== 'Bearer ' + config.controlToken) { res.writeHead(403); res.end(); return }
        const command = raw ? JSON.parse(raw) : {}
        if (command.action === 'set') put(command.sn, command.trade)
        if (command.action === 'options') Object.assign(options, command.options)
        const result = command.action === 'notify' ? await notify(command.sn, command.overrides) : { trades: [...trades.values()] }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(result)); return
      }
      if (url.pathname === '/gateway.do') {
        if (options.down) { res.writeHead(503); res.end('local provider unavailable'); return }
        const params = Object.fromEntries(url.searchParams)
        for (const [key, value] of new URLSearchParams(raw)) { if (params[key] && params[key] !== value) throw new Error('Ambiguous parameters'); params[key] = value }
        if (params.app_id !== config.appId || params.sign_type !== 'RSA2' || !verify('RSA-SHA256', Buffer.from(canonical(params)), merchant, Buffer.from(params.sign || '', 'base64'))) { res.writeHead(403); res.end('invalid merchant signature'); return }
        const biz = JSON.parse(params.biz_content || '{}'), sn = biz.out_trade_no
        if (!/^[a-f0-9]{32}$/.test(sn || '')) throw new Error('Invalid fixture order')
        const existing = trades.get(sn)
        if (params.method === 'alipay.trade.page.pay') {
          if (biz.seller_id !== config.sellerId || !/^\d+(\.\d{1,2})?$/.test(biz.total_amount || '') || !biz.time_expire) throw new Error('Invalid signed business fields')
          if (existing?.state === 'TRADE_CLOSED') { page(res, '<p>Trade already closed. Return to the original order.</p>', 409); return }
          const trade = put(sn, { amount: Number(biz.total_amount).toFixed(2), subject: biz.subject, expiresAt: biz.time_expire, notifyUrl: params.notify_url, returnUrl: params.return_url })
          page(res, `<p>Order: ${escape(sn)}</p><p>Total: ¥${escape(trade.amount)}</p><p>${escape(trade.subject)}</p><form method="post" action="/checkout/${sn}/pay"><input type="hidden" name="nonce" value="${trade.nonce}"><button type="submit">Confirm local test payment</button></form><p><a href="${escape(trade.returnUrl)}">Return without paying</a></p>`); return
        }
        if (!existing) { reply(res, params.method, { code: '40004', msg: 'Business Failed', sub_code: 'ACQ.TRADE_NOT_EXIST', sub_msg: 'Local fixture trade absent' }); return }
        if (params.method === 'alipay.trade.query') {
          const result = { code: '10000', msg: 'Success', out_trade_no: sn, trade_no: existing.tradeNo, trade_status: existing.state, total_amount: existing.amount, seller_id: config.sellerId }
          if (existing.paidAt) result.send_pay_date = existing.paidAt
          reply(res, params.method, result); return
        }
        if (params.method === 'alipay.trade.close') {
          if (options.closeDelay) await new Promise(resolve => setTimeout(resolve, options.closeDelay))
          if (!options.closeUnknown && ['WAIT_BUYER_PAY', 'TRADE_CLOSED'].includes(existing.state)) { existing.state = 'TRADE_CLOSED'; reply(res, params.method, { code: '10000', msg: 'Success', out_trade_no: sn, trade_no: existing.tradeNo }) }
          else reply(res, params.method, { code: '40004', msg: 'Business Failed', sub_code: 'ACQ.TRADE_STATUS_ERROR', sub_msg: 'Local close result not confirmed' })
          return
        }
        throw new Error('Unsupported SDK method')
      }
      const payment = url.pathname.match(/^\/checkout\/([a-f0-9]{32})\/pay$/)
      if (payment && req.method === 'POST') {
        const trade = trades.get(payment[1]), fields = new URLSearchParams(raw)
        if (!trade || fields.get('nonce') !== trade.nonce) throw new Error('Unknown local payment')
        if (trade.state === 'TRADE_CLOSED' || trade.expiresAt && trade.expiresAt <= providerTime()) { page(res, '<p>The local trade has expired or closed.</p>', 409); return }
        trade.state = 'TRADE_SUCCESS'; trade.paidAt ||= providerTime()
        if (!options.skipNotify) { try { await notify(trade.orderSn) } catch { /* The application's verified query is exercised as fallback. */ } }
        res.writeHead(303, { Location: trade.returnUrl }); res.end(); return
      }
      page(res, '<p>Open a signed form from the local GuliMall payment page.</p>')
    } catch { if (!res.headersSent) { res.writeHead(400); res.end('Invalid local test request') } else res.end() }
  })
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  return { url: `http://127.0.0.1:${server.address().port}`, config, options, trades, put, notify, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)) } }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.GULIMALL_ACCEPTANCE !== '1') throw new Error('Explicit GULIMALL_ACCEPTANCE=1 is required for the local fixture gateway.')
  const config = testConfig(process.env.PAYMENT_TEST_CONFIG || '.tools/payment-test-config.json')
  const gateway = await createPaymentGateway({ config, port: Number(process.env.PAYMENT_TEST_PORT || 18170) })
  console.log(JSON.stringify({ mode: 'LOCAL_TEST', url: gateway.url, configuration: process.env.PAYMENT_TEST_CONFIG || '.tools/payment-test-config.json' }))
}
