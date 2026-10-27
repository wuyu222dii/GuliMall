import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getOrders, getOrder, cancelOrder, receiveOrder } from '../api/order'
import OrderDetails from '../components/OrderDetails'
import { useAuthStore } from '../store/authStore'
import { orderStatuses } from '../utils/payment'
import { orderTime } from '../utils/order'

export default function MemberOrders() {
  const user = useAuthStore((s) => s.user)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const { id } = useParams()
  const [params, setParams] = useSearchParams(), query = params.toString()
  const page = Number(params.get('page') || 1)
  const [fields, setFields] = useState({ orderSn: '', status: '' })
  useEffect(() => { const p = new URLSearchParams(query); setFields({ orderSn: p.get('orderSn') || '', status: p.get('status') || '' }) }, [query])
  const setPage = next => { const p = new URLSearchParams(query); p.set('page', String(next)); setParams(p) }
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
    const p = new URLSearchParams(query)
    const operation = id ? getOrder(id, user.id) : getOrders({ page: p.get('page') || '1', limit: 10, status: p.get('status') || '', orderSn: p.get('orderSn') || '' }, user.id)
    operation.then((res) => { if (active) { setOrders(id ? [res.order] : res.page.list); setTotalPage(id ? 1 : res.page.totalPage || 1); if (id) setDetail(res) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, query, retry, user.id])
  const perform = async () => {
    if (busy || !action) return
    setBusy(true); setError(''); setNotice('')
    try {
      const res = await (action.type === 'cancel' ? cancelOrder(user.id, action.id) : receiveOrder(user.id, action.id))
      if (useAuthStore.getState().user?.id === user.id) { setNotice(`订单状态： ${orderStatuses[res.order.status]}. ${res.order.status === 8 ? '付款关闭结果尚未确认，库存仍被锁定，请稍后刷新。' : ''}`); setRetry((value) => value + 1) }
    } catch (e) { setError(`${e.message} 请先刷新原订单再重试。`) }
    finally { setBusy(false); setAction(null) }
  }
  return <div className="container catalog-page">
    <div className="admin-toolbar"><h1 className="page-title">{id ? '订单详情' : '我的订单'}</h1>{id && <Link className="btn btn-outline" to={'/member/orders' + (query ? '?' + query : '')}>返回订单列表</Link>}<button className="btn btn-outline" disabled={loading || busy} onClick={() => setRetry((value) => value + 1)}>刷新订单</button></div>
    {!id && <form className="admin-search" onSubmit={event => { event.preventDefault(); const next = {}; if (fields.orderSn.trim()) next.orderSn = fields.orderSn.trim(); if (fields.status) next.status = fields.status; next.page = '1'; setParams(next) }}>
      <label>查询订单号<input className="input" maxLength={32} pattern="[a-f0-9]{32}" value={fields.orderSn} onChange={e => setFields({ ...fields, orderSn: e.target.value })} /></label>
      <label>筛选订单状态<select aria-label="筛选订单状态" className="input" value={fields.status} onChange={e => setFields({ ...fields, status: e.target.value })}><option value="">全部状态</option>{Object.entries(orderStatuses).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="btn btn-primary" disabled={loading || busy}>查询我的订单</button><button type="button" className="btn btn-outline" disabled={loading || busy} onClick={() => setParams({})}>清除订单筛选</button>
    </form>}
    {error && <p className="error-msg" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">正在加载订单…</p> : orders.length ? orders.map((order) => <section className="card order-summary" key={order.id}>
      <h2>{orderStatuses[order.status] || '未知状态'}</h2><p className="order-number">订单号： {order.orderSn}</p><p>合计：¥{Number(order.payAmount).toFixed(2)}</p><p>收件人： {order.receiverName} · {orderTime(order.createTime)}</p>
      {order.failureReason && <p>{order.failureReason}</p>}
      <div className="admin-actions">{!id && <Link className="btn btn-outline" to={'/member/orders/' + order.id + (query ? '?' + query : '')}>查看订单 {order.orderSn}</Link>}
        {[0, 8].includes(order.status) && <button className="btn btn-outline" disabled={busy} onClick={() => setAction({ id: order.id, type: 'cancel' })}>{order.status === 8 ? '重试取消确认' : '取消待付款订单'}</button>}
        {order.status === 2 && <button className="btn btn-primary" disabled={busy} onClick={() => setAction({ id: order.id, type: 'receive' })}>确认收货</button>}</div>
      {action?.id === order.id && <div className="admin-confirm"><p>{action.type === 'cancel' ? '确认取消此待付款订单？只有确认未付款关闭后才会释放库存；已付款订单会保留。' : '确认已收到包裹？确认后订单将完成。'}</p><div className="admin-actions"><button className="btn btn-primary" disabled={busy} onClick={perform}>{busy ? '正在校验…' : action.type === 'cancel' ? '确认取消' : '确认已收到包裹'}</button><button className="btn btn-outline" disabled={busy} onClick={() => setAction(null)}>返回</button></div></div>}
      {[0, 1, 4, 8, 9].includes(order.status) && <p><Link className="btn btn-outline" to={`/payment/${order.orderSn}`}>付款 / 库存状态</Link></p>}
      {detail?.order.id === order.id && <OrderDetails detail={detail} />}
    </section>) : !error && <div className="empty-state card"><p>暂无订单</p><Link className="btn btn-primary" to="/search">去选购</Link></div>}
    {totalPage > 1 && <div className="pagination"><button disabled={page <= 1 || loading || busy} onClick={() => setPage(page - 1)}>上一页</button><span>{page} / {totalPage}</span><button disabled={page >= totalPage || loading || busy} onClick={() => setPage(page + 1)}>下一页</button></div>}
  </div>
}
