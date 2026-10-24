import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkCartItems } from '../api/product'
import { IMAGE_FALLBACK, productImage } from '../utils/product'
import { useCartStore } from '../store/cartStore'

export default function Cart() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { items, updateCount, removeItem, totalCount, totalPrice, clearCart } = useCartStore()
  const checkout = async () => {
    setBusy(true); setError('')
    try { await checkCartItems(items); navigate('/checkout') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  if (items.length === 0) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="empty-state card" style={{ padding: 60 }}>
          <p style={{ fontSize: 18, marginBottom: 16 }}>Your cart is empty</p>
          <Link to="/" className="btn btn-primary">Start shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <h1 className="page-title">My cart</h1>

      <table className="cart-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Unit price</th>
            <th>Quantity</th>
            <th>Subtotal</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.skuId}>
              <td>
                <div className="cart-product">
                  <img
                    src={productImage(item.skuDefaultImg)}
                    alt={item.skuName}
                    onError={(e) => { if (e.currentTarget.getAttribute('src') !== IMAGE_FALLBACK) e.currentTarget.src = IMAGE_FALLBACK }}
                  />
                  <Link to={`/product/${item.skuId}`}>{item.skuName}</Link>
                </div>
              </td>
              <td className="price">¥{item.price}</td>
              <td>
                <div className="qty-control" style={{ justifyContent: 'center' }}>
                  <button onClick={() => updateCount(item.skuId, item.count - 1)}>-</button>
                  <span>{item.count}</span>
                  <button onClick={() => updateCount(item.skuId, item.count + 1)}>+</button>
                </div>
              </td>
              <td className="price">¥{(Number(item.price) * item.count).toFixed(2)}</td>
              <td>
                <button
                  className="btn btn-outline"
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => removeItem(item.skuId)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="error-msg" role="alert">{error} Your cart has been kept.</p>}
      <div className="cart-footer">
        <button className="btn btn-outline" onClick={clearCart}>Clear cart</button>
        <div className="cart-total">
          <strong>{totalCount()}</strong> items, total:
          <span className="price">
            <span className="price-symbol">¥</span>
            <span className="price-value">{totalPrice().toFixed(2)}</span>
          </span>
        </div>
        <button className="btn btn-primary btn-lg" disabled={busy} onClick={checkout}>{busy ? 'Checking products…' : 'Checkout'}</button>
      </div>
    </div>
  )
}
