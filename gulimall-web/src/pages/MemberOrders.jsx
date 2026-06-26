import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrders } from '../api/order'

const STATUS_MAP = {
  0: '待付款',
  1: '待发货',
  2: '已发货',
  3: '已完成',
  4: '已关闭',
  5: '无效订单',
}

export default function MemberOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPage, setTotalPage] = useState(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await getOrders({ page, limit: 10 })
        if (res.code === 0) {
          setOrders(res.page?.list || [])
          setTotalPage(res.page?.totalPage || 1)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page])

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <h1 className="page-title">我的订单</h1>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : orders.length > 0 ? (
        <>
          {orders.map((order) => (
            <div key={order.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: '#666' }}>
                <span>订单号：{order.orderSn}</span>
                <span>{order.createTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{
                    padding: '2px 8px',
                    background: '#fff0f0',
                    color: '#e4393c',
                    borderRadius: 4,
                    fontSize: 12,
                  }}>
                    {STATUS_MAP[order.status] ?? '未知'}
                  </span>
                  <span style={{ marginLeft: 16 }}>
                    收货人：{order.receiverName} {order.receiverPhone}
                  </span>
                </div>
                <div className="price">
                  ¥{order.payAmount}
                </div>
              </div>
            </div>
          ))}
          {totalPage > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
              <span style={{ lineHeight: '32px' }}>{page} / {totalPage}</span>
              <button disabled={page >= totalPage} onClick={() => setPage(page + 1)}>下一页</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state card" style={{ padding: 60 }}>
          <p>暂无订单</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>去购物</Link>
        </div>
      )}
    </div>
  )
}
