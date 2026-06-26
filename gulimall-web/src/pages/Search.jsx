import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getSkuList } from '../api/product'
import ProductCard from '../components/ProductCard'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') || ''
  const catalog3Id = searchParams.get('catalog3Id') || ''
  const page = Number(searchParams.get('page') || 1)

  const [products, setProducts] = useState([])
  const [totalPage, setTotalPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const params = { page, limit: 12 }
        if (keyword) params.key = keyword
        if (catalog3Id) params.catalogId = catalog3Id

        const res = await getSkuList(params)
        if (res.code === 0) {
          setProducts(res.page?.list || [])
          setTotalPage(res.page?.totalPage || 1)
          setTotalCount(res.page?.totalCount || 0)
        } else {
          setError(res.msg || '查询失败')
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [keyword, catalog3Id, page])

  const goPage = (p) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(p))
    setSearchParams(params)
  }

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 40 }}>
      <div className="breadcrumb">
        <a href="/">首页</a>
        <span>&gt;</span>
        搜索结果
        {keyword && <> — 「{keyword}」</>}
      </div>

      <div className="search-header">
        <div>
          共找到 <strong style={{ color: '#e4393c' }}>{totalCount}</strong> 件商品
        </div>
      </div>

      {loading ? (
        <div className="loading">搜索中...</div>
      ) : error ? (
        <div className="empty-state">{error}</div>
      ) : products.length > 0 ? (
        <>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.skuId} product={p} />
            ))}
          </div>
          {totalPage > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => goPage(page - 1)}>上一页</button>
              {Array.from({ length: Math.min(totalPage, 10) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={p === page ? 'active' : ''}
                  onClick={() => goPage(p)}
                >
                  {p}
                </button>
              ))}
              <button disabled={page >= totalPage} onClick={() => goPage(page + 1)}>下一页</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">没有找到相关商品</div>
      )}
    </div>
  )
}
