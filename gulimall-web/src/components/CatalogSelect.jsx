import { useEffect, useState } from 'react'
import { getCatalogDetail, listCatalog } from '../api/admin'
import { catalogKeys, catalogPage } from '../utils/catalog'

export default function CatalogSelect({ kind, label, value, onChange, catalogId = '', disabled = false, required = false, emptyLabel = '请选择' }) {
  const [key, setKey] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [retry, setRetry] = useState(0)
  const [result, setResult] = useState(null), [selected, setSelected] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const id = catalogKeys[kind], name = row => row.name || row.attrGroupName
  useEffect(() => { setPage(1); setKey(''); setSearch(''); setResult(null) }, [kind, catalogId])
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    if (kind === 'groups' && !catalogId) { setResult(null); setLoading(false); return }
    listCatalog(kind, { key: search, page, limit: 20, ...(catalogId ? { catalogId } : {}) })
      .then(res => { if (active) { const value = catalogPage(res.page, kind), last = Math.max(1, value.totalPage); if (page > last) setPage(last); else setResult(value) } })
      .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [kind, catalogId, search, page, retry])
  useEffect(() => {
    let active = true
    setSelected(null)
    if (value) getCatalogDetail(kind, value).then(res => { if (active) setSelected(res.data) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [kind, value, retry])
  const rows = result?.list || [], selectedRow = selected && String(selected[id]) === String(value) && (!catalogId || String(selected.catelogId) === String(catalogId)) ? selected : null
  return <div className="catalog-select">
    <label>{label}<select className="input" aria-label={label} required={required} disabled={disabled || loading || !!error} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>{rows.map(row => <option key={row[id]} value={row[id]}>{name(row)}{row.showStatus === 0 ? '（隐藏）' : ''}</option>)}
      {value && !rows.some(row => String(row[id]) === String(value)) && <option value={value}>{selectedRow ? name(selectedRow) : `编号 #${value}（名称未加载）`}</option>}
    </select></label>
    <label>查找{label}<input className="input" maxLength={100} disabled={disabled} value={key} onChange={event => setKey(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setSearch(key.trim()); setPage(1); setRetry(n => n + 1) } }} /></label>
    <div className="admin-actions"><button type="button" className="btn btn-outline" disabled={disabled || loading} onClick={() => { setSearch(key.trim()); setPage(1); setRetry(n => n + 1) }}>查找{label}</button><button type="button" disabled={disabled || loading || page <= 1} onClick={() => setPage(page - 1)}>上一页{label}</button><span>{label}第 {page} / {Math.max(1, result?.totalPage || 1)} 页</span><button type="button" disabled={disabled || loading || !!error || page >= (result?.totalPage || 1)} onClick={() => setPage(page + 1)}>下一页{label}</button></div>
    {error && <p className="error-msg" role="alert">{label}选项加载失败：{error}。保留原编号，旧选项暂停使用。<button type="button" disabled={disabled} onClick={() => setRetry(n => n + 1)}>重试{label}</button></p>}
  </div>
}

const textProp = (props, key) => props[key] == null || ['string', 'number'].includes(typeof props[key]) ? null : new Error('Invalid catalog selector text')
const booleanProp = (props, key) => props[key] == null || typeof props[key] === 'boolean' ? null : new Error('Invalid catalog selector flag')
CatalogSelect.propTypes = {
  kind: (props, key) => ['brands', 'groups'].includes(props[key]) ? null : new Error('Invalid catalog selector kind'),
  label: textProp, value: textProp, catalogId: textProp, emptyLabel: textProp, disabled: booleanProp, required: booleanProp,
  onChange: (props, key) => typeof props[key] === 'function' ? null : new Error('Catalog selector requires onChange'),
}
