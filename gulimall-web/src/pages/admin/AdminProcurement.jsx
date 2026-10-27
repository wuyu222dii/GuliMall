import { useEffect, useRef, useState } from 'react'
import * as admin from '../../api/admin'
import { useAuthStore } from '../../store/authStore'
import { parseProcurementRequest, demandMatches, purchaseMatches } from '../../utils/procurement'
import useUnsavedForm from '../../hooks/useUnsavedForm'
import { formSignature } from '../../utils/form'
import AdminWarehouses from './AdminWarehouses'

const statusNames = ['新建', '已分配', '采购中', '已完成', '存在失败']
const demandDraft = () => ({ id: null, skuId: '', wareId: '', skuNum: 1, skuPrice: '0.00' })
const demandSignature = value => formSignature({ ...value, skuPrice: value.skuPrice === '' ? '' : Number(value.skuPrice) }, ['skuId', 'wareId', 'skuNum', 'skuPrice'])
const queryState = () => ({ result: null, loading: false, error: '' })
export default function AdminProcurement() {
  const username = useAuthStore(s => s.user?.username)
  const storageKey = 'gulimall-procurement:' + username
  const [initial] = useState(() => { try { return { pending: parseProcurementRequest(sessionStorage.getItem(storageKey)) } } catch { return { pending: null, storageError: true } } })
  const [pending, setPending] = useState(initial.pending), pendingRef = useRef(initial.pending)
  const [storageError, setStorageError] = useState(!!initial.storageError), [canRetry, setCanRetry] = useState(false), [candidate, setCandidate] = useState(null), [discard, setDiscard] = useState(false)
  const [tab, setTab] = useState(initial.pending && ['receive', 'finish'].includes(initial.pending.type) ? 'purchases' : 'demands')
  const [data, setData] = useState(null), [page, setPage] = useState(1), [filters, setFilters] = useState({ wareId: '', status: '', skuId: '', key: '' }), [keyInput, setKeyInput] = useState('')
  const [form, setForm] = useState(initial.pending?.type === 'save' ? initial.pending.payload : demandDraft)
  const [sku, setSku] = useState(queryState), [skuQuery, setSkuQuery] = useState(''), [skuPage, setSkuPage] = useState(1), [skuReload, setSkuReload] = useState(0)
  const [warehouse, setWarehouse] = useState(queryState), [warehouseInput, setWarehouseInput] = useState(''), [warehouseQuery, setWarehouseQuery] = useState({ key: '' }), [warehousePage, setWarehousePage] = useState(1)
  const [targets, setTargets] = useState(queryState), [targetInput, setTargetInput] = useState(''), [targetKey, setTargetKey] = useState({ key: '' }), [targetPage, setTargetPage] = useState(1)
  const [selected, setSelected] = useState([]), [target, setTarget] = useState('')
  const [activeId, setActiveId] = useState(initial.pending && ['receive', 'finish'].includes(initial.pending.type) ? initial.pending.payload.id : null)
  const [active, setActive] = useState(null), [results, setResults] = useState([]), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null), [loading, setLoading] = useState(true), [listError, setListError] = useState('')
  const [busy, setBusy] = useState(false), working = useRef(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reload, setReload] = useState(0)
  const inWarehouses = tab === 'warehouses', locked = busy || !!pending || storageError
  const baseline = useRef(demandSignature(initial.pending?.type === 'save' ? initial.pending.payload : demandDraft()))
  const replaceForm = next => { baseline.current = demandSignature(next); setForm(next) }
  const [warehouseDraft, setWarehouseDraft] = useState({ dirty: false, busy: false })
  const dirty = demandSignature(form) !== baseline.current
  const guard = useUnsavedForm(dirty || warehouseDraft.dirty || !!pending || storageError, busy || warehouseDraft.busy)
  useEffect(() => {
    let current = true
    if (inWarehouses) return
    setLoading(true); setListError(''); setData(null)
    const params = { page, limit: 20, ...filters }
    const operation = tab === 'demands' ? admin.listDemands(params) : tab === 'purchases' ? admin.listPurchases(params) : admin.listStock({ page, limit: 20, wareId: filters.wareId, skuId: filters.skuId })
    operation.then(res => { if (current) { if (page > Math.max(1, res.page.totalPage)) setPage(Math.max(1, res.page.totalPage)); else setData(res.page) } }).catch(e => { if (current) setListError(e.message) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters, page, reload, tab, inWarehouses])
  useEffect(() => {
    let current = true
    if (inWarehouses) return
    setWarehouse({ result: null, loading: true, error: '' })
    admin.warehouses({ page: warehousePage, limit: 20, key: warehouseQuery.key }).then(res => { if (current) setWarehouse({ result: res.page, loading: false, error: '' }) }).catch(e => { if (current) setWarehouse({ result: null, loading: false, error: e.message }) })
    return () => { current = false }
  }, [warehousePage, warehouseQuery, reload, inWarehouses])
  useEffect(() => {
    let current = true
    if (tab !== 'demands') return
    setSku({ result: null, loading: true, error: '' })
    admin.listSkus({ page: skuPage, limit: 20, keyword: skuQuery }).then(res => { if (current) setSku({ result: res.page, loading: false, error: '' }) }).catch(e => { if (current) setSku({ result: null, loading: false, error: e.message }) })
    return () => { current = false }
  }, [skuQuery, skuPage, skuReload, reload, tab])
  useEffect(() => {
    let current = true
    if (tab !== 'demands') return
    setTargets({ result: null, loading: true, error: '' })
    admin.listUnreceivedPurchases({ page: targetPage, limit: 20, key: targetKey.key, wareId: filters.wareId }).then(res => { if (current) setTargets({ result: res.page, loading: false, error: '' }) }).catch(e => { if (current) setTargets({ result: null, loading: false, error: e.message }) })
    return () => { current = false }
  }, [targetPage, targetKey, filters.wareId, reload, tab])
  useEffect(() => {
    let current = true
    setActive(null); setResults([]); setDetailError(''); setDetailLoading(!!activeId)
    if (activeId) admin.getPurchase(activeId).then(res => { if (current) { setActive(res); const original = pendingRef.current; setResults(original?.type === 'finish' && original.payload.id === activeId ? original.payload.items.map(item => ({ ...item })) : res.items.map(item => ({ itemId: item.id, status: item.status === 4 ? 4 : 3, reason: item.failureReason || '' }))) } }).catch(e => { if (current) setDetailError(e.message) }).finally(() => { if (current) setDetailLoading(false) })
    return () => { current = false }
  }, [activeId, reload])
  const persist = request => {
    try { if (request) sessionStorage.setItem(storageKey, JSON.stringify(request)); else sessionStorage.removeItem(storageKey) }
    catch { setStorageError(true); setError('无法保存本标签页的采购操作记录，暂停写入；请先核对原记录。'); return false }
    pendingRef.current = request; setPending(request); setCanRetry(false); setCandidate(null); setDiscard(false); return true
  }
  const show = id => { setActive(null); setResults([]); setDetailError(''); setDetailLoading(true); setActiveId(id); setReload(value => value + 1) }
  const acknowledge = (request, response = {}) => {
    const p = request.payload
    if (request.type === 'save') { replaceForm({ ...p, id: response.id }); setNotice('采购需求 #' + response.id + ' 已保存；再次保存会修改此需求，新建请使用“新建下一条需求”。') }
    if (request.type === 'delete') { setPendingDelete(null); if (form.id === p.id) replaceForm(demandDraft()); setNotice('需求 #' + p.id + ' 已删除。') }
    if (request.type === 'merge') { if (p.items.includes(form.id)) replaceForm(demandDraft()); setSelected([]); setTarget(''); setPage(1); setTab('purchases'); setFilters(f => ({ ...f, status: '', key: '' })); setKeyInput(''); show(response.purchaseId); setNotice('需求已合并到采购单 #' + response.purchaseId + '，领取后可完成入库。') }
    if (['receive', 'finish'].includes(request.type)) { setTab('purchases'); show(p.id); setNotice(request.type === 'receive' ? '采购单 #' + p.id + ' 领取已确认。' : '采购结果已保存，成功项已入库。') }
    persist(null); setReload(value => value + 1)
  }
  const send = request => {
    const p = request.payload
    if (request.type === 'save') return admin.saveDemand(p)
    if (request.type === 'delete') return admin.deleteDemand(p.id)
    if (request.type === 'merge') return admin.mergeDemands(p)
    if (request.type === 'receive') return admin.receivePurchase(p.id)
    return admin.finishPurchase(p)
  }
  const perform = async (type, payload, retry = false) => {
    if (working.current || storageError || pendingRef.current && !retry) return
    working.current = true; setBusy(true); setError(''); setNotice(''); setCanRetry(false)
    let request
    try {
      request = retry ? pendingRef.current : parseProcurementRequest(JSON.stringify({ type, payload }))
      if (!request || !persist(request)) return
      acknowledge(request, await send(request))
    } catch (e) {
      if (!retry && type === 'save' && e.status >= 400 && e.status < 500) persist(null)
      setError(e.message + (pendingRef.current ? ' 原操作待核对，内容已保留，未自动重发。' : ' 输入已保留。'))
    } finally { working.current = false; setBusy(false) }
  }
  const check = async () => {
    if (working.current || !pendingRef.current) return
    const request = pendingRef.current, p = request.payload
    working.current = true; setBusy(true); setError(''); setCanRetry(false)
    try {
      if (request.type === 'save' && !p.id) {
        setTab('demands'); setFilters({ wareId: String(p.wareId), status: '', skuId: '', key: String(p.skuId) }); setKeyInput(String(p.skuId)); setPage(1); setReload(v => v + 1)
        setNotice('以下只是候选需求，不会按相同字段自动认定成功。请核对编号后明确选择；结果仍有疑问请保留操作记录。'); return
      }
      if (request.type === 'save' || request.type === 'delete') {
        let actual
        try { actual = (await admin.getDemand(p.id)).purchaseDetail } catch (e) { if (e.status === 404 && request.type === 'delete') { acknowledge(request); return } throw e }
        if (request.type === 'save' && demandMatches(actual, p)) { acknowledge(request, { id: p.id }); return }
        if (actual.status !== 0 || actual.purchaseId) throw new Error('此需求已分配，不能覆盖修改或删除，请核对原记录。')
      } else if (request.type === 'merge') {
        const details = await Promise.all(p.items.map(id => admin.getDemand(id).then(r => r.purchaseDetail)))
        const group = details[0].purchaseId
        if (group && details.every(d => d.purchaseId === group) && (!p.purchaseId || p.purchaseId === group)) { await admin.getPurchase(group); acknowledge(request, { purchaseId: group }); return }
        if (!details.every(d => d.status === 0 && !d.purchaseId)) throw new Error('所选需求的归属不一致或已合并到另一目标，请按原编号人工核对。')
      } else {
        const result = await admin.getPurchase(p.id)
        if (request.type === 'receive' && [2, 3, 4].includes(result.purchase.status) || request.type === 'finish' && purchaseMatches(result, p)) { acknowledge(request); return }
        if (request.type === 'finish' && result.purchase.status !== 2 || request.type === 'receive' && ![0, 1].includes(result.purchase.status)) throw new Error('当前采购状态或完成结果与原提交不一致，不能覆盖，请人工核对。')
      }
      setCanRetry(true); setNotice('尚未确认原操作完成。可继续查询，或明确重试下方原请求；不会改变其编号和内容。')
    } catch (e) { setError(e.message + ' 原操作仍保留。') }
    finally { working.current = false; setBusy(false) }
  }
  const inspectCandidate = async id => {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try { const actual = (await admin.getDemand(id)).purchaseDetail; if (!demandMatches(actual, pendingRef.current.payload)) throw new Error('候选内容与原提交不一致，不能认定为本次新增。'); setCandidate(actual) }
    catch (e) { setError(e.message) } finally { working.current = false; setBusy(false) }
  }
  const changeTab = value => guard.request(() => { if (!pendingRef.current) replaceForm(demandDraft()); setTab(value); setPage(1); setSelected([]); setTarget(''); setError(''); setNotice(''); setActiveId(null); setActive(null) })
  const wareOptions = warehouse.result?.list || [], skuOptions = sku.result?.list || [], targetOptions = targets.result?.list || []
  const readyDetail = !detailLoading && active && active.purchase.id === activeId
  const original = pending?.payload
  return <section>{guard.dialog}
    <div className="admin-toolbar"><h2>采购与库存</h2><button className="btn btn-outline" disabled={busy} onClick={() => setReload(v => v + 1)}>刷新数据</button></div>
    <div className="admin-actions" role="group" aria-label="采购页面">{[['demands', '采购需求'], ['purchases', '采购单'], ['stock', '库存'], ['warehouses', '仓库维护']].map(([value, label]) => <button className={'btn ' + (tab === value ? 'btn-primary' : 'btn-outline')} disabled={busy || warehouseDraft.busy} key={value} onClick={() => changeTab(value)}>{label}</button>)}</div>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {(pending || storageError) && <div className="admin-confirm" role="status"><h3>原采购操作待核对</h3>{storageError ? <p>标签页记录无法读取或保存，暂停采购写入。请先查询原需求或采购单，勿清空记录后重复提交。</p> : <>
      <p>操作：{({ save: '保存需求', merge: '合并需求', receive: '领取采购单', finish: '完成入库', delete: '删除需求' })[pending.type]}。刷新本页仍保留；未自动重发。</p>
      {pending.type === 'save' ? <p>需求：{original.id || '新增，编号待核对'}；SKU {original.skuId}；仓库 {original.wareId}；数量 {original.skuNum}；总金额 ¥{original.skuPrice}。</p> : pending.type === 'merge' ? <p>需求编号：{original.items.join('、')}；目标：{original.purchaseId || '新建采购单'}。</p> : <p>{pending.type === 'delete' ? '需求' : '采购单'} #{original.id}{pending.type === 'finish' && '；原结果：' + original.items.map(i => i.itemId + ' ' + (i.status === 3 ? '入库' : '失败：' + i.reason)).join('；')}</p>}
      <button className="btn btn-outline" disabled={busy} onClick={check}>{pending.type === 'save' && !original.id ? '查询候选需求' : '查询原操作结果'}</button>
      {canRetry && <button className="btn btn-outline" disabled={busy} onClick={() => perform(pending.type, pending.payload, true)}>重试原请求</button>}
      {candidate && <div className="admin-confirm"><p>候选需求 #{candidate.id}；SKU {candidate.skuId}；仓库 {candidate.wareId}；数量 {candidate.skuNum}；金额 ¥{candidate.skuPrice}；状态 {statusNames[candidate.status]}。相同内容不代表唯一匹配，请确认此编号确为本次新增。</p><button className="btn btn-primary" disabled={busy} onClick={() => { acknowledge(pending, { id: candidate.id }); replaceForm({ ...candidate }) }}>确认此需求为本次新增</button></div>}
    </>}<button className="btn btn-outline" disabled={busy} onClick={() => setDiscard(true)}>人工核对后结束记录</button>{discard && <div className="admin-confirm"><p>仅结束本标签页核对，不撤销服务器操作，也不会自动新增。原请求仍可能已经保存；有疑问请继续核对。</p><button className="btn btn-outline" disabled={busy} onClick={() => { if (persist(null)) { setStorageError(false); replaceForm(demandDraft()); setNotice('本标签页记录已人工结束，未重发任何写入。') } }}>已人工核对，结束记录</button><button className="btn btn-outline" disabled={busy} onClick={() => setDiscard(false)}>继续保留记录</button></div>}</div>}
    {inWarehouses ? <AdminWarehouses onChanged={() => setReload(v => v + 1)} onStatus={setWarehouseDraft} protect={action => guard.request(action, warehouseDraft.dirty)} /> : <>
      <form className="admin-search" onSubmit={e => { e.preventDefault(); setWarehousePage(1); setWarehouseQuery({ key: warehouseInput.trim() }) }}><label>查找仓库选项<input className="input" maxLength={100} value={warehouseInput} onChange={e => setWarehouseInput(e.target.value)} /></label><button className="btn btn-outline" disabled={busy}>查询仓库选项</button><button type="button" className="btn btn-outline" disabled={warehouse.loading || warehousePage <= 1} onClick={() => setWarehousePage(v => v - 1)}>上一页仓库选项</button><span>仓库选项 {warehousePage} / {Math.max(1, warehouse.result?.totalPage || 1)}</span><button type="button" className="btn btn-outline" disabled={warehouse.loading || warehousePage >= (warehouse.result?.totalPage || 1)} onClick={() => setWarehousePage(v => v + 1)}>下一页仓库选项</button></form>
      {warehouse.error && <p className="error-msg" role="alert">仓库选项查询失败：{warehouse.error} 请重新查询；已有选择仍保留。</p>}
      <div className="admin-search"><label>按仓库筛选<select aria-label="按仓库筛选" className="input" disabled={busy} value={filters.wareId} onChange={e => { setFilters({ ...filters, wareId: e.target.value }); setPage(1); setTargetPage(1); setSelected([]); setTarget(''); setActiveId(null) }}><option value="">全部仓库</option>{wareOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}{filters.wareId && !wareOptions.some(w => String(w.id) === filters.wareId) && <option value={filters.wareId}>仓库 {filters.wareId}</option>}</select></label>{tab === 'stock' ? <label>精确 SKU 编号<input className="input" type="number" min="1" step="1" value={filters.skuId} onChange={e => { setFilters({ ...filters, skuId: e.target.value }); setPage(1) }} /></label> : <label>按状态筛选<select aria-label="按状态筛选" className="input" disabled={busy} value={filters.status} onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); setSelected([]); setActiveId(null) }}><option value="">全部状态</option>{statusNames.map((name, index) => <option key={index} value={index}>{name}</option>)}</select></label>}</div>
      {tab !== 'stock' && <form className="admin-search" onSubmit={e => { e.preventDefault(); setFilters({ ...filters, key: keyInput.trim() }); setPage(1); setSelected([]); setActiveId(null); setReload(v => v + 1) }}><label>{tab === 'purchases' ? '查询采购单编号' : '查询 SKU 或采购单编号'}<input className="input" inputMode="numeric" pattern="[1-9][0-9]*" maxLength={18} value={keyInput} onChange={e => setKeyInput(e.target.value)} /></label><button className="btn btn-outline" disabled={busy}>查询采购记录</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setFilters({ wareId: '', status: '', skuId: '', key: '' }); setKeyInput(''); setPage(1); setSelected([]); setActiveId(null) }}>清除采购筛选</button></form>}
      {tab === 'demands' && <>
        <form className="admin-form" onSubmit={e => { e.preventDefault(); perform('save', { id: form.id, skuId: Number(form.skuId), wareId: Number(form.wareId), skuNum: Number(form.skuNum), skuPrice: Number(form.skuPrice).toFixed(2) }) }}><fieldset disabled={locked || form.status > 0 || !!form.purchaseId}><legend>{form.id ? '编辑未分配需求 #' + form.id : '新建采购需求'}</legend><div className="admin-form-grid">
          <label>搜索 SKU 名称或编号<input className="input" value={skuQuery} maxLength={100} onChange={e => { setSkuQuery(e.target.value); setSkuPage(1) }} /></label>
          <label>采购 SKU<select aria-label="采购 SKU" className="input" required disabled={sku.loading} value={form.skuId} onChange={e => setForm({ ...form, skuId: e.target.value ? Number(e.target.value) : '' })}><option value="">请选择 SKU</option>{skuOptions.map(s => <option key={s.skuId} value={s.skuId}>{s.skuId} · {s.skuName}</option>)}{form.skuId && !skuOptions.some(s => s.skuId === Number(form.skuId)) && <option value={form.skuId}>SKU {form.skuId}（已选）</option>}</select></label>
          <label>入库仓库<select aria-label="入库仓库" className="input" required value={form.wareId} onChange={e => setForm({ ...form, wareId: e.target.value ? Number(e.target.value) : '' })}><option value="">请选择仓库</option>{wareOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}{form.wareId && !wareOptions.some(w => w.id === Number(form.wareId)) && <option value={form.wareId}>仓库 {form.wareId}（已选）</option>}</select></label>
          <label>采购数量<input className="input" type="number" required min={1} max={1000000} step={1} value={form.skuNum} onChange={e => setForm({ ...form, skuNum: e.target.value })} /></label><label>预计采购总金额（元）<input className="input" type="number" required min={0} max="999999999999.99" step="0.01" value={form.skuPrice} onChange={e => setForm({ ...form, skuPrice: e.target.value })} /></label>
        </div><div className="admin-actions"><button className="btn btn-primary">保存采购需求</button><button type="button" className="btn btn-outline" onClick={() => guard.request(() => replaceForm(demandDraft()), dirty)}>取消编辑</button></div></fieldset></form>
        <div className="admin-actions"><button className="btn btn-outline" disabled={locked || sku.loading || skuPage <= 1} onClick={() => setSkuPage(v => v - 1)}>上一页 SKU 选项</button><span>SKU 选项 {skuPage} / {Math.max(1, sku.result?.totalPage || 1)}</span><button className="btn btn-outline" disabled={locked || sku.loading || skuPage >= (sku.result?.totalPage || 1)} onClick={() => setSkuPage(v => v + 1)}>下一页 SKU 选项</button><button className="btn btn-outline" disabled={locked} onClick={() => setSkuReload(v => v + 1)}>刷新 SKU 选项</button><button className="btn btn-outline" disabled={locked} onClick={() => guard.request(() => replaceForm(demandDraft()), dirty)}>新建下一条需求</button></div>
        {sku.error && <p className="error-msg" role="alert">SKU 选项查询失败：{sku.error} 不能据此认定没有商品，请刷新选项。</p>}
        {pendingDelete && <div className="admin-confirm" role="alert">确认删除未分配需求 #{pendingDelete}？<div className="admin-actions"><button className="btn btn-primary" disabled={locked} onClick={() => guard.request(() => perform('delete', { id: pendingDelete }), dirty && form.id === pendingDelete)}>确认删除需求</button><button className="btn btn-outline" disabled={busy} onClick={() => setPendingDelete(null)}>取消</button></div></div>}
        <form className="admin-search" onSubmit={e => { e.preventDefault(); setTargetKey({ key: targetInput.trim() }); setTargetPage(1) }}><label>查找合并目标采购单<input className="input" inputMode="numeric" pattern="[1-9][0-9]*" maxLength={18} value={targetInput} onChange={e => setTargetInput(e.target.value)} /></label><button className="btn btn-outline" disabled={busy}>查询合并目标</button><button type="button" className="btn btn-outline" disabled={targets.loading || targetPage <= 1} onClick={() => setTargetPage(v => v - 1)}>上一页合并目标</button><span>合并目标 {targetPage} / {Math.max(1, targets.result?.totalPage || 1)}</span><button type="button" className="btn btn-outline" disabled={targets.loading || targetPage >= (targets.result?.totalPage || 1)} onClick={() => setTargetPage(v => v + 1)}>下一页合并目标</button></form>
        {targets.error && <p className="error-msg" role="alert">合并目标查询失败：{targets.error} 请重新查询；已选编号保留，合并时仍由服务端核对仓库和状态。</p>}
        <div className="admin-actions"><label>合并目标<select aria-label="合并目标" className="input" disabled={locked || targets.loading} value={target} onChange={e => setTarget(e.target.value)}><option value="">新建采购单</option>{targetOptions.map(p => <option key={p.id} value={p.id}>采购单 {p.id} · 仓库 {p.wareId}</option>)}{target && !targetOptions.some(p => String(p.id) === target) && <option value={target}>采购单 {target}（已选）</option>}</select></label><button className="btn btn-primary" disabled={locked || loading || !!listError || !selected.length} onClick={() => guard.request(() => perform('merge', { purchaseId: Number(target) || null, items: [...selected] }), dirty && selected.includes(form.id))}>合并选中需求（{selected.length}）</button></div>
      </>}
      {listError && <p className="error-msg" role="alert">采购或库存查询失败：{listError} 请刷新数据；不能据此判断没有记录。</p>}
      {loading ? <p role="status">正在加载采购与库存…</p> : data && <div className="admin-table-wrap"><table className="admin-table">
        {tab === 'demands' && <><thead><tr><th>选择</th><th>需求 / 采购单</th><th>SKU</th><th>仓库</th><th>数量 / 总金额</th><th>状态</th><th>操作</th></tr></thead><tbody>{data.list.map(d => <tr key={d.id}><td><input type="checkbox" aria-label={'选择需求 ' + d.id} disabled={locked || d.status !== 0} checked={selected.includes(d.id)} onChange={e => setSelected(e.target.checked ? [...selected, d.id] : selected.filter(id => id !== d.id))} /></td><td>{d.id} / {d.purchaseId || '未分配'}</td><td>{d.skuId}</td><td>{d.wareId}</td><td>{d.skuNum} / ¥{d.skuPrice}</td><td>{statusNames[d.status]}</td><td><button className="btn btn-outline" disabled={locked || d.status !== 0} onClick={() => guard.request(() => { replaceForm({ ...d }); setError('') }, dirty)}>编辑</button><button className="btn btn-outline" disabled={locked || d.status !== 0} onClick={() => setPendingDelete(d.id)}>删除</button>{pending?.type === 'save' && !original.id && <button className="btn btn-outline" disabled={busy || storageError} onClick={() => inspectCandidate(d.id)}>核对此需求 {d.id}</button>}</td></tr>)}{!data.list.length && <tr><td colSpan={7}>暂无匹配采购需求。</td></tr>}</tbody></>}
        {tab === 'purchases' && <><thead><tr><th>采购单</th><th>仓库</th><th>总金额</th><th>状态</th><th>操作</th></tr></thead><tbody>{data.list.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.wareId}</td><td>¥{p.amount}</td><td>{statusNames[p.status]}</td><td><button className="btn btn-outline" disabled={busy} onClick={() => show(p.id)}>查看明细</button><button className="btn btn-primary" disabled={locked || ![0, 1].includes(p.status)} onClick={() => perform('receive', { id: p.id })}>领取</button></td></tr>)}{!data.list.length && <tr><td colSpan={5}>暂无匹配采购单。</td></tr>}</tbody></>}
        {tab === 'stock' && <><thead><tr><th>SKU 编号 / 名称</th><th>仓库</th><th>总库存</th><th>已锁定</th><th>可用库存</th></tr></thead><tbody>{data.list.map(s => <tr key={s.id}><td>{s.skuId} · {s.skuName || '未记录名称'}</td><td>{s.wareId}</td><td>{s.stock}</td><td>{s.stockLocked}</td><td>{Math.max(0, s.stock - s.stockLocked)}</td></tr>)}{!data.list.length && <tr><td colSpan={5}>暂无匹配库存，完成采购后会增加库存。</td></tr>}</tbody></>}
      </table></div>}
      <div className="pagination"><button disabled={busy || loading || page <= 1} onClick={() => { setPage(v => v - 1); setSelected([]); setActiveId(null) }}>上一页</button><span>第 {page} / {Math.max(1, data?.totalPage || 1)} 页</span><button disabled={busy || loading || page >= (data?.totalPage || 1)} onClick={() => { setPage(v => v + 1); setSelected([]); setActiveId(null) }}>下一页</button></div>
      {tab === 'purchases' && activeId && <section>{detailLoading ? <p role="status">正在核对采购单 #{activeId}，期间不能完成入库。</p> : detailError && <p className="error-msg" role="alert">采购单 #{activeId} 明细查询失败：{detailError} <button className="btn btn-outline" disabled={busy} onClick={() => setReload(v => v + 1)}>重试原采购单明细</button></p>}
        {readyDetail && <form className="admin-form" onSubmit={e => { e.preventDefault(); if (!detailLoading && active.purchase.id === activeId) perform('finish', { id: activeId, items: results.map(r => ({ ...r })) }) }}><fieldset disabled={locked || active.purchase.status !== 2}><legend>采购单 #{activeId} · {statusNames[active.purchase.status]}</legend>{active.items.map((item, index) => <div className="admin-receipt-item" key={item.id}><strong>需求 {item.id} · SKU {item.skuId} · 数量 {item.skuNum}</strong><label>需求 {item.id} 完成结果<select aria-label={'需求 ' + item.id + ' 完成结果'} className="input" value={results[index]?.status || 3} onChange={e => setResults(results.map((r, i) => i === index ? { ...r, status: Number(e.target.value) } : r))}><option value={3}>成功入库</option><option value={4}>采购失败，不入库</option></select></label>{results[index]?.status === 4 && <label>失败原因<input className="input" required maxLength={255} value={results[index]?.reason || ''} onChange={e => setResults(results.map((r, i) => i === index ? { ...r, reason: e.target.value } : r))} /></label>}</div>)}{active.purchase.status === 2 && <button className="btn btn-primary">完成并入库</button>}</fieldset><p className="admin-note">完成结果不可更改。结果待核对时保留原编号和结果；重试同一结果不会重复加库存。</p></form>}
      </section>}
    </>}
  </section>
}
