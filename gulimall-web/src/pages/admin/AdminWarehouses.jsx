import { useEffect, useRef, useState } from 'react'
import { warehouses, saveWarehouse, updateWarehouse } from '../../api/admin'
import { formSignature } from '../../utils/form'
const empty = () => ({ name: '', address: '', areacode: '' })
export default function AdminWarehouses({ onChanged, onStatus, protect, page, query, onQuery }) {
  const [key, setKey] = useState(query), [reload, setReload] = useState(0)
  const [result, setResult] = useState(null), [form, setForm] = useState(empty), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [unknown, setUnknown] = useState(false), working = useRef(false)
  const baseline = useRef(formSignature(empty(), Object.keys(empty())))
  const replaceForm = next => { baseline.current = formSignature(next, Object.keys(empty())); setForm(next) }
  const dirty = formSignature(form, Object.keys(empty())) !== baseline.current || unknown
  const latestDirty = useRef(dirty); latestDirty.current = dirty
  const queryCallback = useRef(onQuery); queryCallback.current = onQuery
  useEffect(() => { setKey(query); if (!unknown) replaceForm(empty()) }, [page, query, unknown])
  useEffect(() => { onStatus({ dirty, busy, unknown }) }, [dirty, busy, unknown, onStatus])
  useEffect(() => () => onStatus({ dirty: false, busy: false }), [onStatus])
  useEffect(() => {
    let active = true
    setLoading(true); setResult(null); setError('')
    warehouses({ page, limit: 10, key: query }).then(res => { if (active) { const last = Math.max(1, res.page.totalPage); if (page > last && !latestDirty.current) queryCallback.current({ page: String(last) }, true); else setResult(res.page) } }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, query, reload])
  const save = async event => {
    event.preventDefault()
    if (working.current || unknown) return
    working.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await (form.id ? updateWarehouse(form) : saveWarehouse(form)); setNotice('仓库资料已保存，采购和库存引用保持不变。'); replaceForm(empty()); setReload(v => v + 1); onChanged()
    } catch (e) {
      const uncertain = !form.id && (!e.status || e.status >= 500)
      setUnknown(uncertain); setError(`${e.message}${uncertain ? ' 新增结果未知，请先刷新列表核对，勿重复创建。' : ''}`)
    } finally { working.current = false; setBusy(false) }
  }
  return <section><h3>仓库维护</h3><p className="admin-note">只维护仓库资料，不删除仓库或直接改动库存。</p>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); onQuery({ page: '1', key: key.trim() }); setReload(v => v + 1) }}><label>查询仓库名称或编号<input className="input" maxLength={100} value={key} onChange={e => setKey(e.target.value)} /></label><button className="btn btn-outline" disabled={busy}>查询仓库</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReload(v => v + 1)}>刷新仓库列表</button></form>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="admin-form" onSubmit={save}><fieldset disabled={busy || unknown}><legend>{form.id ? `编辑仓库 #${form.id}` : '新增仓库'}</legend><div className="admin-form-grid">{Object.entries({ name: '仓库名称', address: '仓库地址', areacode: '区域编码' }).map(([field,label]) => <label key={field}>{label}<input className="input" required={field !== 'areacode'} maxLength={field === 'address' ? 255 : field === 'name' ? 100 : 20} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}</div><div className="admin-actions"><button className="btn btn-primary">{busy ? '正在保存…' : '保存仓库'}</button><button type="button" className="btn btn-outline" onClick={() => protect(() => replaceForm(empty()))}>取消仓库编辑</button></div></fieldset></form>
    {unknown && <button className="btn btn-outline" onClick={() => { setUnknown(false); replaceForm(empty()); setError('') }}>已核对，放弃本次仓库表单</button>}
    {loading ? <p role="status">正在查询仓库…</p> : result && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>编号</th><th>名称</th><th>地址</th><th>区域编码</th><th>操作</th></tr></thead><tbody>{result.list.map(warehouse => <tr key={warehouse.id}><td>{warehouse.id}</td><td>{warehouse.name}</td><td>{warehouse.address}</td><td>{warehouse.areacode}</td><td><button className="btn btn-outline" disabled={busy || unknown} onClick={() => protect(() => { replaceForm({ ...warehouse }); setError(''); setNotice('') })}>编辑仓库 {warehouse.id}</button></td></tr>)}{!result.list.length && <tr><td colSpan={5}>暂无匹配仓库。</td></tr>}</tbody></table></div>}
    {result && <div className="pagination"><button disabled={busy || loading || page <= 1} onClick={() => onQuery({ page: String(page - 1) })}>上一页</button><span>第 {page} / {Math.max(1,result.totalPage)} 页</span><button disabled={busy || loading || page >= result.totalPage} onClick={() => onQuery({ page: String(page + 1) })}>下一页</button></div>}
  </section>
}
AdminWarehouses.propTypes = { page: props => Number.isInteger(props.page) && props.page > 0 ? null : new Error('Warehouse query page required.'), query: props => typeof props.query === 'string' ? null : new Error('Warehouse query required.'), onQuery: props => typeof props.onQuery === 'function' ? null : new Error('Warehouse navigation callback required.'), onStatus: props => typeof props.onStatus === 'function' ? null : new Error('Warehouse dirty status callback required.'), protect: props => typeof props.protect === 'function' ? null : new Error('Warehouse input guard required.'), onChanged: props => typeof props.onChanged === 'function' ? null : new Error('Warehouse updates need a refresh callback.') }
