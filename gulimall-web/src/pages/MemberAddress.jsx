import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useUnsavedForm from '../hooks/useUnsavedForm'
import { formSignature } from '../utils/form'
import { getAddressList, getAddressInfo, saveAddress, updateAddress, deleteAddress, setDefaultAddress, findAddressCreation } from '../api/member'
import { consumerQuery } from '../utils/consumer'
import { useAuthStore } from '../store/authStore'
import { parseCreationReference, creationFingerprint } from '../utils/creation'
const empty = () => ({ name: '', phone: '', province: '', city: '', region: '', detailAddress: '', defaultStatus: 0 })
const fields = { name: '收件人', phone: '手机号', province: '省份', city: '城市', region: '区县', detailAddress: '详细地址' }
const editable = Object.keys(empty())
export default function MemberAddress() {
  const owner = useAuthStore(s => s.user?.id), storageKey = 'gulimall-address-creation:' + owner
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [initial] = useState(() => { try { return { reference: parseCreationReference(sessionStorage.getItem(storageKey)) } } catch { return { reference: null, error: '原创建请求记录无法读取，请先核对服务端结果后明确结束本次记录。' } } })
  const [pending, setPending] = useState(initial.reference), pendingRef = useRef(initial.reference), snapshot = useRef(null)
  const [storageError, setStorageError] = useState(initial.error || ''), [creationResult, setCreationResult] = useState(null), [creationChecking, setCreationChecking] = useState(false), readingCreation = useRef(false), restored = useRef(false)
  const [params, setParams] = useSearchParams(), query = params.toString()
  const parsed = useMemo(() => { try { return { page: Number(consumerQuery('address', query).page), error: '' } } catch (e) { return { page: 1, error: e.message } } }, [query]), page = parsed.page
  const [result, setResult] = useState(null), [reload, setReload] = useState(0), [confirmed, setConfirmed] = useState(null), [checking, setChecking] = useState(null)
  const [loading, setLoading] = useState(true), [form, setForm] = useState(initial.reference ? empty : null), [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false), working = useRef(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [unknown, setUnknown] = useState(!!initial.reference)
  const baseline = useRef(formSignature(empty(), Object.keys(empty())))
  const replaceForm = next => { baseline.current = formSignature(next, Object.keys(empty())); setForm(next) }
  const dirty = !!form && formSignature(form, editable) !== baseline.current || unknown || !!pending || !!storageError, latestProtected = useRef(dirty || busy); latestProtected.current = dirty || busy
  const guard = useUnsavedForm(dirty, busy), commit = guard.commit
  const locked = busy || unknown || !!pending || !!storageError
  const frozen = busy || !!storageError || !!pending && (!!snapshot.current || creationResult?.found !== false) || unknown && !pending
  useEffect(() => {
    if (!unknown && !pending && !storageError) replaceForm(null)
    setPendingDelete(null)
    // Only a confirmed URL transition discards a normal draft; unknown input remains frozen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  useEffect(() => {
    let active = true, redirecting = false
    setLoading(true); setError(''); setResult(null)
    if (parsed.error) { setLoading(false); return }
    getAddressList({ page, limit: 10 }, owner).then(res => {
      if (!active) return
      if (page > Math.max(1, res.page.totalPage) && !latestProtected.current) { redirecting = true; commit(() => setParams({ page: String(Math.max(1, res.page.totalPage)) }, { replace: true })); return }
      setResult(res)
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active && !redirecting) setLoading(false) })
    return () => { active = false }
  }, [page, reload, parsed.error, commit, setParams, owner])
  const clearReference = () => {
    try {
      sessionStorage.removeItem(storageKey); pendingRef.current = null; snapshot.current = null
      setPending(null); setStorageError(''); setUnknown(false); setCreationResult(null); return true
    } catch { setStorageError('原请求结果已保留，但浏览器记录无法清除；请恢复存储后查询或明确结束，勿另建请求。'); return false }
  }
  const checkCreation = async () => {
    const reference = pendingRef.current
    if (!reference || working.current || readingCreation.current) return
    readingCreation.current = true; setCreationChecking(true); setError(''); setNotice(''); setCreationResult(current => current?.deleted ? current : null)
    try {
      const found = await findAddressCreation(reference.requestId, owner)
      if (!alive.current || pendingRef.current !== reference) return
      if (typeof found.found !== 'boolean' || found.found && (!Number.isSafeInteger(found.id) || found.id < 1 || typeof found.deleted !== 'boolean')) throw new Error('原地址查询结果不完整，请保留请求并重试查询。')
      setCreationResult(found)
      if (found.found && !found.deleted) {
        setConfirmed({ id: found.id }); setNotice('原地址创建已确认，不会再次新增；后续请查看原编号再编辑。'); replaceForm(null)
        clearReference(); setReload(v => v + 1)
      } else if (found.deleted) {
        replaceForm(null)
      } else if (!found.found) {
        setNotice(snapshot.current ? '原请求尚未查到，可重试同一请求；不会更换请求号。' : '原请求尚未查到，请重新输入原内容；匹配本地指纹后才可同号重试。')
        if (!snapshot.current) { setForm(current => current || empty()); setUnknown(false) }
      }
    } catch (e) { setError(e.message) }
    finally { readingCreation.current = false; setCreationChecking(false) }
  }
  useEffect(() => {
    if (initial.reference && !restored.current) { restored.current = true; checkCreation() }
    // Restore performs one read; every write or later retry remains explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])
  const create = async () => {
    if (working.current || readingCreation.current || storageError || creationResult?.deleted) return
    working.current = true; setBusy(true); setError(''); setNotice(''); setConfirmed(null)
    let sent = false
    try {
      const payload = snapshot.current || Object.fromEntries(editable.map(key => [key, form?.[key] ?? empty()[key]]))
      const fingerprint = await creationFingerprint(payload, editable)
      if (!alive.current) return
      let reference = pendingRef.current
      if (reference && fingerprint !== reference.fingerprint) throw new Error('重新输入的内容与原请求指纹不一致，尚未发送；请核对原内容或明确结束本次记录。')
      if (reference && !snapshot.current && creationResult?.found !== false) throw new Error('请先查询原创建结果，再决定是否同号重试。')
      if (!reference) {
        reference = parseCreationReference(JSON.stringify({ requestId: crypto.randomUUID(), fingerprint }))
        sessionStorage.setItem(storageKey, JSON.stringify(reference)); pendingRef.current = reference; setPending(reference)
      }
      snapshot.current = payload; setCreationResult(null); sent = true
      const response = await saveAddress({ ...payload, creationRequestId: reference.requestId }, owner)
      if (!alive.current) return
      if (!Number.isSafeInteger(response.id) || response.id < 1) throw new Error('未取得地址编号，请查询原创建结果，勿重新新增。')
      setConfirmed({ id: response.id }); setNotice('收货地址已保存。'); replaceForm(null); setPendingDelete(null); setUnknown(false)
      clearReference(); commit(() => setParams({ page: '1' }, { replace: true })); setReload(v => v + 1)
    } catch (e) {
      if (!alive.current) return
      if (sent && e.status === 400) clearReference()
      else if (sent) setUnknown(true)
      const reason = !sent && ['QuotaExceededError', 'SecurityError'].includes(e.name) ? '无法记录原请求，本次未发送；请恢复浏览器存储后重试。' : e.message
      setError(`${sent && e.status !== 400 ? '新增结果尚未确认。' : ''}${reason}${sent && e.status !== 400 ? ' 请查询原创建结果，或重试原请求；原请求号保持不变。' : ''}`)
    } finally { working.current = false; setBusy(false) }
  }
  const perform = async (action, message, id = null, firstPage = false) => {
    if (working.current) return
    working.current = true; setBusy(true); setError(''); setNotice(''); setConfirmed(null)
    try {
      const response = await action(); setNotice(message); replaceForm(null); setPendingDelete(null); setUnknown(false)
      if (response.id || id) setConfirmed({ id: response.id || id })
      if (firstPage) commit(() => setParams({ page: '1' }, { replace: true }))
      setReload(v => v + 1)
    } catch (e) {
      setError(e.message)
    } finally { working.current = false; setBusy(false) }
  }
  const save = e => {
    e.preventDefault()
    if (!form) return
    if (form.id) { if (!locked) perform(() => updateAddress(form, owner), '收货地址已保存。', form.id, form.defaultStatus === 1) }
    else create()
  }
  const inspect = async () => {
    const target = { ...confirmed, error: '' }, id = target.id
    if (checking === id) return
    setChecking(id); setConfirmed(target)
    try { const response = await getAddressInfo(id, owner); setConfirmed(current => current === target ? { id, address: response.memberReceiveAddress } : current) }
    catch (e) { setConfirmed(current => current === target ? { ...current, error: e.message } : current) }
    finally { setChecking(current => current === id ? null : current) }
  }
  return <div className="container catalog-page">
    {guard.dialog}<div className="admin-toolbar"><h1 className="page-title">收货地址</h1><button className="btn btn-primary" disabled={locked} onClick={() => guard.request(() => { replaceForm(form ? null : empty()); setError('') })}>{form ? '取消' : '新增地址'}</button><button className="btn btn-outline" disabled={busy || loading} onClick={() => setReload(v => v + 1)}>刷新地址</button></div>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {parsed.error && <p className="error-msg" role="alert">{parsed.error}<button className="btn btn-outline" onClick={() => guard.request(() => setParams({}))}>清除无效地址查询</button></p>}
    {(pending || storageError) && <section className="card" aria-label="地址原创建请求"><p role="status">{creationResult?.deleted ? `原地址 #${creationResult.id} 已删除，旧请求不能复活地址。` : '原创建请求仍需核对；仅在本标签页按会员保存请求号和指纹，不保存地址正文。'}</p>{storageError && <p className="error-msg" role="alert">{storageError}</p>}<div className="admin-actions">{pending && <button type="button" className="btn btn-outline" disabled={busy || creationChecking} onClick={checkCreation}>{creationChecking ? '正在查询原结果…' : '查询原创建结果'}</button>}{pending && snapshot.current && !creationResult?.deleted && <button type="button" className="btn btn-outline" disabled={busy || creationChecking || !!storageError} onClick={create}>重试原请求</button>}<button type="button" className="btn btn-outline" disabled={busy || creationChecking} onClick={() => { if (clearReference()) { replaceForm(null); setError(''); setNotice('本地创建记录已结束；这不会删除服务端地址，请核对后再开始新操作。') } }}>已核对，放弃本次表单</button></div></section>}
    {confirmed && <section className="card" aria-label="已确认地址结果"><p role="status">地址 #{confirmed.id} 的保存已确认。列表读取失败也不会重新创建。</p><button className="btn btn-outline" disabled={checking === confirmed.id || busy} onClick={inspect}>查看已保存地址 {confirmed.id}</button>{confirmed.error && <p className="error-msg" role="alert">{confirmed.error}</p>}{confirmed.address && <><p>{confirmed.address.name} · {confirmed.address.phone} · {confirmed.address.detailAddress}</p><button className="btn btn-outline" disabled={locked} onClick={() => guard.request(() => replaceForm({ ...confirmed.address }))}>编辑已保存地址 {confirmed.id}</button></>}</section>}
    {result?.multipleDefaults && <p className="error-msg" role="alert">检测到多个默认地址，请设置正确的默认地址；下一次地址修改将按规则整理，其他地址不会删除。</p>}
    {form && <form className="address-form" onSubmit={save}><fieldset disabled={frozen}><legend>{form.id ? '编辑收货地址' : '新增收货地址'}</legend>
      {Object.entries(fields).map(([key, label]) => <div className="form-group" key={key}><label htmlFor={`address-${key}`}>{label}</label><input id={`address-${key}`} required className="input" type={key === 'phone' ? 'tel' : 'text'} maxLength={key === 'detailAddress' ? 255 : key === 'phone' ? 32 : 100} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
      <label><input type="checkbox" checked={form.defaultStatus === 1} onChange={e => setForm({ ...form, defaultStatus: e.target.checked ? 1 : 0 })} />设为默认地址</label>
      <div className="admin-actions"><button className="btn btn-primary">{busy ? '正在保存…' : pending && !snapshot.current ? '重试原请求' : '保存'}</button><button type="button" className="btn btn-outline" disabled={!!pending} onClick={() => guard.request(() => replaceForm(null))}>取消编辑</button></div>
    </fieldset>{unknown && !pending && <p role="status">旧无标识请求仍须人工核对。<button type="button" className="btn btn-outline" onClick={() => { replaceForm(null); setUnknown(false); setError('') }}>已核对，放弃本次表单</button></p>}</form>}
    {pendingDelete && <div className="admin-confirm" role="alert"><p>确认删除此收货地址？已有订单的地址快照不受影响。</p><div className="admin-actions"><button className="btn btn-primary" disabled={busy} onClick={() => guard.request(() => perform(() => deleteAddress([pendingDelete], owner), '地址已删除。'))}>确认删除地址</button><button className="btn btn-outline" disabled={busy} onClick={() => setPendingDelete(null)}>取消删除</button></div></div>}
    {loading ? <p role="status">正在加载地址…</p> : result?.page.list.length ? <div className="address-list">{result.page.list.map(address => <div className="address-item" key={address.id}><div><strong>{address.name}</strong> {address.phone} {address.defaultStatus === 1 && <span>［默认地址］</span>}<p>{address.province}{address.city}{address.region} {address.detailAddress}</p></div><div className="admin-actions">
      <button className="btn btn-outline" disabled={locked} onClick={() => guard.request(() => { replaceForm({ ...address }); setError(''); setNotice('') })}>编辑地址 {address.id}</button>
      {address.defaultStatus !== 1 && <button className="btn btn-outline" disabled={locked} onClick={() => guard.request(() => perform(() => setDefaultAddress(address.id, owner), '默认地址已更新。', address.id, true))}>设为默认地址 {address.id}</button>}
      <button className="btn btn-outline" disabled={locked} onClick={() => setPendingDelete(address.id)}>删除地址 {address.id}</button>
    </div></div>)}</div> : result && !parsed.error && <p className="empty-state">{result.page.totalCount ? '当前页已越界，未保存输入仍保留；可放弃输入后刷新地址。' : '暂无收货地址'}</p>}
    {result && <div className="pagination"><button disabled={busy || loading || page <= 1} onClick={() => setParams({ page: String(page - 1) })}>上一页</button><span>第 {page} / {Math.max(1, result.page.totalPage)} 页</span><button disabled={busy || loading || page >= result.page.totalPage} onClick={() => setParams({ page: String(page + 1) })}>下一页</button></div>}
  </div>
}
