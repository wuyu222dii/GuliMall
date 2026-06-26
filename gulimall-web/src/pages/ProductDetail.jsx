import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSkuInfo } from '../api/product'
import { getSkuHasStock } from '../api/ware'
import { useCartStore } from '../store/cartStore'

const PLACEHOLDER = 'https://via.placeholder.com/400x400?text=Gulimall'

export default function ProductDetail() {
  const { skuId } = useParams()
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)

  const [sku, setSku] = useState(null)
  const [hasStock, setHasStock] = useState(null)
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await getSkuInfo(skuId)
        if (res.code === 0) {
          setSku(res.skuInfo)
          try {
            const stockRes = await getSkuHasStock([Number(skuId)])
            if (stockRes.code === 0) {
              const item = (stockRes.data || []).find((s) => s.skuId === Number(skuId))
              setHasStock(item?.hasStock ?? false)
            }
          } catch {
            setHasStock(null)
          }
        } else {
          setError(res.msg || '商品不存在')
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [skuId])

  const handleAddCart = () => {
    if (!sku) return
    addItem(sku, qty)
    alert('已加入购物车')
  }

  const handleBuyNow = () => {
    if (!sku) return
    addItem(sku, qty)
    navigate('/cart')
  }

  if (loading) return <div className="loading container">加载中...</div>
  if (error || !sku) return <div className="empty-state container">{error || '商品不存在'}</div>

  const img = sku.skuDefaultImg?.startsWith('http') ? sku.skuDefaultImg : PLACEHOLDER

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div className="breadcrumb">
        <a href="/">首页</a>
        <span>&gt;</span>
        <a href="/search">商品搜索</a>
        <span>&gt;</span>
        {sku.skuTitle || sku.skuName}
      </div>

      <div className="detail-layout">
        <div className="detail-img">
          <img
            src={img}
            alt={sku.skuName}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            onError={(e) => { e.target.src = PLACEHOLDER }}
          />
        </div>

        <div className="detail-info">
          <h1 className="detail-title">{sku.skuTitle || sku.skuName}</h1>
          {sku.skuSubtitle && <p className="detail-subtitle">{sku.skuSubtitle}</p>}

          <div className="detail-price-box">
            <span style={{ color: '#999', marginRight: 12 }}>价格</span>
            <span className="price">
              <span className="price-symbol">¥</span>
              <span className="price-value">{sku.price}</span>
            </span>
          </div>

          <div className="detail-stock">
            库存状态：
            {hasStock === null ? (
              <span>查询中...</span>
            ) : hasStock ? (
              <span className="stock-yes">有货</span>
            ) : (
              <span className="stock-no">无货</span>
            )}
          </div>

          {sku.skuDesc && (
            <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>{sku.skuDesc}</p>
          )}

          <div className="qty-control">
            <span style={{ marginRight: 8 }}>数量</span>
            <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
            <input
              type="number"
              value={qty}
              min={1}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            />
            <button onClick={() => setQty(qty + 1)}>+</button>
          </div>

          <div className="detail-actions">
            <button className="btn btn-primary btn-lg" onClick={handleAddCart} disabled={hasStock === false}>
              加入购物车
            </button>
            <button className="btn btn-outline btn-lg" onClick={handleBuyNow} disabled={hasStock === false}>
              立即购买
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
