import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getAlipayForm, getPaymentStatus } from '../api/order'
import { useAuthStore } from '../store/authStore'
import { orderStatuses, submitPaymentForm, paymentSettled } from '../utils/payment'
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
    let timer
    const load = async () => {
      if (!/^[a-f0-9]{32}$/.test(sn || '')) { setError('订单号无效。'); return }
      let settled = false
      try { const res = await getPaymentStatus(user.id, sn); if (active) { setResult(res.payment); setError(''); settled = paymentSettled(res.payment.order) } }
      catch (e) { if (active) setError(e.message) }
      if (active && !settled) timer = setTimeout(load, 5000)
    }
    load()
    return () => { active = false; clearTimeout(timer) }
  }, [user.id, sn, retry])
  const pay = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await getAlipayForm(user.id, sn)
      if (useAuthStore.getState().user?.id === user.id) submitPaymentForm(res.payment.html, res.payment.mode)
    } catch (e) { setError(`${e.message} 原订单已保留，请先刷新状态再重试。`) }
    finally { setBusy(false) }
  }
  const order = result?.order
  return <div className="container catalog-page"><h1 className="page-title">付款状态</h1>
    {result?.mode === 'LOCAL_TEST' && <p className="error-msg" role="status">当前为本地模拟付款，无真实资金，不是支付宝沙箱。</p>}
    {error && <p className="error-msg" role="alert">{error}</p>}
    {!result && !error && <p role="status">正在查询订单状态…</p>}
    {order && <section className="card order-summary"><h2>{orderStatuses[order.status] || '未知状态'}</h2><p className="order-number">订单号： {order.orderSn}</p><p>合计： <strong className="price">¥{Number(order.payAmount).toFixed(2)}</strong></p>
      <p>本页只读取服务端结果，付款页面返回不会直接将订单标记为已支付。</p>
      {order.status === 0 && <><p>付款截止时间： {new Date(order.paymentDeadline).toLocaleString('zh-CN')}. 关闭时需先确认付款结果，结果未知期间保留库存锁定。</p>{!result.configured && <p className="error-msg">付款服务未配置，请联系管理员。</p>}<button className="btn btn-primary" disabled={busy || !result.configured} onClick={pay}>{busy ? '正在打开付款页…' : result.mode === 'LOCAL_TEST' ? '打开模拟付款' : '支付宝沙箱付款'}</button></>}
      {order.status === 1 && <p role="status">{order.fulfillmentReady ? '付款和库存扣减均已确认，等待发货。' : '付款已确认，库存处理中，暂不能发货。'}</p>}
      {[2, 3].includes(order.status) && <p>{order.deliveryCompany} · {order.deliverySn}. {order.status === 3 ? '已确认收货。' : '请在我的订单查看物流，收到包裹后确认收货。'}</p>}
      {order.status === 4 && <p>{order.inventoryStatus === 2 ? '订单已关闭，库存已释放。' : '订单已关闭，正在等待库存释放。'}</p>}
      {[8, 9].includes(order.status) && <p className="error-msg">{order.failureReason} {order.status === 9 && '请勿再次付款，需管理员核对，不会自动退款或发货。'}</p>}
    </section>}
    <div className="admin-toolbar"><button className="btn btn-outline" disabled={busy} onClick={() => setRetry((value) => value + 1)}>刷新付款状态</button><Link to="/member/orders">我的订单</Link><Link to="/cart">购物车</Link></div>
  </div>
}
