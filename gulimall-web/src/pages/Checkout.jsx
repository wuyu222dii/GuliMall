import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAddressList } from '../api/member'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'

export default function Checkout() {
  const navigate = useNavigate()
  const { items, totalPrice, clearCart } = useCartStore()
  const user = useAuthStore((s) => s.user)

  const [addresses, setAddresses] = useState([])
  const [selectedAddr, setSelectedAddr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart')
      return
    }
    async function load() {
      try {
        const res = await getAddressList({ page: 1, limit: 20 })
        if (res.code === 0) {
          const list = res.page?.list || []
          setAddresses(list)
          const defaultAddr = list.find((a) => a.defaultStatus === 1) || list[0]
          setSelectedAddr(defaultAddr?.id || null)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [items.length, navigate])

  const handleSubmit = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    setSubmitting(true)
    // 后端 submitOrder 为占位实现，前端模拟下单成功
    setTimeout(() => {
      alert('订单提交功能需后端完善 submitOrder 接口。当前为演示模式。')
      clearCart()
      setSubmitting(false)
      navigate('/member/orders')
    }, 800)
  }

  if (items.length === 0) return null

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <h1 className="page-title">确认订单</h1>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>收货地址</h3>
        {loading ? (
          <div className="loading">加载地址...</div>
        ) : addresses.length > 0 ? (
          <div className="address-list">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`address-item ${selectedAddr === addr.id ? 'selected' : ''}`}
                onClick={() => setSelectedAddr(addr.id)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <strong>{addr.name}</strong> {addr.phone}
                  <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
                    {addr.province}{addr.city}{addr.region} {addr.detailAddress}
                  </div>
                </div>
                {addr.defaultStatus === 1 && (
                  <span style={{ color: '#e4393c', fontSize: 12 }}>默认</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p style={{ color: '#999', marginBottom: 12 }}>暂无收货地址</p>
            <Link to="/member/address" className="btn btn-outline">添加地址</Link>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>商品清单</h3>
        {items.map((item) => (
          <div key={item.skuId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span>{item.skuName} × {item.count}</span>
            <span className="price">¥{(Number(item.price) * item.count).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="cart-footer">
        <div className="cart-total">
          应付总额：
          <span className="price">
            <span className="price-symbol">¥</span>
            <span className="price-value">{totalPrice().toFixed(2)}</span>
          </span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '提交中...' : '提交订单'}
        </button>
      </div>
    </div>
  )
}
