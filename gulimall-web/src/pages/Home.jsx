import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCatalogJson, getSkuList } from '../api/product'
import { getHomeAdvList } from '../api/coupon'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [catalog, setCatalog] = useState({})
  const [products, setProducts] = useState([])
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [catData, skuRes, advRes] = await Promise.allSettled([
          getCatalogJson(),
          getSkuList({ page: 1, limit: 8 }),
          getHomeAdvList({ page: 1, limit: 5 }),
        ])

        if (catData.status === 'fulfilled') setCatalog(catData.value || {})
        if (skuRes.status === 'fulfilled' && skuRes.value?.code === 0) {
          setProducts(skuRes.value.page?.list || [])
        }
        if (advRes.status === 'fulfilled' && advRes.value?.code === 0) {
          setBanners(advRes.value.page?.list || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const catalogEntries = Object.entries(catalog)

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div className="home-layout">
        <div className="category-sidebar">
          {catalogEntries.slice(0, 10).map(([cat1Id, cat2List]) => (
            <div key={cat1Id} className="category-item">
              分类 {cat1Id}
              <div className="category-popup">
                {(cat2List || []).map((cat2) => (
                  <div key={cat2.id} className="cat2-group">
                    <div className="cat2-name">{cat2.name}</div>
                    <div className="cat3-list">
                      {(cat2.catalog3List || []).map((cat3) => (
                        <Link
                          key={cat3.id}
                          to={`/search?catalog3Id=${cat3.id}&keyword=${encodeURIComponent(cat3.name)}`}
                        >
                          {cat3.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {catalogEntries.length === 0 && !loading && (
            <div className="category-item">暂无分类数据</div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          {banners.length > 0 ? (
            <div className="home-banner" style={{ background: '#e4393c' }}>
              {banners[0].name || '谷粒商城 品质好物'}
            </div>
          ) : (
            <div className="home-banner">谷粒商城 · 品质生活</div>
          )}
        </div>
      </div>

      <h2 className="section-title">热门推荐</h2>
      {loading ? (
        <div className="loading">加载中...</div>
      ) : products.length > 0 ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.skuId} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          暂无商品数据，请确认 gulimall-product 服务已启动（端口 10000）
        </div>
      )}
    </div>
  )
}
