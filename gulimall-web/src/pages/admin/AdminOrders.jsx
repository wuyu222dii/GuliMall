import { useEffect, useState } from 'react'
import { listOrders } from '../../api/admin'

export default function AdminOrders() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setError('')
    listOrders({ page, limit: 20 }).then((res) => { if (active) setResult(res.page) }).catch((e) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [page])
  return <section><h2>订单查询</h2><p className="admin-note">当前提供只读列表。支付、发货和物流操作将在后续阶段接入。</p>
    {error && <p className="error-msg" role="alert">{error}</p>}
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>订单号</th><th>会员编号</th><th>金额</th><th>状态</th><th>收件人</th></tr></thead><tbody>
      {(result?.list || []).map((order) => <tr key={order.id}><td>{order.orderSn}</td><td>{order.memberId}</td><td>{order.payAmount}</td><td>{['待付款', '已支付', '已发货', '已完成', '已关闭'][order.status] || order.status}</td><td>{order.receiverName}</td></tr>)}
      {!result?.list?.length && <tr><td colSpan={5}>{result ? '暂无订单。' : '正在加载…'}</td></tr>}
    </tbody></table></div><div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} 页</span><button disabled={page >= (result?.totalPage || 1)} onClick={() => setPage(page + 1)}>下一页</button></div>
  </section>
}
