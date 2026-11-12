import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBrands, getCategoryTree, searchProducts } from '../api/product'
import { leafCategories } from '../utils/product'
import ProductCard from '../components/ProductCard'
import { consumerQuery } from '../utils/consumer'
import { attrParts, selectAttr, searchParams as toParams, validatedFacets } from '../utils/search'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.toString()
  const parsed = useMemo(() => { try { return { values: consumerQuery('search', query), error: '' } } catch (e) { return { values: consumerQuery('search', ''), error: e.message } } }, [query])
  const catalogId = parsed.values.catalogId, page = Number(parsed.values.page)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [metadataError, setMetadataError] = useState('')
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState(null)
  const [retry, setRetry] = useState(0)
  const [form, setForm] = useState(parsed.values)
  const current = response?.query === query ? response : null, result = current?.page, facets = current?.facets
  const error = parsed.error || (failure?.query === query ? failure.message : ''), searching = !error && (loading || !result)

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
    setResponse(null)
    setFailure(null)
    if (parsed.error) { setLoading(false); return }
    const params = toParams(parsed.values)
    params.set('limit', '12')
    searchProducts(params)
      .then((res) => { if (active) {
        if (!res.page || !Array.isArray(res.page.list) || !Number.isInteger(res.page.totalCount) || res.page.totalCount < 0 || !Number.isInteger(res.page.totalPage)) throw new Error('搜索结果不完整，请重试。')
        const options = validatedFacets(res.facets)
        const last = Math.max(1, Math.min(833, res.page.totalPage))
        if (page > last) { redirecting = true; const next = new URLSearchParams(query); next.set('page', String(last)); setSearchParams(next, { replace: true }); return }
        setResponse({ query, page: res.page, facets: options })
      } })
      .catch((e) => { if (active) setFailure({ query, message: e.message }) })
      .finally(() => { if (active && !redirecting) setLoading(false) })
    return () => { active = false }
  }, [query, retry, parsed.error, parsed.values, page, setSearchParams])

  const submit = (event) => {
    event.preventDefault()
    setSearchParams(toParams({ ...form, page: '1' }))
  }
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.name === 'brandId' ? event.target.value ? [event.target.value] : [] : event.target.value,
    ...(event.target.name === 'catalogId' ? { brandId: [] } : {}) })
  const goPage = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }
  const remove = (key, index = null) => {
    const next = { ...parsed.values, page: '1', [key]: index === null ? '' : parsed.values[key].filter((_, i) => i !== index) }
    setSearchParams(toParams(next))
  }
  const clearAttr = id => setSearchParams(toParams({ ...parsed.values, page: '1', attrs: selectAttr(parsed.values.attrs, id, '') }))
  const chips = []
  for (const [key, label] of Object.entries({ keyword: '关键词', catalogId: '分类', min: '最低价格', max: '最高价格', hasStock: '库存' })) if (parsed.values[key] !== '') {
    const value = key === 'catalogId' ? categories.find(item => String(item.id) === parsed.values[key])?.label || parsed.values[key] : key === 'hasStock' ? parsed.values[key] === '1' ? '有货' : '缺货' : parsed.values[key]
    chips.push({ key, label: `${label}：${value}` })
  }
  parsed.values.brandId.forEach((id, index) => chips.push({ key: 'brandId', index, label: `品牌：${brands.find(brand => String(brand.brandId) === id)?.name || id}` }))
  parsed.values.attrs.forEach((raw, index) => { const [id, value] = attrParts(raw); chips.push({ key: 'attrs', index, label: `规格 ${facets?.attrs.find(attr => attr.attrId === id)?.attrName || id}：${value}` }) })

  return (
    <div className="container catalog-page">
      <div className="breadcrumb"><Link to="/">首页</Link><span>&gt;</span>商品搜索</div>
      <h1 className="page-title">商品搜索</h1>
      <form className="search-filters filter-grid" onSubmit={submit}>
        <label>关键词<input className="input" name="keyword" value={form.keyword || ''} maxLength={100} onChange={change} /></label>
        <label>分类<select aria-label="分类" className="input" name="catalogId" value={form.catalogId || ''} onChange={change}>
          <option value="">全部分类</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          {form.catalogId && !categories.some(category => String(category.id) === form.catalogId) && <option value={form.catalogId}>分类 {form.catalogId}（当前条件）</option>}
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
        {facets && <section className="search-specs card" aria-label="规格筛选"><h2>商品规格</h2><p className="admin-note">选项按当前全部条件生成；切换规格时可先清除此规格，再重新选择并应用筛选。</p>
          {facets.attrsTruncated && <p role="status">规格较多，仅展示前20个属性；已有条件仍生效，可在已选条件中移除。</p>}
          {!facets.attrs.length && <p>当前条件下暂无可选规格，已选条件仍保留。</p>}
          <div className="filter-grid">{facets.attrs.map(attr => {
            const selected = (form.attrs || []).filter(value => attrParts(value)[0] === attr.attrId).map(value => attrParts(value)[1])
            const retained = selected.filter(value => !attr.values.includes(value))
            let multiple = '__multiple__'
            while (attr.values.includes(multiple) || selected.includes(multiple)) multiple += '_'
            return <div key={attr.attrId}><label>{attr.attrName}<select className="input" aria-label={`规格 ${attr.attrName}（${attr.attrId}）`} value={selected.length > 1 ? multiple : selected[0] || ''} onChange={event => setForm({ ...form, attrs: selectAttr(form.attrs, attr.attrId, event.target.value) })}>
              <option value="">不选择此规格</option>{selected.length > 1 && <option value={multiple} disabled>旧链接同时要求{selected.length}项，另选将替换</option>}
              {[...attr.values, ...new Set(retained)].map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>{attr.truncated && <p className="admin-note" role="status">此属性仅展示前50个值，已选值仍保留。</p>}{parsed.values.attrs.some(value => attrParts(value)[0] === attr.attrId) && <button type="button" className="btn btn-outline" onClick={() => clearAttr(attr.attrId)}>清除规格 {attr.attrName}（{attr.attrId}）</button>}</div>
          })}</div>
        </section>}
        <div className="filter-actions"><button className="btn btn-primary" type="submit">应用筛选</button><Link className="btn btn-outline" to="/search">清除筛选</Link></div>
      </form>
      {!!chips.length && <section className="search-selected card" aria-label="已选搜索条件"><h2>已选条件</h2><div className="admin-actions">{chips.map(chip => <button type="button" className="btn btn-outline" key={`${chip.key}:${chip.index ?? ''}`} aria-label={`移除${chip.label}${chip.index === undefined ? '' : `（第${chip.index + 1}项）`}`} onClick={() => remove(chip.key, chip.index ?? null)}>{chip.label} ×</button>)}<Link className="btn btn-outline" to="/search">清除全部条件</Link></div></section>}
      {metadataError && <p className="error-msg" role="alert">{metadataError}<button type="button" className="btn btn-outline" onClick={() => setRetry(value => value + 1)}>重试筛选资料</button></p>}
      {searching ? <div className="loading" role="status">正在搜索…</div> : error ?
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
