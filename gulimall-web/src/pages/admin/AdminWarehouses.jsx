import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { warehouses, getWarehouseInfo, saveWarehouse, updateWarehouse, findWarehouseCreation } from '../../api/admin'
import { formSignature } from '../../utils/form'
import { parseCreationReference, creationFingerprint } from '../../utils/creation'
import { useAuthStore } from '../../store/authStore'
const empty = () => ({ name: '', address: '', areacode: '' })
const editable = Object.keys(empty())
export default function AdminWarehouses({ onChanged, onStatus, protect, page, query, onQuery }) {
  const username = useAuthStore(s => s.user?.username), storageKey = 'gulimall-warehouse-creation:' + username
  const [initial] = useState(() => { try { return { reference: parseCreationReference(sessionStorage.getItem(storageKey)) } } catch { return { reference: null, error: '原创建请求记录无法读取，请先核对服务端结果后明确结束本次记录。' } } })
  const [pending, setPending] = useState(initial.reference), pendingRef = useRef(initial.reference), snapshot = useRef(null)
  const [storageError, setStorageError] = useState(initial.error || ''), [creationResult, setCreationResult] = useState(null), [creationChecking, setCreationChecking] = useState(false), readingCreation = useRef(false), restored = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [key, setKey] = useState(query), [reload, setReload] = useState(0)
  const [result, setResult] = useState(null), [form, setForm] = useState(empty), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [unknown, setUnknown] = useState(!!initial.reference), working = useRef(false)
  const [confirmed, setConfirmed] = useState(null), [checking, setChecking] = useState(null), locating = useRef(null), keepForm = useRef(false)
  const baseline = useRef(formSignature(empty(), Object.keys(empty())))
  const replaceForm = next => { baseline.current = formSignature(next, Object.keys(empty())); setForm(next) }
  const dirty = formSignature(form, editable) !== baseline.current || unknown || !!pending || !!storageError
  const locked = busy || unknown || !!pending || !!storageError
  const frozen = busy || !!storageError || !!pending && (!!snapshot.current || creationResult?.found !== false) || unknown && !pending
  const latestProtected = useRef(dirty || busy || key !== query); latestProtected.current = dirty || busy || key !== query
  const queryCallback = useRef(onQuery); queryCallback.current = onQuery
  useEffect(() => { setKey(query) }, [query])
  useEffect(() => { if (!unknown && !pending && !storageError && !keepForm.current) replaceForm(empty()); keepForm.current = false }, [page, query, unknown, pending, storageError])
  useLayoutEffect(() => { onStatus({ dirty, busy, unknown: unknown || !!pending || !!storageError }) }, [dirty, busy, unknown, pending, storageError, onStatus])
  useLayoutEffect(() => () => onStatus({ dirty: false, busy: false }), [onStatus])
  useEffect(() => {
    let active = true
    setLoading(true); setResult(null); setError('')
    warehouses({ page, limit: 10, key: query }).then(res => { if (active) {
      const last = Math.max(1, res.page.totalPage), locateLast = locating.current && !query
      locating.current = null
      if ((page > last || locateLast && page !== last) && !latestProtected.current) { keepForm.current = true; queryCallback.current({ page: String(last) }, true) }
      else setResult(res.page)
    } }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, query, reload])
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
      const found = await findWarehouseCreation(reference.requestId)
      if (!alive.current || pendingRef.current !== reference) return
      if (typeof found.found !== 'boolean' || found.found && (!Number.isSafeInteger(found.id) || found.id < 1 || typeof found.deleted !== 'boolean')) throw new Error('原仓库查询结果不完整，请保留请求并重试查询。')
      setCreationResult(found)
      if (found.found && !found.deleted) {
        setConfirmed({ id: found.id }); setNotice('原仓库创建已确认，查询条件保持；请查看原编号后编辑，不会再次新增。')
        keepForm.current = true; clearReference(); replaceForm(empty()); setReload(v => v + 1); onChanged()
      } else if (!found.found) {
        setNotice(snapshot.current ? '原请求尚未查到，可重试同一请求；不会更换请求号。' : '原请求尚未查到，请重新输入原内容；匹配本地指纹后才可同号重试。')
        if (!snapshot.current) setUnknown(false)
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
      const payload = snapshot.current || Object.fromEntries(editable.map(key => [key, form[key] ?? '']))
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
      const response = await saveWarehouse({ ...payload, creationRequestId: reference.requestId })
      if (!alive.current) return
      if (!Number.isSafeInteger(response.id) || response.id < 1) throw new Error('未取得仓库编号，请查询原创建结果，勿重新新增。')
      setConfirmed({ id: response.id }); locating.current = response.id; keepForm.current = true
      setNotice('仓库资料已保存，采购和库存引用保持不变。'); clearReference(); replaceForm({ ...payload, id: response.id }); setReload(v => v + 1); onChanged()
    } catch (e) {
      if (!alive.current) return
      if (sent && e.status === 400) { keepForm.current = true; clearReference() }
      else if (sent) setUnknown(true)
      const reason = !sent && ['QuotaExceededError', 'SecurityError'].includes(e.name) ? '无法记录原请求，本次未发送；请恢复浏览器存储后重试。' : e.message
      setError(`${sent && e.status !== 400 ? '新增结果未知。' : ''}${reason}${sent && e.status !== 400 ? ' 请查询原创建结果，或重试原请求；原请求号保持不变。' : ''}`)
    } finally { working.current = false; setBusy(false) }
  }
  const save = async event => {
    event.preventDefault()
    if (!form.id) { create(); return }
    if (working.current || locked) return
    working.current = true; setBusy(true); setError(''); setNotice(''); setConfirmed(null)
    try {
      await updateWarehouse(form); const id = form.id
      setConfirmed({ id }); locating.current = null
      setNotice('仓库资料已保存，采购和库存引用保持不变。'); replaceForm({ ...form, id }); setReload(v => v + 1); onChanged()
    } catch (e) {
      setError(e.message)
    } finally { working.current = false; setBusy(false) }
  }
  const inspect = async () => {
    const target = { ...confirmed, error: '' }, id = target.id
    if (checking === id) return
    setChecking(id); setConfirmed(target)
    try { const response = await getWarehouseInfo(id); setConfirmed(current => current === target ? { id, warehouse: response.wareInfo } : current) }
    catch (e) { setConfirmed(current => current === target ? { ...current, error: e.message } : current) }
    finally { setChecking(current => current === id ? null : current) }
  }
  return <section><h3>仓库维护</h3><p className="admin-note">只维护仓库资料，不删除仓库或直接改动库存。</p>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); onQuery({ page: '1', key: key.trim() }); setReload(v => v + 1) }}><label>查询仓库名称或编号<input className="input" maxLength={100} value={key} onChange={e => setKey(e.target.value)} /></label><button className="btn btn-outline" disabled={busy}>查询仓库</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => setReload(v => v + 1)}>刷新仓库列表</button></form>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {(pending || storageError) && <section className="card" aria-label="仓库原创建请求"><p role="status">原创建请求仍需核对；本标签页仅按管理员保存请求号和指纹，不保存表单正文。</p>{storageError && <p className="error-msg" role="alert">{storageError}</p>}<div className="admin-actions">{pending && <button type="button" className="btn btn-outline" disabled={busy || creationChecking} onClick={checkCreation}>{creationChecking ? '正在查询原结果…' : '查询原创建结果'}</button>}{pending && snapshot.current && !creationResult?.deleted && <button type="button" className="btn btn-outline" disabled={busy || creationChecking || !!storageError} onClick={create}>重试原请求</button>}<button type="button" className="btn btn-outline" disabled={busy || creationChecking} onClick={() => { if (clearReference()) { keepForm.current = true; replaceForm(empty()); setError(''); setNotice('本地创建记录已结束；这不会删除服务端仓库，请核对后再开始新操作。') } }}>已核对，放弃本次仓库表单</button></div></section>}
    {confirmed && <section className="card" aria-label="已确认仓库结果"><p role="status">仓库 #{confirmed.id} 的保存已确认。刷新失败时仍保留原编号，继续保存只更新此仓库。</p>{!loading && result && !result.list.some(item => item.id === confirmed.id) && <p>当前筛选或页码未显示该仓库，未自动清除查询条件。</p>}<div className="admin-actions"><button className="btn btn-outline" disabled={busy || checking === confirmed.id} onClick={inspect}>查看已保存仓库 {confirmed.id}</button><button className="btn btn-outline" disabled={busy} onClick={() => onQuery({ page: '1', key: String(confirmed.id) })}>按编号查询仓库 {confirmed.id}（替换筛选）</button></div>{confirmed.error && <p className="error-msg" role="alert">{confirmed.error}</p>}{confirmed.warehouse && <><p>{confirmed.warehouse.name} · {confirmed.warehouse.address} · {confirmed.warehouse.areacode}</p><button className="btn btn-outline" disabled={locked} onClick={() => protect(() => replaceForm({ ...confirmed.warehouse }))}>编辑已保存仓库 {confirmed.id}</button></>}</section>}
    <form className="admin-form" onSubmit={save}><fieldset disabled={frozen}><legend>{form.id ? `编辑仓库 #${form.id}` : '新增仓库'}</legend><div className="admin-form-grid">{Object.entries({ name: '仓库名称', address: '仓库地址', areacode: '区域编码' }).map(([field,label]) => <label key={field}>{label}<input className="input" required={field !== 'areacode'} maxLength={field === 'address' ? 255 : field === 'name' ? 100 : 20} value={form[field] || ''} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}</div><div className="admin-actions"><button className="btn btn-primary">{busy ? '正在保存…' : pending && !snapshot.current ? '重试原请求' : '保存仓库'}</button><button type="button" className="btn btn-outline" disabled={!!pending} onClick={() => protect(() => replaceForm(empty()))}>取消仓库编辑</button></div></fieldset></form>
    {unknown && !pending && <button className="btn btn-outline" onClick={() => { setUnknown(false); replaceForm(empty()); setError('') }}>已核对，放弃本次仓库表单</button>}
    {loading ? <p role="status">正在查询仓库…</p> : result && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>编号</th><th>名称</th><th>地址</th><th>区域编码</th><th>操作</th></tr></thead><tbody>{result.list.map(warehouse => <tr key={warehouse.id}><td>{warehouse.id}</td><td>{warehouse.name}</td><td>{warehouse.address}</td><td>{warehouse.areacode}</td><td><button className="btn btn-outline" disabled={locked} onClick={() => protect(() => { replaceForm({ ...warehouse }); setError(''); setNotice('') })}>编辑仓库 {warehouse.id}</button></td></tr>)}{!result.list.length && <tr><td colSpan={5}>暂无匹配仓库。</td></tr>}</tbody></table></div>}
    {result && <div className="pagination"><button disabled={busy || loading || page <= 1} onClick={() => onQuery({ page: String(page - 1) })}>上一页</button><span>第 {page} / {Math.max(1,result.totalPage)} 页</span><button disabled={busy || loading || page >= result.totalPage} onClick={() => onQuery({ page: String(page + 1) })}>下一页</button></div>}
  </section>
}
AdminWarehouses.propTypes = { page: props => Number.isInteger(props.page) && props.page > 0 ? null : new Error('Warehouse query page required.'), query: props => typeof props.query === 'string' ? null : new Error('Warehouse query required.'), onQuery: props => typeof props.onQuery === 'function' ? null : new Error('Warehouse navigation callback required.'), onStatus: props => typeof props.onStatus === 'function' ? null : new Error('Warehouse dirty status callback required.'), protect: props => typeof props.protect === 'function' ? null : new Error('Warehouse input guard required.'), onChanged: props => typeof props.onChanged === 'function' ? null : new Error('Warehouse updates need a refresh callback.') }
