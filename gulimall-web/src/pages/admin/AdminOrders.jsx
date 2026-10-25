import { useEffect, useState } from 'react'
import { listOrders } from '../../api/admin'
import { retryPaymentEvents } from '../../api/order'

export default function AdminOrders() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    setError('')
    listOrders({ page, limit: 20 }).then((res) => { if (active) { setResult(res.page); setMode(res.mode) } }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [page, refresh])
  const retry = async (sn) => {
    setBusy(true); setError('')
    try { await retryPaymentEvents(sn); setRefresh((value) => value + 1) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <section><h2>订单查询</h2><p className="admin-note">付款与库存结果均确认后才满足履约门禁；发货和物流在阶段 8 接入。异常付款需要人工核对，本轮不自动退款。</p>
    {mode === 'LOCAL_TEST' && <p className="error-msg" role="status">当前是本地支付验证模式，不是支付宝沙箱。</p>}
    <button className="btn btn-outline" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>刷新订单</button>
    {error && <p className="error-msg" role="alert">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>订单号</th><th>会员编号</th><th>金额</th><th>状态 / 处理提示</th><th>库存与履约门禁</th><th>收件人</th><th>恢复</th></tr></thead><tbody>
      {(result?.list || []).map((order) => <tr key={order.id}><td>{order.orderSn}</td><td>{order.memberId}</td><td>{order.payAmount}</td><td>{['待付款', '已支付', '已发货', '已完成', '已关闭', '无效', '创建中', '关闭确认中', '支付关单确认中', '异常付款'][order.status] || order.status}<p className={order.status === 9 ? 'error-msg' : 'admin-note'}>{order.failureReason}</p></td><td>{order.fulfillmentReady ? '支付与扣减均已确认' : order.inventoryStatus === 2 ? '库存已释放，禁止发货' : '尚不可发货，等待支付或库存处理'}</td><td>{order.receiverName}</td><td>{(order.status === 8 || [1, 4].includes(order.status) && order.inventoryStatus === 0) && <button className="btn btn-outline" disabled={busy} onClick={() => retry(order.orderSn)}>重试确认与消息</button>}</td></tr>)}
      {!result?.list?.length && <tr><td colSpan={7}>{result ? '暂无订单。' : '正在加载…'}</td></tr>}
    </tbody></table></div><div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} 页</span><button disabled={page >= (result?.totalPage || 1)} onClick={() => setPage(page + 1)}>下一页</button></div>
  </section>
}
