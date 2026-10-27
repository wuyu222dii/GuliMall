import { useEffect, useRef, useState } from 'react'
import useUnsavedForm from '../hooks/useUnsavedForm'
import { formSignature } from '../utils/form'
import { getAddressList, saveAddress, updateAddress, deleteAddress, setDefaultAddress } from '../api/member'
const empty = () => ({ name: '', phone: '', province: '', city: '', region: '', detailAddress: '', defaultStatus: 0 })
const fields = { name: '收件人', phone: '手机号', province: '省份', city: '城市', region: '区县', detailAddress: '详细地址' }
export default function MemberAddress() {
  const [result, setResult] = useState(null), [page, setPage] = useState(1), [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true), [form, setForm] = useState(null), [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false), working = useRef(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [unknown, setUnknown] = useState(false)
  const baseline = useRef(formSignature(empty(), Object.keys(empty())))
  const replaceForm = next => { baseline.current = formSignature(next, Object.keys(empty())); setForm(next) }
  const guard = useUnsavedForm(!!form && formSignature(form, Object.keys(empty())) !== baseline.current || unknown, busy)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setResult(null)
    getAddressList({ page, limit: 10 }).then(res => {
      if (!active) return
      if (page > Math.max(1, res.page.totalPage)) { setPage(Math.max(1, res.page.totalPage)); return }
      setResult(res)
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, reload])
  const perform = async (action, message, creating = false) => {
    if (working.current) return
    working.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await action(); setNotice(message); replaceForm(null); setPendingDelete(null); setUnknown(false); setReload(v => v + 1)
    } catch (e) {
      const uncertain = creating && (!e.status || e.status >= 500)
      setUnknown(uncertain)
      setError(uncertain ? `${e.message} 新增结果尚未确认，请先刷新地址核对，勿重复创建。` : e.message)
    } finally { working.current = false; setBusy(false) }
  }
  const save = e => {
    e.preventDefault()
    if (unknown) return
    perform(() => form.id ? updateAddress(form) : saveAddress(form), '收货地址已保存。', !form.id)
  }
  return <div className="container catalog-page">
    {guard.dialog}<div className="admin-toolbar"><h1 className="page-title">收货地址</h1><button className="btn btn-primary" disabled={busy || unknown} onClick={() => guard.request(() => { replaceForm(form ? null : empty()); setError('') })}>{form ? '取消' : '新增地址'}</button><button className="btn btn-outline" disabled={busy || loading} onClick={() => setReload(v => v + 1)}>刷新地址</button></div>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {result?.multipleDefaults && <p className="error-msg" role="alert">检测到多个默认地址，请设置正确的默认地址；下一次地址修改将按规则整理，其他地址不会删除。</p>}
    {form && <form className="address-form" onSubmit={save}><fieldset disabled={busy}><legend>{form.id ? '编辑收货地址' : '新增收货地址'}</legend>
      {Object.entries(fields).map(([key, label]) => <div className="form-group" key={key}><label htmlFor={`address-${key}`}>{label}</label><input id={`address-${key}`} required className="input" type={key === 'phone' ? 'tel' : 'text'} maxLength={key === 'detailAddress' ? 255 : key === 'phone' ? 32 : 100} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
      <label><input type="checkbox" checked={form.defaultStatus === 1} onChange={e => setForm({ ...form, defaultStatus: e.target.checked ? 1 : 0 })} />设为默认地址</label>
      <div className="admin-actions"><button className="btn btn-primary" disabled={unknown}>{busy ? '正在保存…' : '保存'}</button><button type="button" className="btn btn-outline" disabled={unknown} onClick={() => guard.request(() => replaceForm(null))}>取消编辑</button></div>
      {unknown && <p role="status">请刷新列表核对是否已创建。核对后可放弃此表单；这不会删除服务端地址。<button type="button" className="btn btn-outline" onClick={() => { replaceForm(null); setUnknown(false); setError('') }}>已核对，放弃本次表单</button></p>}
    </fieldset></form>}
    {pendingDelete && <div className="admin-confirm" role="alert"><p>确认删除此收货地址？已有订单的地址快照不受影响。</p><div className="admin-actions"><button className="btn btn-primary" disabled={busy} onClick={() => guard.request(() => perform(() => deleteAddress([pendingDelete]), '地址已删除。'))}>确认删除地址</button><button className="btn btn-outline" disabled={busy} onClick={() => setPendingDelete(null)}>取消删除</button></div></div>}
    {loading ? <p role="status">正在加载地址…</p> : result?.page.list.length ? <div className="address-list">{result.page.list.map(address => <div className="address-item" key={address.id}><div><strong>{address.name}</strong> {address.phone} {address.defaultStatus === 1 && <span>［默认地址］</span>}<p>{address.province}{address.city}{address.region} {address.detailAddress}</p></div><div className="admin-actions">
      <button className="btn btn-outline" disabled={busy || unknown} onClick={() => guard.request(() => { replaceForm({ ...address }); setError(''); setNotice('') })}>编辑地址 {address.id}</button>
      {address.defaultStatus !== 1 && <button className="btn btn-outline" disabled={busy || unknown} onClick={() => guard.request(() => perform(() => setDefaultAddress(address.id), '默认地址已更新。'))}>设为默认地址 {address.id}</button>}
      <button className="btn btn-outline" disabled={busy || unknown} onClick={() => setPendingDelete(address.id)}>删除地址 {address.id}</button>
    </div></div>)}</div> : result && <p className="empty-state">暂无收货地址</p>}
    {result && <div className="pagination"><button disabled={busy || loading || page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(1, result.page.totalPage)} 页</span><button disabled={busy || loading || page >= result.page.totalPage} onClick={() => setPage(page + 1)}>下一页</button></div>}
  </div>
}
