import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOrders } from '../api/order'

const STATUS_MAP = {
  0: 'Pending payment',
  1: 'Pending shipment',
  2: 'Shipped',
  3: 'Completed',
  4: 'Closed',
  5: 'Invalid order',
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
      <h1 className="page-title">My Orders</h1>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : orders.length > 0 ? (
        <>
          {orders.map((order) => (
            <div key={order.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, color: '#666' }}>
                <span>Order No.: {order.orderSn}</span>
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
                    {STATUS_MAP[order.status] ?? 'Unknown'}
                  </span>
                  <span style={{ marginLeft: 16 }}>
                    Recipient: {order.receiverName} {order.receiverPhone}
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
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ lineHeight: '32px' }}>{page} / {totalPage}</span>
              <button disabled={page >= totalPage} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state card" style={{ padding: 60 }}>
          <p>No orders yet</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>Go shopping</Link>
        </div>
      )}
    </div>
  )
}
