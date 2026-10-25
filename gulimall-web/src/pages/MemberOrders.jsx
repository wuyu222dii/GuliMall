import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrders, getOrder, cancelOrder, receiveOrder } from '../api/order'
import OrderDetails from '../components/OrderDetails'
import { useAuthStore } from '../store/authStore'
import { orderStatuses } from '../utils/payment'
import { orderTime } from '../utils/order'

export default function MemberOrders() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPage, setTotalPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState(null)
  const [notice, setNotice] = useState('')
  useEffect(() => { setNotice('') }, [user.id])
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setOrders([]); setDetail(null); setAction(null)
    getOrders({ page, limit: 10 }, user.id).then((res) => { if (active) { setOrders(res.page.list); setTotalPage(res.page.totalPage || 1) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, retry, user.id])
  const show = async (id) => {
    setBusy(true); setError(''); setDetail(null)
    try { const res = await getOrder(id, user.id); if (useAuthStore.getState().user?.id === user.id) setDetail(res) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const perform = async () => {
    if (busy || !action) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await (action.type === 'cancel' ? cancelOrder(user.id, action.id) : receiveOrder(user.id, action.id))
      if (useAuthStore.getState().user?.id === user.id) { setNotice(`Order status: ${orderStatuses[res.order.status]}. ${res.order.status === 8 ? 'Payment closure is not confirmed. Inventory stays reserved; refresh later.' : ''}`); setRetry((value) => value + 1) }
    } catch (e) { setError(`${e.message} Refresh the original order before retrying.`) }
    finally { setBusy(false); setAction(null) }
  }
  return <div className="container catalog-page">
    <div className="admin-toolbar"><h1 className="page-title">My orders</h1><button className="btn btn-outline" disabled={loading || busy} onClick={() => setRetry((value) => value + 1)}>Refresh orders</button></div>
    {error && <p className="error-msg" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading orders…</p> : orders.length ? orders.map((order) => <section className="card order-summary" key={order.id}>
      <h2>{orderStatuses[order.status] || 'Unknown'}</h2><p className="order-number">Order No.: {order.orderSn}</p><p>Total: ¥{Number(order.payAmount).toFixed(2)}</p><p>Recipient: {order.receiverName} · {orderTime(order.createTime)}</p>
      {order.failureReason && <p>{order.failureReason}</p>}
      <div className="admin-actions"><button className="btn btn-outline" disabled={busy} onClick={() => show(order.id)}>View order {order.orderSn}</button>
        {[0, 8].includes(order.status) && <button className="btn btn-outline" disabled={busy} onClick={() => setAction({ id: order.id, type: 'cancel' })}>{order.status === 8 ? 'Retry cancellation check' : 'Cancel unpaid order'}</button>}
        {order.status === 2 && <button className="btn btn-primary" disabled={busy} onClick={() => setAction({ id: order.id, type: 'receive' })}>Confirm receipt</button>}</div>
      {action?.id === order.id && <div className="admin-confirm"><p>{action.type === 'cancel' ? 'Cancel this unpaid order? Stock is released only after the payment closure is confirmed. If payment already succeeded, the paid order is kept.' : 'Confirm that you have received this package? This completes the order.'}</p><div className="admin-actions"><button className="btn btn-primary" disabled={busy} onClick={perform}>{busy ? 'Checking…' : action.type === 'cancel' ? 'Confirm cancellation' : 'Confirm package received'}</button><button className="btn btn-outline" disabled={busy} onClick={() => setAction(null)}>Go back</button></div></div>}
      {[0, 1, 4, 8, 9].includes(order.status) && <p><Link className="btn btn-outline" to={`/payment/${order.orderSn}`}>Payment / inventory status</Link></p>}
      {detail?.order.id === order.id && <OrderDetails detail={detail} />}
    </section>) : !error && <div className="empty-state card"><p>No orders yet</p><Link className="btn btn-primary" to="/search">Go shopping</Link></div>}
    {totalPage > 1 && <div className="pagination"><button disabled={page <= 1 || loading || busy} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {totalPage}</span><button disabled={page >= totalPage || loading || busy} onClick={() => setPage(page + 1)}>Next</button></div>}
  </div>
}
