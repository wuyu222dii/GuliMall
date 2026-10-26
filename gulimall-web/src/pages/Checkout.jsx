import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { confirmOrder, submitOrder, getSubmission, retireConfirmation } from '../api/order'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { orderStatuses, canStartNewConfirmation } from '../utils/payment'

export default function Checkout() {
  const user = useAuthStore((s) => s.user)
  const selected = useCartStore((s) => s.selected)
  const [confirmation, setConfirmation] = useState(null)
  const [addressId, setAddressId] = useState(null)
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const key = `gulimall-checkout:${user.id}`

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setConfirmation(null); setResult(null); setAttempt(null)
    ;(async () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
        let current
        if (saved) {
          setAttempt(saved)
          const res = await getSubmission(user.id, saved.token)
          if (!active) return
          if (res.result.order) { setResult(res.result); return }
          current = res.result.confirmation
        } else {
          await selected()
          current = (await confirmOrder(user.id)).confirmation
        }
        if (!active) return
        setConfirmation(current)
        setAddressId(saved?.addressId || current.addresses.find((a) => a.defaultStatus === 1)?.id || current.addresses[0]?.id || null)
      } catch (e) { if (active) setError(e.message) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [key, user.id, retry, selected])

  useEffect(() => {
    if (!attempt || ![6, 7].includes(result?.order?.status)) return
    let active = true
    const timer = setInterval(() => {
      getSubmission(user.id, attempt.token).then((res) => { if (active) { setResult(res.result); setError(''); useCartStore.getState().refresh() } }).catch((e) => { if (active) setError(e.message) })
    }, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [attempt, result?.order?.status, user.id])

  const submit = async () => {
    if (busy || !addressId || !confirmation) return
    setBusy(true); setError('')
    const request = attempt || { token: confirmation.token, addressId }
    try {
      sessionStorage.setItem(key, JSON.stringify(request)); setAttempt(request)
      const res = await submitOrder(user.id, request.token, request.addressId)
      if (useAuthStore.getState().user?.id !== user.id) return
      setResult(res.result); await useCartStore.getState().refresh()
    } catch (e) { setError(`${e.message} Check the saved request or retry the same submission; do not create a second order.`) }
    finally { setBusy(false) }
  }
  const startNew = () => { sessionStorage.removeItem(key); setRetry((value) => value + 1) }
  const replace = async () => {
    setBusy(true); setError('')
    try {
      const res = await retireConfirmation(user.id, attempt.token)
      if (useAuthStore.getState().user?.id !== user.id) return
      if (res.result.order) setResult(res.result)
      else startNew()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="container catalog-page">
    <h1 className="page-title">Confirm order</h1>
    {error && <p className="error-msg" role="alert">{error}</p>}
    {loading ? <p role="status">Checking your saved request, current prices and addresses…</p> : result?.order ? <section className="card order-summary">
      <h2>{orderStatuses[result.order.status] || 'Order saved'}</h2>
      <p className="order-number">Order No.: {result.order.orderSn}</p>
      <p>Total due: <strong className="price">¥{Number(result.order.payAmount).toFixed(2)}</strong></p>
      <p>{result.order.receiverName} · {result.order.receiverProvince}{result.order.receiverCity}{result.order.receiverRegion} {result.order.receiverDetailAddress}</p>
      {result.items.map((item) => <p key={item.skuId}>{item.skuName} × {item.skuQuantity} — ¥{Number(item.realAmount).toFixed(2)}</p>)}
      {result.order.status === 0 && <p className="purchase-notice">Stock is locked. Use the payment page to pay or check the result before the fixed payment deadline.</p>}
      {[6, 7].includes(result.order.status) && <p role="status">The server is confirming the inventory result and will recover after a restart. This request will keep the same order number.</p>}
      {result.order.status === 4 && <p>{result.order.failureReason}</p>}
      {[0, 1, 4, 8, 9].includes(result.order.status) && <p><Link className="btn btn-primary" to={`/payment/${result.order.orderSn}`}>Payment / inventory status</Link></p>}
      <div className="admin-toolbar"><Link className="btn btn-primary" to="/member/orders">My orders</Link><Link className="btn btn-outline" to="/cart">View cart</Link>{canStartNewConfirmation(result.order.status) && <button className="btn btn-outline" onClick={startNew}>Start a new confirmation</button>}</div>
    </section> : confirmation && <>
      <section className="card order-summary"><h2>Shipping address</h2>
        {confirmation.addresses.length ? <fieldset disabled={busy || !!attempt}><legend className="admin-note">Choose an address belonging to your account</legend>{confirmation.addresses.map((address) => <label className="order-address" key={address.id}><input type="radio" name="order-address" checked={addressId === address.id} onChange={() => setAddressId(address.id)} /><span>{address.name} · {address.phone}<br />{address.province}{address.city}{address.region} {address.detailAddress}</span></label>)}</fieldset> : <Link to="/member/address">Add a shipping address, then refresh this confirmation.</Link>}
      </section>
      <section className="card order-summary"><h2>Order items</h2>{confirmation.items.map((item) => <p key={item.skuId}>{item.skuName} × {item.count} — ¥{(Number(item.price) * item.count).toFixed(2)}</p>)}<p className="admin-note">Freight ¥0.00. Confirmation valid until {new Date(confirmation.expiresAt).toLocaleString()}. Prices are checked again before submission.</p></section>
      <div className="cart-footer"><span>Total due: <strong className="price">¥{Number(confirmation.totalAmount).toFixed(2)}</strong></span><button className="btn btn-primary btn-lg" disabled={busy || !addressId} onClick={submit}>{busy ? 'Submitting…' : attempt ? 'Retry same submission' : 'Place order'}</button></div>
    </>}
    <div className="admin-toolbar"><button className="btn btn-outline" disabled={busy || loading} onClick={() => setRetry((value) => value + 1)}>{attempt ? 'Check saved request' : 'Refresh confirmation'}</button><Link to="/cart">Return to cart</Link></div>
    {attempt && !result && <button className="btn btn-outline" disabled={busy || loading} onClick={replace}>Replace confirmation safely</button>}
  </div>
}
