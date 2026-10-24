import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAddressList } from '../api/member'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'

export default function Checkout() {
  const selected = useCartStore((s) => s.selected)
  const user = useAuthStore((s) => s.user)

  const [addresses, setAddresses] = useState([])
  const [selectedAddr, setSelectedAddr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmedItems, setConfirmedItems] = useState([])
  const [confirmedTotal, setConfirmedTotal] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError(''); setConfirmedItems([])
      try {
        const [res, cart] = await Promise.all([getAddressList({ page: 1, limit: 20 }), selected()])
        if (!active) return
        setConfirmedItems(cart.items); setConfirmedTotal(cart.totalAmount)
        if (res.code === 0) {
          const list = res.page?.list || []
          setAddresses(list)
          const defaultAddr = list.find((a) => a.defaultStatus === 1) || list[0]
          setSelectedAddr(defaultAddr?.id || null)
        }
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [selected, retry, user?.id])


  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <h1 className="page-title">Confirm order</h1>
      {error && <div className="error-msg" role="alert"><p>{error} Your cart has been kept.</p><button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>Retry product check</button><Link to="/cart">Return to cart</Link></div>}

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>Shipping address</h3>
        {loading ? (
          <div className="loading">Loading addresses...</div>
        ) : error ? <p>Address selection is unavailable until the product check succeeds.</p> : addresses.length > 0 ? (
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
                  <span style={{ color: '#e4393c', fontSize: 12 }}>Default</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p style={{ color: '#999', marginBottom: 12 }}>No shipping addresses yet</p>
            <Link to="/member/address" className="btn btn-outline">Add address</Link>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12, fontSize: 16 }}>Order items</h3>
        {loading ? <p role="status">Checking current prices and availability…</p> : confirmedItems.map((item) => (
          <div key={item.skuId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
            <span>{item.skuName} × {item.count}</span>
            <span className="price">¥{(Number(item.price) * item.count).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="cart-footer">
        <div className="cart-total">
          Total due:
          <span className="price">
            <span className="price-symbol">¥</span>
            <span className="price-value">{loading || error ? 'Unavailable' : Number(confirmedTotal).toFixed(2)}</span>
          </span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          disabled
        >
          Place order
        </button>
      </div>
      <p className="purchase-notice">Order submission is not available yet. No order will be created and your cart will be kept.</p>
    </div>
  )
}
