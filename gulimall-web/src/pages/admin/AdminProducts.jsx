import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCatalog, listProducts, publishProduct } from '../../api/admin'
import { leafCategories } from '../../utils/product'
import { adminQuery, adminListUrl, productStatuses } from '../../utils/admin'

export default function AdminProducts() {
  const [params, setParams] = useSearchParams(), query = params.toString()
  const parsed = useMemo(() => { try { return { values: adminQuery('products', query), error: '' } } catch (e) { return { values: { page: '1' }, error: e.message } } }, [query])
  const filters = parsed.values, page = Number(filters.page)
  const [fields, setFields] = useState({ key: '', catalogId: '', brandId: '', status: '' })
  const [meta, setMeta] = useState(null), [metadataError, setMetadataError] = useState(''), [metadataRetry, setMetadataRetry] = useState(0)
  const [result, setResult] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0), [busy, setBusy] = useState(false), working = useRef(false)
  const [notice, setNotice] = useState(''), [actionError, setActionError] = useState('')
  useEffect(() => { const p = new URLSearchParams(query); setFields(Object.fromEntries(['key', 'catalogId', 'brandId', 'status'].map(key => [key, p.get(key) || '']))) }, [query])
  useEffect(() => {
    let active = true
    getCatalog().then(res => { if (active) { setMeta(res.data); setMetadataError('') } }).catch(e => { if (active) setMetadataError(e.message) })
    return () => { active = false }
  }, [metadataRetry])
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setResult(null)
    if (parsed.error) { setError(parsed.error); setLoading(false); return }
    listProducts({ ...filters, limit: 20 }).then(res => { if (active) {
      const last = Math.max(1, res.page.totalPage)
      if (page > last) { const p = new URLSearchParams(query); p.set('page', String(last)); setParams(p, { replace: true }) }
      else setResult(res.page)
    } }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, parsed.error, page, query, retry, setParams])
  const publish = async product => {
    if (working.current || loading || error) return
    working.current = true; setBusy(true); setNotice(''); setActionError('')
    try { await publishProduct(product.id, product.publishStatus === 1 ? 0 : 1); setNotice('目标状态与搜索索引已同步。') }
    catch (e) { setActionError(e.message) }
    finally { working.current = false; setBusy(false); setRetry(v => v + 1) }
  }
  const goPage = next => { const p = new URLSearchParams(query); p.set('page', String(next)); setParams(p) }
  const listUrl = adminListUrl('products', query), suffix = listUrl.slice('/admin/products'.length)
  const categories = meta ? leafCategories(meta.categories) : [], brands = meta?.brands || []
  const categoryNames = Object.fromEntries(categories.map(c => [c.id, c.label])), brandNames = Object.fromEntries(brands.map(b => [b.brandId, b.name]))
  return <section>
    <div className="admin-toolbar"><h2>商品列表</h2><Link className="btn btn-outline" to={'/admin/products/sync' + suffix}>同步与索引重建</Link><Link className="btn btn-outline" to="/admin/products/catalog">分类、品牌与属性</Link><Link className="btn btn-primary" to={'/admin/products/new' + suffix}>新建商品</Link></div>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); const next = { page: '1' }; for (const [key, value] of Object.entries(fields)) if (value.trim()) next[key] = value.trim(); setParams(next); setRetry(v => v + 1); setNotice('') }}>
      <label>商品名称或 SPU 编号<input className="input" value={fields.key} maxLength={100} onChange={e => setFields({ ...fields, key: e.target.value })} /></label>
      <label>商品分类<select aria-label="商品分类" className="input" value={fields.catalogId} onChange={e => setFields({ ...fields, catalogId: e.target.value })}><option value="">全部分类</option>{categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}{fields.catalogId && !categoryNames[fields.catalogId] && <option value={fields.catalogId}>分类 #{fields.catalogId}（名称未加载）</option>}</select></label>
      <label>商品品牌<select aria-label="商品品牌" className="input" value={fields.brandId} onChange={e => setFields({ ...fields, brandId: e.target.value })}><option value="">全部品牌</option>{brands.map(b => <option key={b.brandId} value={b.brandId}>{b.name}{b.showStatus === 1 ? '' : '（隐藏）'}</option>)}{fields.brandId && !brandNames[fields.brandId] && <option value={fields.brandId}>品牌 #{fields.brandId}（名称未加载）</option>}</select></label>
      <label>商品上架状态<select aria-label="商品上架状态" className="input" value={fields.status} onChange={e => setFields({ ...fields, status: e.target.value })}><option value="">全部状态</option>{Object.entries(productStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="btn btn-outline" disabled={busy}>查询</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setParams({}); setRetry(v => v + 1); setNotice('') }}>清除商品筛选</button>
    </form>
    {metadataError && <p className="error-msg" role="alert">分类或品牌选项加载失败：{metadataError} 已保留筛选编号；名称未加载时按编号显示。<button className="btn btn-outline" onClick={() => setMetadataRetry(v => v + 1)}>重试分类品牌</button></p>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}{actionError && <p className="error-msg" role="alert">{actionError} <Link to={'/admin/products/sync' + suffix}>查看同步任务</Link></p>}
    {error && <p className="error-msg" role="alert">{error} <button className="btn btn-outline" onClick={() => setRetry(v => v + 1)}>重试</button></p>}
    {loading ? <p role="status">正在加载商品…</p> : result && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SPU 编号</th><th>商品名称</th><th>分类 / 品牌</th><th>状态</th><th>操作</th></tr></thead><tbody>{result.list.map(product => <tr key={product.id}><td>{product.id}</td><td>{product.spuName}</td><td>{categoryNames[product.catalogId] || '分类名称未加载'}（#{product.catalogId}）<br />{brandNames[product.brandId] || '品牌名称未加载'}（#{product.brandId}）</td><td>{productStatuses[product.publishStatus] || '未知状态'}</td><td><Link to={'/admin/products/' + product.id + '/edit' + suffix}>编辑 SPU / SKU</Link> <Link to={'/admin/products/sync' + suffix + (suffix ? '&' : '?') + 'syncSpuId=' + product.id}>同步记录 {product.id}</Link> <button className="btn btn-outline" disabled={busy || loading || !!error} onClick={() => publish(product)}>{product.publishStatus === 1 ? '下架' : '上架'}</button></td></tr>)}{!result.list.length && <tr><td colSpan={5}>没有符合条件的商品。</td></tr>}</tbody></table></div>}
    <div className="pagination"><button disabled={page <= 1 || loading || busy || !!error} onClick={() => goPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(result?.totalPage || 1, 1)} 页</span><button disabled={page >= (result?.totalPage || 1) || loading || busy || !!error} onClick={() => goPage(page + 1)}>下一页</button></div>
    <p className="admin-note">新商品保存为草稿。上下架会同步搜索索引；失败任务自动重试。状态 2 仅用于读取历史下架记录，当前上下架仍使用 0 / 1，历史数据不改写。营销字段不启用。</p>
  </section>
}