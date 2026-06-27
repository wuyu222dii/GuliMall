import { Link } from 'react-router-dom'

const PLACEHOLDER = 'https://via.placeholder.com/300x300?text=Gulimall'

export default function ProductCard({ product }) {
  const img = product.skuDefaultImg || PLACEHOLDER
  const name = product.skuTitle || product.skuName || 'Product'
  const price = product.price ?? '0.00'

  return (
    <Link to={`/product/${product.skuId}`} className="product-card">
      <div className="product-card-img">
        <img
          src={img.startsWith('http') ? img : PLACEHOLDER}
          alt={name}
          onError={(e) => { e.target.src = PLACEHOLDER }}
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
