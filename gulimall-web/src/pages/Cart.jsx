import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IMAGE_FALLBACK, productImage } from '../utils/product'
import { useCartStore } from '../store/cartStore'

export default function Cart() {
  const navigate = useNavigate()
  const { owner, items, loading, busy, error, pendingCount, totalAmount, readyToCheckout, refresh, updateCount, setChecked, removeItem, clearCart, selected } = useCartStore()
  const [checking, setChecking] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  useEffect(() => { refresh() }, [owner, refresh])
  const act = (action) => { setCheckoutError(''); action().catch((e) => setCheckoutError(e.message)) }
  const checkout = async () => {
    if (owner === 'guest') { navigate('/login?redirect=%2Fcart'); return }
    setChecking(true); setCheckoutError('')
    try { await selected(); navigate('/checkout') }
    catch (e) { setCheckoutError(e.message) }
    finally { setChecking(false) }
  }
  const disabled = loading || busy || checking
  return <div className="container catalog-page">
    <div className="admin-toolbar"><h1 className="page-title">My cart</h1><button className="btn btn-outline" disabled={disabled} onClick={() => { setCheckoutError(''); refresh() }}>Refresh cart / retry merge</button></div>
    {owner === 'guest' && <p className="purchase-notice">Guest cart is kept on this browser. Sign in to merge it once with your member cart.</p>}
    {pendingCount > 0 && <p className="purchase-notice" role="status">{pendingCount} guest items are kept locally while merging is pending. Adjust quantities or remove server items if capacity is exceeded, then retry. They will not be merged into another account.</p>}
    {(error || checkoutError) && <p className="error-msg" role="alert">{error || checkoutError} Your cart has been kept.</p>}
    {loading && <p role="status">Refreshing prices, availability and cart…</p>}
    {!items.length && !loading && !error && !pendingCount && <div className="empty-state card"><p>Your cart is empty</p><Link className="btn btn-primary" to="/search">Start shopping</Link></div>}
    {!!items.length && <>
      <div className="admin-table-wrap"><table className="cart-table"><thead><tr><th>Select</th><th>Product / availability</th><th>Unit price</th><th>Quantity</th><th>Subtotal</th><th>Actions</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.skuId}>
          <td><input type="checkbox" aria-label={`Select SKU ${item.skuId}`} checked={item.checked !== false} disabled={disabled} onChange={(e) => act(() => setChecked(item.skuId, e.target.checked))} /></td>
          <td><div className="cart-product"><img src={productImage(item.skuDefaultImg)} alt="" onError={(e) => { if (e.currentTarget.getAttribute('src') !== IMAGE_FALLBACK) e.currentTarget.src = IMAGE_FALLBACK }} /><div><Link to={`/product/${item.skuId}`}>{item.skuName}</Link><p className={item.status === 'AVAILABLE' && !error ? 'admin-note' : 'error-msg'}>{error ? 'Refresh required' : item.message || 'Price check required'}</p></div></div></td>
          <td className="price">{loading || error || item.price == null ? 'Unavailable' : `¥${Number(item.price).toFixed(2)}`}</td>
          <td><div className="qty-control"><button aria-label={`Decrease SKU ${item.skuId}`} disabled={disabled || item.count <= 1} onClick={() => act(() => updateCount(item.skuId, item.count - 1))}>−</button><span aria-label={`Quantity SKU ${item.skuId}`}>{item.count}</span><button aria-label={`Increase SKU ${item.skuId}`} disabled={disabled || item.count >= 999} onClick={() => act(() => updateCount(item.skuId, item.count + 1))}>+</button></div></td>
          <td className="price">{loading || error || item.price == null ? 'Unavailable' : `¥${(Number(item.price) * item.count).toFixed(2)}`}</td>
          <td><button className="btn btn-outline" aria-label={`Remove SKU ${item.skuId}`} disabled={disabled} onClick={() => act(() => removeItem(item.skuId))}>Remove</button></td>
        </tr>)}
      </tbody></table></div>
      <div className="cart-footer"><button className="btn btn-outline" disabled={disabled} onClick={() => act(clearCart)}>{pendingCount ? 'Clear saved cart and retry merge' : 'Clear cart'}</button><div className="cart-total">Selected total: <span className="price">{loading || error || totalAmount == null ? 'Unavailable' : `¥${Number(totalAmount).toFixed(2)}`}</span></div><button className="btn btn-primary btn-lg" disabled={disabled || !readyToCheckout || pendingCount > 0} onClick={checkout}>{checking ? 'Checking products…' : owner === 'guest' ? 'Sign in to checkout' : 'Checkout selected'}</button></div>
    </>}
  </div>
}
