import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { checkPurchase, getSkuInfo } from '../api/product'
import { IMAGE_FALLBACK, productImage, unavailableReason } from '../utils/product'
import { useCartStore } from '../store/cartStore'

export default function ProductDetail() {
  const { skuId } = useParams()
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)
  const [item, setItem] = useState(null)
  const [qty, setQty] = useState(1)
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [purchaseError, setPurchaseError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true); setItem(null); setQty(1); setNotice(''); setPurchaseError(''); setError('')
    getSkuInfo(skuId).then((res) => {
      if (active) { setItem(res.item); setImage(productImage(res.item.info.skuDefaultImg)) }
    }).catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [skuId, retry])

  const purchase = async (buyNow) => {
    if (!item || unavailableReason(item) || busy) return
    setBusy(true); setNotice(''); setPurchaseError('')
    try {
      const fresh = await checkPurchase(skuId)
      await addItem(fresh.skuInfo, qty)
      if (buyNow) navigate('/cart')
      else setNotice('Added to cart.')
    } catch (e) { setPurchaseError(e.message) }
    finally { setBusy(false) }
  }
  const failedImage = (event) => {
    if (event.currentTarget.getAttribute('src') !== IMAGE_FALLBACK) event.currentTarget.src = IMAGE_FALLBACK
  }
  if (loading || (item && String(item.info.skuId) !== skuId)) return <div className="loading container" role="status">Loading product…</div>
  if (error || !item) return <div className="empty-state container" role="alert"><p>{error || 'Product not found'}</p><button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>Retry</button><Link className="btn btn-outline" to="/search">Browse products</Link></div>

  const sku = item.info
  const unavailable = unavailableReason(item)
  const images = [...new Set([sku.skuDefaultImg, ...(item.images || []).map((img) => img.imgUrl)].filter(Boolean))]
  const descriptionImages = (item.desc?.decript || '').split(',').map((s) => s.trim()).filter((s) => productImage(s) !== IMAGE_FALLBACK)
  return (
    <div className="container catalog-page">
      <div className="breadcrumb"><Link to="/">Home</Link><span>&gt;</span><Link to="/search">Product search</Link><span>&gt;</span>{sku.skuTitle || sku.skuName}</div>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-img"><img src={image} alt={sku.skuName} onError={failedImage} /></div>
          <div className="detail-thumbnails">{images.map((src, i) => <button key={src} aria-label={`View image ${i + 1}`} aria-pressed={image === productImage(src)} onClick={() => setImage(productImage(src))}><img src={productImage(src)} alt="" onError={failedImage} /></button>)}</div>
        </div>
        <div className="detail-info">
          <h1 className="detail-title">{sku.skuTitle || sku.skuName}</h1>
          {sku.skuSubtitle && <p className="detail-subtitle">{sku.skuSubtitle}</p>}
          <div className="detail-price-box">Price <span className="price">{sku.price == null ? 'Unavailable' : `¥${Number(sku.price).toFixed(2)}`}</span></div>
          <p className="detail-stock" role="status">{unavailable || 'In stock · Available to purchase'}</p>
          {(unavailable || purchaseError) && <button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>Refresh availability</button>}
          <fieldset className="sku-choices"><legend>Choose a specification</legend>
            {(item.variants || []).map((variant) => {
              const attrs = (item.saleAttr || []).flatMap((attr) => (attr.attrValues || []).filter((v) => String(v.skuIds).split(',').includes(String(variant.skuId))).map((v) => `${attr.attrName}: ${v.attrValue}`))
              return <Link key={variant.skuId} className={variant.skuId === sku.skuId ? 'selected' : ''} aria-current={variant.skuId === sku.skuId ? 'page' : undefined} to={`/product/${variant.skuId}`}>{attrs.join(' · ') || variant.skuName}</Link>
            })}
          </fieldset>
          <div className="qty-control"><label htmlFor="purchase-quantity">Quantity</label>
            <button aria-label="Decrease quantity" disabled={qty <= 1 || busy} onClick={() => setQty(qty - 1)}>−</button>
            <input id="purchase-quantity" type="number" min="1" max="999" step="1" value={qty} disabled={busy} onChange={(e) => setQty(Math.min(999, Math.max(1, Math.trunc(Number(e.target.value)) || 1)))} />
            <button aria-label="Increase quantity" disabled={qty >= 999 || busy} onClick={() => setQty(qty + 1)}>+</button>
          </div>
          <div className="detail-actions"><button className="btn btn-primary btn-lg" onClick={() => purchase(false)} disabled={!!unavailable || !!purchaseError || busy}>{busy ? 'Checking…' : 'Add to cart'}</button><button className="btn btn-outline btn-lg" onClick={() => purchase(true)} disabled={!!unavailable || !!purchaseError || busy}>Buy now</button></div>
          {notice && <p className="purchase-notice" role="status">{notice} <Link to="/cart">View cart</Link></p>}
          {purchaseError && <p className="error-msg" role="alert">{purchaseError}</p>}
        </div>
      </div>
      <section className="product-section"><h2>Specifications</h2>
        {item.groupAttrs?.length ? item.groupAttrs.map((group) => <div key={group.groupId}><h3>{group.groupName}</h3><dl className="specification-list">{(group.attrs || []).map((attr) => <div key={attr.attrId}><dt>{attr.attrName}</dt><dd>{attr.attrValue}</dd></div>)}</dl></div>) : <p>No specifications have been provided.</p>}
      </section>
      <section className="product-section"><h2>Product introduction</h2><p>{item.spuDescription || sku.skuDesc || 'No introduction has been provided.'}</p>
        {descriptionImages.map((src) => <img key={src} className="description-image" src={src} alt={`${sku.skuName} introduction`} loading="lazy" onError={failedImage} />)}
      </section>
    </div>
  )
}
