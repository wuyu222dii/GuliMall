import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBrands, getCategoryTree, searchProducts } from '../api/product'
import { leafCategories } from '../utils/product'
import ProductCard from '../components/ProductCard'
import { consumerQuery } from '../utils/consumer'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.toString()
  const parsed = useMemo(() => { try { return { values: consumerQuery('search', query), error: '' } } catch (e) { return { values: consumerQuery('search', ''), error: e.message } } }, [query])
  const catalogId = parsed.values.catalogId, page = Number(parsed.values.page)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [metadataError, setMetadataError] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm(parsed.values)
  }, [parsed.values])

  useEffect(() => {
    let active = true
    setMetadataError('')
    if (parsed.error) return
    Promise.all([getCategoryTree(), getBrands(form.catalogId ?? catalogId)])
      .then(([tree, options]) => { if (active) { setCategories(leafCategories(tree.data)); setBrands(options.data) } })
      .catch(() => { if (active) setMetadataError('筛选项加载失败，请重试搜索。') })
    return () => { active = false }
  }, [catalogId, form.catalogId, retry, parsed.error])

  useEffect(() => {
    let active = true, redirecting = false
    setLoading(true)
    setResult(null)
    setError('')
    if (parsed.error) { setError(parsed.error); setLoading(false); return }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(parsed.values)) for (const item of Array.isArray(value) ? value : [value]) if (item !== '') params.append(key, item)
    params.set('limit', '12')
    searchProducts(params)
      .then((res) => { if (active) {
        const last = Math.max(1, Math.min(833, res.page.totalPage))
        if (page > last) { redirecting = true; const next = new URLSearchParams(query); next.set('page', String(last)); setSearchParams(next, { replace: true }); return }
        setResult(res.page)
      } })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active && !redirecting) setLoading(false) })
    return () => { active = false }
  }, [query, retry, parsed.error, parsed.values, page, setSearchParams])

  const submit = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(form)) for (const item of Array.isArray(value) ? value : [value]) if (item !== '') params.append(key, item)
    params.set('page', '1')
    setSearchParams(params)
  }
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.name === 'brandId' ? event.target.value ? [event.target.value] : [] : event.target.value,
    ...(event.target.name === 'catalogId' ? { brandId: [] } : {}) })
  const goPage = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }

  return (
    <div className="container catalog-page">
      <div className="breadcrumb"><Link to="/">首页</Link><span>&gt;</span>商品搜索</div>
      <h1 className="page-title">商品搜索</h1>
      <form className="search-filters filter-grid" onSubmit={submit}>
        <label>关键词<input className="input" name="keyword" value={form.keyword || ''} maxLength={100} onChange={change} /></label>
        <label>分类<select aria-label="分类" className="input" name="catalogId" value={form.catalogId || ''} onChange={change}>
          <option value="">全部分类</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
        <label>品牌<select aria-label="品牌" className="input" name="brandId" value={form.brandId?.length > 1 ? '__multiple__' : form.brandId?.[0] || ''} onChange={change}>
          <option value="">全部品牌</option>
          {form.brandId?.length > 1 && <option disabled value="__multiple__">已选 {form.brandId.length} 个品牌，另选将替换</option>}
          {brands.map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.name}</option>)}
          {(form.brandId || []).filter(id => !brands.some(b => String(b.brandId) === id)).map(id => <option key={id} value={id}>品牌 {id}</option>)}
        </select></label>
        <label>最低价格<input className="input" type="number" name="min" min="0" step="0.01" value={form.min || ''} onChange={change} /></label>
        <label>最高价格<input className="input" type="number" name="max" min="0" step="0.01" value={form.max || ''} onChange={change} /></label>
        <label>排序<select aria-label="排序" className="input" name="sort" value={form.sort || 'default'} onChange={change}>
          <option value="default">默认</option><option value="price_asc">价格从低到高</option><option value="price_desc">价格从高到低</option>
        </select></label>
        <label>库存<select aria-label="库存" className="input" name="hasStock" value={form.hasStock || ''} onChange={change}><option value="">全部库存状态</option><option value="1">有货</option><option value="0">缺货</option></select></label>
        <div className="filter-actions"><button className="btn btn-primary" type="submit">应用筛选</button><Link className="btn btn-outline" to="/search">清除筛选</Link></div>
      </form>
      {form.attrs?.length > 0 && <p className="admin-note">已保留 {form.attrs.length} 项 URL 规格条件，可通过“清除筛选”移除。</p>}
      {metadataError && <p className="error-msg" role="alert">{metadataError}</p>}
      {loading ? <div className="loading" role="status">正在搜索…</div> : error ?
        <div className="empty-state" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>重试搜索</button></div> : <>
          <div className="search-header" aria-live="polite">共找到 {result?.totalCount || 0} 件商品</div>
          {result?.list?.length ? <div className="product-grid">{result.list.map((p) => <ProductCard key={p.skuId} product={p} />)}</div>
            : <div className="empty-state">没有匹配商品，请尝试清除筛选条件。</div>}
          {result?.totalPage > 1 && <nav className="pagination" aria-label="搜索结果分页">
            <button disabled={page <= 1} onClick={() => goPage(page - 1)}>上一页</button>
            <span>第 {page} / {Math.min(833, result.totalPage)} 页</span>
            <button disabled={page >= Math.min(833, result.totalPage)} onClick={() => goPage(page + 1)}>下一页</button>
          </nav>}
        </>}
    </div>
  )
}
