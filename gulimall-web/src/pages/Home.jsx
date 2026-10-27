import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getCategoryTree, getSkuList } from '../api/product'
import { getHomeAdvList } from '../api/coupon'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const { hash, key } = useLocation()
  const [expanded, setExpanded] = useState(hash === '#all-categories'), [categoryError, setCategoryError] = useState('')
  useEffect(() => { if (hash === '#all-categories') { setExpanded(true); document.getElementById('all-categories')?.scrollIntoView({ block: 'start' }) } }, [hash, key])
  const [catalog, setCatalog] = useState([])
  const [products, setProducts] = useState([])
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [catData, skuRes, advRes] = await Promise.allSettled([
          getCategoryTree(),
          getSkuList({ page: 1, limit: 8 }),
          getHomeAdvList({ page: 1, limit: 5 }),
        ])

        if (!active) return
        if (catData.status === 'fulfilled') { setCatalog(catData.value.data || []); setCategoryError('') }
        else setCategoryError('分类查询失败，以下可能是上次加载的资料；请重试。')
        if (skuRes.status === 'fulfilled' && skuRes.value?.code === 0) {
          setProducts(skuRes.value.page?.list || [])
        }
        if (advRes.status === 'fulfilled' && advRes.value?.code === 0) {
          setBanners(advRes.value.page?.list || [])
        }
        if (catData.status === 'rejected' || skuRes.status === 'rejected') setError('商品加载失败，请重试。')
      } catch (e) {
        console.error(e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [retry])

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div className="home-layout">
        <div className="category-sidebar">
          {catalog.slice(0, 10).map((cat1) => (
            <div key={cat1.catId} className="category-item" tabIndex={0}>
              {cat1.name}
              <div className="category-popup">
                {(cat1.children || []).map((cat2) => (
                  <div key={cat2.catId} className="cat2-group">
                    <div className="cat2-name">{cat2.name}</div>
                    <div className="cat3-list">
                      {(cat2.children || []).map((cat3) => (
                        <Link
                          key={cat3.catId}
                          to={`/search?catalogId=${cat3.catId}`}
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
          <Link className="all-categories-link" to="/#all-categories">查看全部分类</Link>
          {catalog.length === 0 && !loading && !categoryError && (
            <div className="category-item">暂无分类数据</div>
          )}
        </div>

        <div style={{ flex: 1 }}><p className="admin-note">演示横幅，仅用于本地展示。</p>
          {banners.length > 0 ? (
            <div className="home-banner" style={{ background: '#e4393c' }}>
              {banners[0].name || '谷粒商城 · 品质商品'}
            </div>
          ) : (
            <div className="home-banner">谷粒商城 · 品质生活</div>
          )}
        </div>
      </div>

      <details id="all-categories" className="all-categories" open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}>
        <summary>查看全部分类（{catalog.length} 个一级分类）</summary>
        {categoryError && <p role="alert">{categoryError}<button className="btn btn-outline" onClick={() => setRetry(v => v + 1)}>重试分类</button></p>}
        {loading && <p role="status">正在读取分类…</p>}
        {!loading && !categoryError && !catalog.length && <p>暂无分类数据。</p>}
        {catalog.map(root => <details key={root.catId}><summary>{root.name}</summary>{(root.children || []).map(parent => <section key={parent.catId}><h3>{parent.name}</h3><div className="all-category-links">{(parent.children || []).map(leaf => <Link key={leaf.catId} to={'/search?catalogId=' + leaf.catId}>{leaf.name}</Link>)}</div>{!parent.children?.length && <p className="admin-note">此分类尚无三级分类。</p>}</section>)}{!root.children?.length && <p className="admin-note">此分类尚无下级分类。</p>}</details>)}
      </details>
      <h2 className="section-title">在售商品</h2>
      {loading ? (
        <div className="loading">正在加载…</div>
      ) : error ? <div className="empty-state" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>重试</button></div> : products.length > 0 ? (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.skuId} product={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          暂无可售商品。
        </div>
      )}
    </div>
  )
}
