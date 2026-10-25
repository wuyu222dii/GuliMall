import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrders, getOrder } from '../api/order'
import { useAuthStore } from '../store/authStore'

const statuses = { 0: 'Pending payment', 1: 'Pending shipment', 2: 'Shipped', 3: 'Completed', 4: 'Closed', 5: 'Invalid order', 6: 'Creating — inventory pending', 7: 'Closing — release pending' }
export default function MemberOrders() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPage, setTotalPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setOrders([]); setDetail(null)
    getOrders({ page, limit: 10 }).then((res) => { if (active) { setOrders(res.page.list); setTotalPage(res.page.totalPage || 1) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, retry, user.id])
  const show = async (id) => {
    setError('')
    try { const res = await getOrder(id); if (useAuthStore.getState().user?.id === user.id) setDetail(res) }
    catch (e) { setError(e.message) }
  }
  return <div className="container catalog-page">
    <div className="admin-toolbar"><h1 className="page-title">My orders</h1><button className="btn btn-outline" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Refresh orders</button></div>
    {error && <p className="error-msg" role="alert">{error}</p>}
    {loading ? <p role="status">Loading orders…</p> : orders.length ? orders.map((order) => <section className="card order-summary" key={order.id}>
      <p className="order-number">Order No.: {order.orderSn}</p><p>{statuses[order.status] || 'Unknown'} · ¥{Number(order.payAmount).toFixed(2)}</p><p>Recipient: {order.receiverName} · {order.createTime}</p>
      {order.failureReason && <p>{order.failureReason}</p>}
      <button className="btn btn-outline" onClick={() => show(order.id)}>View order {order.orderSn}</button>
      {detail?.order.id === order.id && <div><p>{detail.order.receiverPhone} · {detail.order.receiverProvince}{detail.order.receiverCity}{detail.order.receiverRegion} {detail.order.receiverDetailAddress}</p>{detail.items.map((item) => <p key={item.id}>{item.skuName} × {item.skuQuantity} — ¥{Number(item.realAmount).toFixed(2)}</p>)}<p className="admin-note">Freight ¥{Number(detail.order.freightAmount || 0).toFixed(2)}. Payment is not connected yet.</p></div>}
    </section>) : !error && <div className="empty-state card"><p>No orders yet</p><Link className="btn btn-primary" to="/search">Go shopping</Link></div>}
    {totalPage > 1 && <div className="pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {totalPage}</span><button disabled={page >= totalPage || loading} onClick={() => setPage(page + 1)}>Next</button></div>}
  </div>
}
