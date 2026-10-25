import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getAlipayForm, getPaymentStatus } from '../api/order'
import { useAuthStore } from '../store/authStore'
import { orderStatuses, submitPaymentForm } from '../utils/payment'
export default function Payment() {
  const user = useAuthStore((s) => s.user)
  const params = useParams(), [query] = useSearchParams()
  const sn = params.orderSn || query.get('orderSn')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setResult(null); setError('')
    const load = () => {
      if (!/^[a-f0-9]{32}$/.test(sn || '')) { setError('Invalid order number.'); return }
      getPaymentStatus(user.id, sn).then((res) => { if (active) { setResult(res.payment); setError('') } }).catch((e) => { if (active) setError(e.message) })
    }
    load(); const timer = setInterval(load, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [user.id, sn, retry])
  const pay = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await getAlipayForm(user.id, sn)
      if (useAuthStore.getState().user?.id === user.id) submitPaymentForm(res.payment.html, res.payment.mode)
    } catch (e) { setError(`${e.message} Your original order is kept. Refresh its status before retrying.`) }
    finally { setBusy(false) }
  }
  const order = result?.order
  return <div className="container catalog-page"><h1 className="page-title">Payment status</h1>
    {result?.mode === 'LOCAL_TEST' && <p className="error-msg" role="status">Local payment verification only. This is not Alipay sandbox and no real payment is made.</p>}
    {error && <p className="error-msg" role="alert">{error}</p>}
    {!result && !error && <p role="status">Reading your order status…</p>}
    {order && <section className="card order-summary"><h2>{orderStatuses[order.status] || 'Unknown'}</h2><p className="order-number">Order No.: {order.orderSn}</p><p>Total: <strong className="price">¥{Number(order.payAmount).toFixed(2)}</strong></p>
      <p>This page only reads the server result. Returning from a payment page does not mark an order paid.</p>
      {order.status === 0 && <><p>Pay before {new Date(order.paymentDeadline).toLocaleString()}. Closing may keep stock reserved until the payment result is confirmed.</p>{!result.configured && <p className="error-msg">Alipay sandbox is not configured. Contact the administrator; payment is unavailable.</p>}<button className="btn btn-primary" disabled={busy || !result.configured} onClick={pay}>{busy ? 'Opening payment…' : result.mode === 'LOCAL_TEST' ? 'Open local test payment' : 'Pay with Alipay sandbox'}</button></>}
      {order.status === 1 && <p role="status">{order.fulfillmentReady ? 'Payment and inventory deduction confirmed. Shipping will be connected in stage 8.' : 'Payment confirmed. Inventory processing is pending; shipping is blocked.'}</p>}
      {order.status === 4 && <p>{order.inventoryStatus === 2 ? 'Order closed and inventory released.' : 'Order closed; inventory release is pending.'}</p>}
      {[8, 9].includes(order.status) && <p className="error-msg">{order.failureReason} {order.status === 9 && 'Do not pay again. An administrator must review it; no automatic refund or shipping is performed.'}</p>}
    </section>}
    <div className="admin-toolbar"><button className="btn btn-outline" disabled={busy} onClick={() => setRetry((value) => value + 1)}>Refresh payment status</button><Link to="/member/orders">My orders</Link><Link to="/cart">Cart</Link></div>
  </div>
}
