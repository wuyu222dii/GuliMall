import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { listOrders } from '../../api/admin'
import { getAdminOrder, shipOrder, retryPaymentEvents, getOrderProcessing } from '../../api/order'
import { orderTime } from '../../utils/order'
import OrderDetails from '../../components/OrderDetails'
import { orderStatuses } from '../../utils/payment'
import { adminQuery, adminListUrl } from '../../utils/admin'

export default function AdminOrders() {
  const { id } = useParams(), [params, setParams] = useSearchParams(), query = params.toString()
  const parsed = useMemo(() => { try { return { values: adminQuery('orders', query), error: '' } } catch (e) { return { values: { page: '1' }, error: e.message } } }, [query])
  const filter = parsed.values, page = Number(filter.page), invalid = id && !/^[1-9][0-9]{0,18}$/.test(id) ? '订单编号不正确。' : parsed.error
  const [fields, setFields] = useState({ orderSn: '', status: '' })
  const [result, setResult] = useState(null), [error, setError] = useState(''), [mode, setMode] = useState('')
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null), [processing, setProcessing] = useState(null), [processingError, setProcessingError] = useState('')
  const [shipment, setShipment] = useState({ deliveryCompany: '', deliverySn: '' }), working = useRef(false), view = useRef('')
  view.current = (id || 'list') + '?' + query
  useEffect(() => { const p = new URLSearchParams(query); setFields({ orderSn: p.get('orderSn') || '', status: p.get('status') || '' }) }, [query])
  useEffect(() => { setShipment({ deliveryCompany: '', deliverySn: '' }); setNotice('') }, [id])
  useEffect(() => {
    let active = true
    setError(''); setLoading(true); setResult(null); setDetail(null); setProcessing(null); setProcessingError('')
    if (invalid) { setError(invalid); setLoading(false); return }
    ;(async () => {
      try {
        const res = id ? await getAdminOrder(id) : await listOrders({ ...filter, limit: 20 })
        if (!active) return
        setMode(res.mode || '')
        if (id) {
          setDetail(res)
          try { const progress = await getOrderProcessing(id); if (active) setProcessing(progress.processing) } catch (e) { if (active) setProcessingError(e.message) }
        } else {
          const last = Math.max(1, res.page.totalPage)
          if (page > last) { const p = new URLSearchParams(query); p.set('page', String(last)); setParams(p, { replace: true }) }
          else setResult(res.page)
        }
      } catch (e) { if (active) setError(e.message) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [id, filter, invalid, page, query, refresh, setParams])
  const retry = async sn => {
    if (working.current || loading) return
    const current = view.current
    working.current = true; setBusy(true); setError(''); setNotice('')
    try { await retryPaymentEvents(sn); if (view.current === current) { setNotice('已重新检查支付和消息，请刷新查看处理结果。'); setRefresh(v => v + 1) } }
    catch (e) { if (view.current === current) setError(e.message) }
    finally { working.current = false; setBusy(false) }
  }
  const ship = async event => {
    event.preventDefault()
    if (working.current || loading || !detail?.order.fulfillmentReady || String(detail.order.id) !== id) return
    const current = view.current, orderId = detail.order.id
    working.current = true; setBusy(true); setError(''); setNotice('')
    try { const res = await shipOrder(orderId, { ...shipment }); if (view.current === current) { setNotice('发货已确认：' + res.order.deliveryCompany + ' / ' + res.order.deliverySn); setRefresh(v => v + 1) } }
    catch (e) { if (view.current === current) setError(e.message + ' 请刷新原订单后核对，重复提交相同物流信息不会重复发货。') }
    finally { working.current = false; setBusy(false) }
  }
  const goPage = next => { const p = new URLSearchParams(query); p.set('page', String(next)); setParams(p) }
  const listUrl = adminListUrl('orders', query), suffix = listUrl.slice('/admin/orders'.length)
  const readyDetail = !loading && detail && String(detail.order.id) === id
  return <section>
    {!id ? <h2>订单查询</h2> : <div className="admin-toolbar"><h2>订单管理</h2><Link className="btn btn-outline" to={listUrl}>返回订单查询</Link></div>}
    <p className="admin-note">仅已支付且库存扣减已确认的正常订单可以发货。物流信息提交后不能覆盖；异常付款需人工核对，本轮不自动退款。</p>
    {mode === 'LOCAL_TEST' && <p className="error-msg" role="status">当前是本地支付验证模式，不是支付宝沙箱。</p>}
    {!id && <form className="admin-search" onSubmit={event => { event.preventDefault(); const next = { page: '1' }; if (fields.orderSn.trim()) next.orderSn = fields.orderSn.trim(); if (fields.status) next.status = fields.status; setParams(next); setRefresh(v => v + 1); setNotice('') }}>
      <label>完整订单号<input className="input" value={fields.orderSn} maxLength={32} pattern="[a-f0-9]{32}" onChange={e => setFields({ ...fields, orderSn: e.target.value })} /></label>
      <label>订单状态<select aria-label="订单状态" className="input" value={fields.status} onChange={e => setFields({ ...fields, status: e.target.value })}><option value="">全部状态</option>{Object.entries(orderStatuses).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
      <button className="btn btn-primary" disabled={busy || loading}>查询订单</button><button type="button" className="btn btn-outline" disabled={busy || loading} onClick={() => { setParams({}); setRefresh(v => v + 1); setNotice('') }}>清除订单条件</button>
    </form>}
    <button className="btn btn-outline" disabled={busy || loading} onClick={() => setRefresh(v => v + 1)}>刷新订单</button>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {!id && <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>订单号</th><th>会员编号</th><th>金额</th><th>状态 / 处理提示</th><th>库存与履约门禁</th><th>收件人</th><th>操作</th></tr></thead><tbody>{(result?.list || []).map(order => <tr key={order.id}><td className="order-number">{order.orderSn}</td><td>{order.memberId}</td><td>¥{Number(order.payAmount).toFixed(2)}</td><td>{orderStatuses[order.status] || '未知状态'}<p className={order.status === 9 ? 'error-msg' : 'admin-note'}>{order.failureReason}</p></td><td>{order.status === 3 ? '已完成' : order.status === 2 ? '已发货' : order.fulfillmentReady ? '支付与扣减均已确认，可发货' : order.inventoryStatus === 2 ? '库存已释放，禁止发货' : '尚不可发货，等待支付或库存处理'}</td><td>{order.receiverName}</td><td><Link className="btn btn-outline" to={'/admin/orders/' + order.id + suffix}>详情 / 物流</Link>{(order.status === 8 || [1, 4].includes(order.status) && order.inventoryStatus === 0) && <button className="btn btn-outline" disabled={busy || loading} onClick={() => retry(order.orderSn)}>重试确认与消息</button>}</td></tr>)}{!result?.list?.length && <tr><td colSpan={7}>{loading ? '正在加载…' : error ? '查询失败，请重试。' : '暂无匹配订单。'}</td></tr>}</tbody></table></div><div className="pagination"><button disabled={page <= 1 || busy || loading || !!error} onClick={() => goPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(1, result?.totalPage || 1)} 页</span><button disabled={page >= (result?.totalPage || 1) || busy || loading || !!error} onClick={() => goPage(page + 1)}>下一页</button></div></>}
    {id && loading && <p role="status">正在读取此订单及处理进度…</p>}
    {readyDetail && <section className="card order-summary"><h2>订单详情：{orderStatuses[detail.order.status]}</h2><p className="order-number">{detail.order.orderSn}</p><OrderDetails detail={detail} />
      <h3>处理进度</h3>{processingError ? <p className="error-msg" role="alert">处理进度查询失败：{processingError} 请刷新原订单核对。</p> : processing && <><p>订单：{orderStatuses[processing.orderStatus]}；库存：{({ 0: '等待确认', 1: '扣减已确认', 2: '释放已确认' })[processing.inventoryStatus] || '未知'}；{processing.fulfillmentReady ? '可发货' : '禁止发货或已完成履约'}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>事件</th><th>发布尝试</th><th>发布确认</th><th>消费确认</th><th>下次重试 / 到期检查</th><th>提示</th></tr></thead><tbody>{processing.events.map(event => <tr key={event.type}><td>{({ STOCK_DEDUCT: '库存扣减', STOCK_RELEASE: '库存释放', CLOSE_TIMER: '到期检查' })[event.type] || event.type}</td><td>{event.attempts}</td><td>{orderTime(event.sentAt)}</td><td>{orderTime(event.consumedAt)}</td><td>{event.scheduledFor ? '到期检查：' + orderTime(event.scheduledFor) : orderTime(event.nextAttempt)}</td><td>{event.errorMessage || '—'}</td></tr>)}</tbody></table></div>{!processing.events.length && <p>暂无持久化事件，请结合订单和库存状态核对。</p>}</>}
      {(detail.order.status === 8 || [1, 4].includes(detail.order.status) && detail.order.inventoryStatus === 0) && <button className="btn btn-outline" disabled={busy || loading} onClick={() => retry(detail.order.orderSn)}>重试确认与消息</button>}
      {detail.order.fulfillmentReady && <form className="admin-form" onSubmit={ship}><fieldset disabled={busy || loading}><legend>填写物流并发货</legend><div className="admin-form-grid"><label>物流公司<input className="input" required maxLength={64} value={shipment.deliveryCompany} onChange={e => setShipment({ ...shipment, deliveryCompany: e.target.value })} /></label><label>运单号<input className="input" required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9-]{0,63}" value={shipment.deliverySn} onChange={e => setShipment({ ...shipment, deliverySn: e.target.value })} /></label></div><p className="admin-note">运单号使用字母、数字或连字符。请核对包裹与收件人，确认后物流信息不可更改。</p><button className="btn btn-primary">{busy ? '正在提交…' : '确认发货'}</button></fieldset></form>}
    </section>}
  </section>
}