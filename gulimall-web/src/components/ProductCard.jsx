import { Link } from 'react-router-dom'
import { IMAGE_FALLBACK, productImage } from '../utils/product'

export default function ProductCard({ product }) {
  const img = productImage(product.skuDefaultImg)
  const name = product.skuTitle || product.skuName || '商品'
  const price = product.price == null ? '价格暂不可用' : Number(product.price).toFixed(2)

  return (
    <Link to={`/product/${product.skuId}`} className="product-card">
      <div className="product-card-img">
        <img
          src={img}
          alt={name}
          onError={(e) => { if (e.currentTarget.getAttribute('src') !== IMAGE_FALLBACK) e.currentTarget.src = IMAGE_FALLBACK }}
        />
      </div>
      <div className="product-card-body">
        <div className="product-card-title">{name}</div>
        <div className="product-card-price">
          <span className="price-symbol">¥</span>{price}
        </div>
      </div>
    </Link>
  )
}

ProductCard.propTypes = {
  product(props, name) {
    const product = props[name]
    return product && Number.isSafeInteger(product.skuId) && Number.isFinite(Number(product.price))
      ? null : new Error('ProductCard requires a SKU id and price.')
  },
}
