import { useEffect, useState } from 'react'
import * as admin from '../../api/admin'
import AdminWarehouses from './AdminWarehouses'

const statusNames = ['新建', '已分配', '采购中', '已完成', '存在失败']
const demandDraft = () => ({ id: null, skuId: '', wareId: '', skuNum: 1, skuPrice: '0.00' })
export default function AdminProcurement() {
  const [tab, setTab] = useState('demands')
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ wareId: '', status: '' })
  const [form, setForm] = useState(demandDraft)
  const [skus, setSkus] = useState([])
  const [skuQuery, setSkuQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [target, setTarget] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [results, setResults] = useState([])
  const [warehouseInput, setWarehouseInput] = useState(''), [warehouseQuery, setWarehouseQuery] = useState(''), [warehousePage, setWarehousePage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let current = true
    if (tab === 'warehouses') return
    setLoading(true); setError(''); setData(null)
    const params = { page, limit: 20, ...filters }
    Promise.all([admin.warehouses({ page: warehousePage, limit: 20, key: warehouseQuery }), admin.listDemands(params), admin.listPurchases(params), admin.listStock({ page, limit: 20, wareId: filters.wareId, skuId: filters.skuId || '' })])
      .then(([warehouses, demands, purchases, stock]) => { if (current) setData({ warehouses: warehouses.page.list, warehouseOptions: warehouses.page, demands: demands.page, purchases: purchases.page, stock: stock.page }) })
      .catch((e) => { if (current) setError(e.message) }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [filters, page, reload, tab, warehousePage, warehouseQuery])
  useEffect(() => {
    let current = true
    if (tab !== 'demands') return
    admin.listSkus({ page: 1, limit: 50, keyword: skuQuery }).then((res) => { if (current) setSkus(res.page.list) }).catch((e) => { if (current) setError(e.message) })
    return () => { current = false }
  }, [skuQuery, reload, tab])
  useEffect(() => {
    let current = true
    if (activeId) admin.getPurchase(activeId).then((res) => { if (current) { setActive(res); setResults(res.items.map((item) => ({ itemId: item.id, status: item.status === 4 ? 4 : 3, reason: item.failureReason || '' }))) } }).catch((e) => { if (current) setError(e.message) })
    return () => { current = false }
  }, [activeId, reload])
  const perform = async (action, message) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(message); setReload((value) => value + 1) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const merge = () => perform(async () => {
    const result = await admin.mergeDemands({ purchaseId: Number(target) || null, items: selected })
    setActiveId(result.purchaseId); setTab('purchases'); setSelected([]); setTarget(''); setPage(1)
  }, '需求已合并到采购单，领取后可完成入库。')
  const totalPage = data?.[tab]?.totalPage || 1
  return <section>
    <div className="admin-toolbar"><h2>采购与库存</h2><button className="btn btn-outline" disabled={busy} onClick={() => setReload(reload + 1)}>刷新数据</button></div>
    <div className="admin-actions" role="group" aria-label="采购页面">{[['demands', '采购需求'], ['purchases', '采购单'], ['stock', '库存'], ['warehouses', '仓库维护']].map(([value, label]) => <button className={`btn ${tab === value ? 'btn-primary' : 'btn-outline'}`} disabled={busy} key={value} onClick={() => { setTab(value); setPage(1); setSelected([]); setTarget(''); setError(''); setNotice('') }}>{label}</button>)}</div>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {tab === 'warehouses' ? <AdminWarehouses onChanged={() => setReload(v => v + 1)} /> : <>
    <form className="admin-search" onSubmit={e => { e.preventDefault(); setWarehousePage(1); setWarehouseQuery(warehouseInput.trim()); setReload(v => v + 1) }}><label>查找仓库选项<input className="input" maxLength={100} value={warehouseInput} onChange={e => setWarehouseInput(e.target.value)} /></label><button className="btn btn-outline" disabled={busy}>查询仓库选项</button><button type="button" className="btn btn-outline" disabled={loading || warehousePage <= 1} onClick={() => setWarehousePage(warehousePage - 1)}>上一页仓库选项</button><span>仓库选项 {warehousePage} / {data?.warehouseOptions.totalPage || 1}</span><button type="button" className="btn btn-outline" disabled={loading || warehousePage >= (data?.warehouseOptions.totalPage || 1)} onClick={() => setWarehousePage(warehousePage + 1)}>下一页仓库选项</button></form>
    <div className="admin-search"><label>按仓库筛选<select aria-label="按仓库筛选" className="input" value={filters.wareId} onChange={(e) => { setFilters({ ...filters, wareId: e.target.value }); setPage(1); setSelected([]); setTarget('') }}><option value="">全部仓库</option>{data?.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}{filters.wareId && !data?.warehouses.some(w => String(w.id) === String(filters.wareId)) && <option value={filters.wareId}>仓库 {filters.wareId}</option>}</select></label>{tab === 'stock' && <label>精确 SKU 编号<input className="input" type="number" min="1" step="1" value={filters.skuId || ''} onChange={e => { setFilters({ ...filters, skuId: e.target.value }); setPage(1) }} /></label>}{tab !== 'stock' && <label>按状态筛选<select className="input" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); setSelected([]) }}><option value="">全部状态</option>{statusNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>}</div>
    {tab === 'demands' && <>
      <form className="admin-form" onSubmit={(event) => { event.preventDefault(); perform(async () => { await admin.saveDemand({ ...form, skuId: Number(form.skuId), wareId: Number(form.wareId), skuNum: Number(form.skuNum) }); setForm(demandDraft()) }, '采购需求已保存。') }}><fieldset disabled={busy}><legend>{form.id ? `编辑未分配需求 #${form.id}` : '新建采购需求'}</legend><div className="admin-form-grid">
        <label>搜索 SKU 名称或编号<input className="input" value={skuQuery} maxLength={100} onChange={(e) => setSkuQuery(e.target.value)} /></label>
        <label>采购 SKU<select aria-label="采购 SKU" className="input" required value={form.skuId} onChange={(e) => setForm({ ...form, skuId: Number(e.target.value) })}><option value="">请选择 SKU</option>{skus.map((sku) => <option key={sku.skuId} value={sku.skuId}>{sku.skuId} · {sku.skuName}</option>)}{form.skuId && !skus.some((s) => s.skuId === Number(form.skuId)) && <option value={form.skuId}>SKU {form.skuId}</option>}</select></label>
        <label>入库仓库<select aria-label="入库仓库" className="input" required value={form.wareId} onChange={(e) => setForm({ ...form, wareId: Number(e.target.value) })}><option value="">请选择仓库</option>{data?.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}{form.wareId && !data?.warehouses.some(w => String(w.id) === String(form.wareId)) && <option value={form.wareId}>仓库 {form.wareId}</option>}</select></label>
        <label>采购数量<input className="input" type="number" required min={1} max={1000000} step={1} value={form.skuNum} onChange={(e) => setForm({ ...form, skuNum: e.target.value })} /></label>
        <label>预计采购总金额（元）<input className="input" type="number" required min={0} step="0.01" value={form.skuPrice} onChange={(e) => setForm({ ...form, skuPrice: e.target.value })} /></label>
      </div><div className="admin-actions"><button className="btn btn-primary">保存采购需求</button><button type="button" className="btn btn-outline" onClick={() => setForm(demandDraft())}>取消编辑</button></div></fieldset></form>
      {pendingDelete && <div className="admin-confirm" role="alert">确认删除未分配需求 #{pendingDelete}？<div className="admin-actions"><button className="btn btn-primary" disabled={busy} onClick={() => perform(async () => { await admin.deleteDemand(pendingDelete); setPendingDelete(null) }, '需求已删除。')}>确认删除需求</button><button className="btn btn-outline" disabled={busy} onClick={() => setPendingDelete(null)}>取消</button></div></div>}
      <div className="admin-actions"><label>合并目标<select className="input" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">新建采购单</option>{data?.purchases.list.filter((p) => p.status === 0 || p.status === 1).map((p) => <option key={p.id} value={p.id}>采购单 {p.id} · 仓库 {p.wareId}</option>)}</select></label><button className="btn btn-primary" disabled={busy || !selected.length} onClick={merge}>合并选中需求（{selected.length}）</button></div>
    </>}
    {loading ? <p role="status">正在加载采购与库存…</p> : data && <div className="admin-table-wrap"><table className="admin-table">
      {tab === 'demands' && <><thead><tr><th>选择</th><th>需求 / 采购单</th><th>SKU</th><th>仓库</th><th>数量 / 总金额</th><th>状态</th><th>操作</th></tr></thead><tbody>{data.demands.list.map((d) => <tr key={d.id}><td><input type="checkbox" aria-label={`选择需求 ${d.id}`} disabled={d.status !== 0 || busy} checked={selected.includes(d.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, d.id] : selected.filter((id) => id !== d.id))} /></td><td>{d.id} / {d.purchaseId || '未分配'}</td><td>{d.skuId}</td><td>{d.wareId}</td><td>{d.skuNum} / ¥{d.skuPrice}</td><td>{statusNames[d.status]}</td><td><button className="btn btn-outline" disabled={busy || d.status !== 0} onClick={() => setForm({ id: d.id, skuId: d.skuId, wareId: d.wareId, skuNum: d.skuNum, skuPrice: d.skuPrice })}>编辑</button><button className="btn btn-outline" disabled={busy || d.status !== 0} onClick={() => setPendingDelete(d.id)}>删除</button></td></tr>)}{!data.demands.list.length && <tr><td colSpan={7}>暂无采购需求。</td></tr>}</tbody></>}
      {tab === 'purchases' && <><thead><tr><th>采购单</th><th>仓库</th><th>总金额</th><th>状态</th><th>操作</th></tr></thead><tbody>{data.purchases.list.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.wareId}</td><td>¥{p.amount}</td><td>{statusNames[p.status]}</td><td><button className="btn btn-outline" disabled={busy} onClick={() => setActiveId(p.id)}>查看明细</button><button className="btn btn-primary" disabled={busy || ![0, 1].includes(p.status)} onClick={() => { setActiveId(p.id); perform(() => admin.receivePurchase(p.id), '采购单已领取。') }}>领取</button></td></tr>)}{!data.purchases.list.length && <tr><td colSpan={5}>暂无采购单，请先合并需求。</td></tr>}</tbody></>}
      {tab === 'stock' && <><thead><tr><th>SKU 编号 / 名称</th><th>仓库</th><th>总库存</th><th>已锁定</th><th>可用库存</th></tr></thead><tbody>{data.stock.list.map((s) => <tr key={s.id}><td>{s.skuId} · {s.skuName || '未记录名称'}</td><td>{s.wareId}</td><td>{s.stock}</td><td>{s.stockLocked}</td><td>{Math.max(0, s.stock - s.stockLocked)}</td></tr>)}{!data.stock.list.length && <tr><td colSpan={5}>此仓库暂无库存，完成采购后会自动增加。</td></tr>}</tbody></>}
    </table></div>}
    <div className="pagination"><button disabled={loading || page <= 1} onClick={() => { setPage(page - 1); setSelected([]) }}>上一页</button><span>第 {page} / {Math.max(totalPage, 1)} 页</span><button disabled={loading || page >= totalPage} onClick={() => { setPage(page + 1); setSelected([]) }}>下一页</button></div>
    {tab === 'purchases' && active && <form className="admin-form" onSubmit={(event) => { event.preventDefault(); perform(() => admin.finishPurchase({ id: active.purchase.id, items: results }), '采购结果已保存，成功项已入库。') }}><fieldset disabled={busy || active.purchase.status !== 2}><legend>采购单 #{active.purchase.id} · {statusNames[active.purchase.status]}</legend>
      {active.items.map((item, index) => <div className="admin-receipt-item" key={item.id}><strong>需求 {item.id} · SKU {item.skuId} · 数量 {item.skuNum}</strong><label>需求 {item.id} 完成结果<select className="input" value={results[index]?.status || 3} onChange={(e) => setResults(results.map((r, i) => i === index ? { ...r, status: Number(e.target.value) } : r))}><option value={3}>成功入库</option><option value={4}>采购失败，不入库</option></select></label>{results[index]?.status === 4 && <label>失败原因<input className="input" required maxLength={255} value={results[index]?.reason || ''} onChange={(e) => setResults(results.map((r, i) => i === index ? { ...r, reason: e.target.value } : r))} /></label>}</div>)}
      {active.purchase.status === 2 && <button className="btn btn-primary">完成并入库</button>}</fieldset><p className="admin-note">只有领取后的采购单可以完成。完成结果不可更改；重试同一结果不会重复加库存。失败项可另建需求重新采购。</p></form>}
    </>}
  </section>
}
