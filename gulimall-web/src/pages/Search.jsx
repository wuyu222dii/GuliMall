import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBrands, getCategoryTree, searchProducts } from '../api/product'
import { leafCategories } from '../utils/product'
import ProductCard from '../components/ProductCard'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.toString()
  const catalogId = searchParams.get('catalogId') || searchParams.get('catalog3Id') || ''
  const page = Number(searchParams.get('page') || 1)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [metadataError, setMetadataError] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [form, setForm] = useState({})

  useEffect(() => {
    const params = new URLSearchParams(query)
    setForm({ keyword: params.get('keyword') || '', catalogId: params.get('catalogId') || params.get('catalog3Id') || '',
      brandId: params.get('brandId') || '', min: params.get('min') || '', max: params.get('max') || '', sort: params.get('sort') || 'default', hasStock: params.get('hasStock') || '' })
  }, [query])

  useEffect(() => {
    let active = true
    setMetadataError('')
    Promise.all([getCategoryTree(), getBrands(form.catalogId ?? catalogId)])
      .then(([tree, options]) => { if (active) { setCategories(leafCategories(tree.data)); setBrands(options.data) } })
      .catch(() => { if (active) setMetadataError('Filter options could not be loaded. Retry the search.') })
    return () => { active = false }
  }, [catalogId, form.catalogId, retry])

  useEffect(() => {
    let active = true
    setLoading(true)
    setResult(null)
    setError('')
    const params = Object.fromEntries(new URLSearchParams(query))
    params.catalogId ||= params.catalog3Id || ''
    delete params.catalog3Id
    searchProducts({ ...params, limit: 12 })
      .then((res) => { if (active) setResult(res.page) })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, retry])

  const submit = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(form)) if (value) params.set(key, value)
    params.set('page', '1')
    setSearchParams(params)
  }
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value,
    ...(event.target.name === 'catalogId' ? { brandId: '' } : {}) })
  const goPage = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }

  return (
    <div className="container catalog-page">
      <div className="breadcrumb"><Link to="/">Home</Link><span>&gt;</span>Product search</div>
      <h1 className="page-title">Product search</h1>
      <form className="search-filters filter-grid" onSubmit={submit}>
        <label>Keyword<input className="input" name="keyword" value={form.keyword || ''} maxLength={100} onChange={change} /></label>
        <label>Category<select className="input" name="catalogId" value={form.catalogId || ''} onChange={change}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select></label>
        <label>Brand<select className="input" name="brandId" value={form.brandId || ''} onChange={change}>
          <option value="">All brands</option>
          {brands.map((brand) => <option key={brand.brandId} value={brand.brandId}>{brand.name}</option>)}
          {form.brandId && !brands.some((b) => String(b.brandId) === form.brandId) && <option value={form.brandId}>Brand {form.brandId}</option>}
        </select></label>
        <label>Minimum price<input className="input" type="number" name="min" min="0" step="0.01" value={form.min || ''} onChange={change} /></label>
        <label>Maximum price<input className="input" type="number" name="max" min="0" step="0.01" value={form.max || ''} onChange={change} /></label>
        <label>Sort<select className="input" name="sort" value={form.sort || 'default'} onChange={change}>
          <option value="default">Default</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
        </select></label>
        <label>Stock<select className="input" name="hasStock" value={form.hasStock || ''} onChange={change}><option value="">All stock states</option><option value="1">In stock</option><option value="0">Out of stock</option></select></label>
        <div className="filter-actions"><button className="btn btn-primary" type="submit">Apply filters</button><Link className="btn btn-outline" to="/search">Clear filters</Link></div>
      </form>
      {metadataError && <p className="error-msg" role="alert">{metadataError}</p>}
      {loading ? <div className="loading" role="status">Searching…</div> : error ?
        <div className="empty-state" role="alert"><p>{error}</p><button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>Retry search</button></div> : <>
          <div className="search-header" aria-live="polite">Found {result?.totalCount || 0} products</div>
          {result?.list?.length ? <div className="product-grid">{result.list.map((p) => <ProductCard key={p.skuId} product={p} />)}</div>
            : <div className="empty-state">No matching products. Try clearing a filter.</div>}
          {result?.totalPage > 1 && <nav className="pagination" aria-label="Search result pages">
            <button disabled={page <= 1} onClick={() => goPage(page - 1)}>Previous</button>
            <span>Page {page} of {result.totalPage}</span>
            <button disabled={page >= result.totalPage} onClick={() => goPage(page + 1)}>Next</button>
          </nav>}
        </>}
    </div>
  )
}
