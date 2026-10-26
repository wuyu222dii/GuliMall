import { useEffect, useState } from 'react'
import { listOrders } from '../../api/admin'
import { getAdminOrder, shipOrder, retryPaymentEvents, getOrderProcessing } from '../../api/order'
import { orderTime } from '../../utils/order'
import OrderDetails from '../../components/OrderDetails'

const statuses = ['待付款', '已支付', '已发货', '已完成', '已关闭', '无效', '创建中', '关闭确认中', '支付关单确认中', '异常付款']

export default function AdminOrders() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [fields, setFields] = useState({ orderSn: '', status: '' })
  const [filter, setFilter] = useState(fields)
  const [detail, setDetail] = useState(null)
  const [processing, setProcessing] = useState(null)
  const [processingError, setProcessingError] = useState('')
  const [shipment, setShipment] = useState({ deliveryCompany: '', deliverySn: '' })
  useEffect(() => {
    let active = true
    setError(''); setLoading(true); setResult(null); setDetail(null)
    listOrders({ page, limit: 20, ...filter }).then((res) => { if (active) { setResult(res.page); setMode(res.mode) } }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, refresh, filter])
  const show = async (id) => {
    setBusy(true); setError(''); setDetail(null); setProcessing(null); setProcessingError(''); setShipment({ deliveryCompany: '', deliverySn: '' })
    try {
      setDetail(await getAdminOrder(id))
      try { setProcessing((await getOrderProcessing(id)).processing) } catch(e) { setProcessingError(e.message) }
    }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const retry = async (sn) => {
    setBusy(true); setError(''); setNotice('')
    try { await retryPaymentEvents(sn); setNotice('已重新检查支付和消息，请刷新查看处理结果。'); setRefresh((value) => value + 1) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const ship = async (event) => {
    event.preventDefault()
    if (busy || !detail) return
    setBusy(true); setError(''); setNotice('')
    try { const res = await shipOrder(detail.order.id, shipment); setNotice(`发货已确认：${res.order.deliveryCompany} / ${res.order.deliverySn}`); setRefresh((value) => value + 1) }
    catch (e) { setError(`${e.message} 请刷新原订单后核对，重复提交相同物流信息不会重复发货。`) }
    finally { setBusy(false) }
  }
  return <section><h2>订单查询</h2><p className="admin-note">仅已支付且库存扣减已确认的正常订单可以发货。物流信息提交后不能覆盖；异常付款需人工核对，本轮不自动退款。</p>
    {mode === 'LOCAL_TEST' && <p className="error-msg" role="status">当前是本地支付验证模式，不是支付宝沙箱。</p>}
    <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setPage(1); setFilter({ ...fields }); setNotice('') }}>
      <label>完整订单号<input className="input" value={fields.orderSn} maxLength={32} onChange={(e) => setFields({ ...fields, orderSn: e.target.value })} /></label>
      <label>订单状态<select className="input" value={fields.status} onChange={(e) => setFields({ ...fields, status: e.target.value })}><option value="">全部状态</option>{statuses.map((name, value) => <option key={value} value={value}>{name}</option>)}</select></label>
      <button className="btn btn-primary" disabled={busy || loading}>查询订单</button><button type="button" className="btn btn-outline" disabled={busy || loading} onClick={() => setRefresh((value) => value + 1)}>刷新订单</button>
    </form>
    {error && <p className="error-msg" role="alert">{error}</p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>订单号</th><th>会员编号</th><th>金额</th><th>状态 / 处理提示</th><th>库存与履约门禁</th><th>收件人</th><th>操作</th></tr></thead><tbody>
      {(result?.list || []).map((order) => <tr key={order.id}><td className="order-number">{order.orderSn}</td><td>{order.memberId}</td><td>{order.payAmount}</td><td>{statuses[order.status] || order.status}<p className={order.status === 9 ? 'error-msg' : 'admin-note'}>{order.failureReason}</p></td><td>{order.status === 3 ? '已完成' : order.status === 2 ? '已发货' : order.fulfillmentReady ? '支付与扣减均已确认，可发货' : order.inventoryStatus === 2 ? '库存已释放，禁止发货' : '尚不可发货，等待支付或库存处理'}</td><td>{order.receiverName}</td><td><button className="btn btn-outline" disabled={busy || loading} onClick={() => show(order.id)}>详情 / 物流</button>{(order.status === 8 || [1, 4].includes(order.status) && order.inventoryStatus === 0) && <button className="btn btn-outline" disabled={busy || loading} onClick={() => retry(order.orderSn)}>重试确认与消息</button>}</td></tr>)}
      {!result?.list?.length && <tr><td colSpan={7}>{loading ? '正在加载…' : error ? '查询失败，请重试。' : '暂无匹配订单。'}</td></tr>}
    </tbody></table></div><div className="pagination"><button disabled={page <= 1 || busy || loading} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {result?.totalPage || 1} 页</span><button disabled={page >= (result?.totalPage || 1) || busy || loading} onClick={() => setPage(page + 1)}>下一页</button></div>
    {detail && <section className="card order-summary"><h2>订单详情：{statuses[detail.order.status]}</h2><p className="order-number">{detail.order.orderSn}</p><OrderDetails detail={detail} />
      <h3>处理进度</h3>{processingError ? <p className="error-msg" role="alert">处理进度查询失败：{processingError} 请重新打开详情。</p> : processing && <><p>订单：{statuses[processing.orderStatus]}；库存：{({0:'等待确认',1:'扣减已确认',2:'释放已确认'})[processing.inventoryStatus] || '未知'}；{processing.fulfillmentReady?'可发货':'禁止发货或已完成履约'}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>事件</th><th>发布尝试</th><th>发布确认</th><th>消费确认</th><th>下次重试 / 到期检查</th><th>提示</th></tr></thead><tbody>{processing.events.map(event=><tr key={event.type}><td>{({STOCK_DEDUCT:'库存扣减',STOCK_RELEASE:'库存释放',CLOSE_TIMER:'到期检查'})[event.type] || event.type}</td><td>{event.attempts}</td><td>{orderTime(event.sentAt)}</td><td>{orderTime(event.consumedAt)}</td><td>{event.scheduledFor ? `到期检查：${orderTime(event.scheduledFor)}` : orderTime(event.nextAttempt)}</td><td>{event.errorMessage || '—'}</td></tr>)}</tbody></table></div>{!processing.events.length&&<p>暂无持久化事件，请结合订单和库存状态核对。</p>}</>}
      {detail.order.fulfillmentReady && <form className="admin-form" onSubmit={ship}><fieldset disabled={busy}><legend>填写物流并发货</legend><div className="admin-form-grid"><label>物流公司<input className="input" required maxLength={64} value={shipment.deliveryCompany} onChange={(e) => setShipment({ ...shipment, deliveryCompany: e.target.value })} /></label><label>运单号<input className="input" required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9-]{0,63}" value={shipment.deliverySn} onChange={(e) => setShipment({ ...shipment, deliverySn: e.target.value })} /></label></div><p className="admin-note">运单号使用字母、数字或连字符。请核对包裹与收件人，确认后物流信息不可更改。</p><button className="btn btn-primary">{busy ? '正在提交…' : '确认发货'}</button></fieldset></form>}
    </section>}
  </section>
}
