import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteCatalog, getCatalog, saveCatalog, uploadImage } from '../../api/admin'
import useUnsavedForm from '../../hooks/useUnsavedForm'
import { formSignature } from '../../utils/form'
import { leafCategories } from '../../utils/product'
import { catalogKeys as keys, catalogCategories, catalogRows } from '../../utils/catalog'

const names = { categories: '分类', brands: '品牌', groups: '属性分组', attrs: '属性' }
const blankFilter = () => ({ key: '', catalogId: '', status: '', type: '' })
const empty = () => ({ name: '', sort: 0, catLevel: 1, parentCid: 0, catelogId: '', firstLetter: 'A', logo: '', showStatus: 1, attrType: 1, attrGroupId: '', enable: 1, valueSelect: '' })


export default function AdminCatalog() {
  const [kind, setKind] = useState('categories')
  const [fields, setFields] = useState(blankFilter), [filter, setFilter] = useState(blankFilter), [pageNumber, setPage] = useState(1)
  const [focused, setFocused] = useState(null), [position, setPosition] = useState(''), locating = useRef(null)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [stale, setStale] = useState(false), [unknown, setUnknown] = useState(false), working = useRef(false)
  const baseline = useRef(formSignature(empty(), Object.keys(empty())))
  const replaceForm = next => { baseline.current = formSignature(next, Object.keys(empty())); setForm(next) }
  const guard = useUnsavedForm(formSignature(form, Object.keys(empty())) !== baseline.current || unknown, busy)
  useEffect(() => {
    let active = true
    setLoading(true)
    getCatalog().then((res) => { if (active) { setMeta(res.data); setStale(false); setError('') } }).catch((e) => { if (active) { setError(e.message); setStale(true) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  useEffect(() => {
    if (!meta || busy || loading || stale) return
    const target = locating.current, found = catalogRows(meta, kind, filter)
    if (!target || target.kind !== kind) { setPage(current => Math.min(current, Math.max(1, Math.ceil(found.length / 20)))); return }
    locating.current = null
    const exists = found.findIndex(row => row[keys[kind]] === target.id)
    if (target.action !== 'delete') {
      const all = catalogRows(meta, kind, blankFilter()), index = all.findIndex(row => row[keys[kind]] === target.id)
      if (index >= 0) {
        const cleared = exists < 0, next = Math.floor((cleared ? index : exists) / 20) + 1
        if (cleared) { setFilter(blankFilter()); setFields(blankFilter()) }
        setPage(next); setFocused(target.id); setPosition(`已定位${names[kind]} #${target.id}，第 ${next} 页。${cleared ? '原筛选不包含此记录，已清除条件。' : ''}${target.action === 'check' ? '请核对最新资料，未自动重发原操作。' : ''}`)
        return
      }
    }
    setPage(current => Math.min(current, Math.max(1, Math.ceil(found.length / 20)))); setFocused(null)
    setPosition(target.action === 'check' ? `最新资料中未找到原编号 #${target.id}，请核对结果；未自动重发原操作。` : `已刷新${names[kind]}列表，保留原查询条件。`)
  }, [meta, kind, filter, busy, loading, stale])
  const categories = meta ? catalogCategories(meta.categories) : []
  const leaves = meta ? leafCategories(meta.categories) : []
  const matches = catalogRows(meta, kind, filter), pages = Math.max(1, Math.ceil(matches.length / 20)), page = Math.min(pageNumber, pages)
  const rows = matches.slice((page - 1) * 20, page * 20)
  const set = (name, value) => setForm({ ...form, [name]: value })
  const reset = () => { replaceForm(empty()); setEditing(null); setPendingDelete(null) }
  const edit = (row) => guard.request(() => {
    replaceForm({ ...empty(), ...row, name: row.name || row.attrGroupName || row.attrName, attrGroupId: kind === 'attrs' ? meta.relations.find((r) => r.attrId === row.attrId)?.attrGroupId || '' : row.attrGroupId })
    setEditing(row[keys[kind]]); setFocused(row[keys[kind]]); setNotice(''); setError('')
  })
  const submit = async (event) => {
    event.preventDefault()
    if (working.current || loading || stale || unknown) return
    working.current = true; setBusy(true); setError(''); setNotice('')
    let saved = false
    try {
      let data
      if (kind === 'categories') data = { catId: editing, name: form.name, catLevel: Number(form.catLevel), parentCid: Number(form.parentCid), sort: Number(form.sort) }
      if (kind === 'brands') data = { brandId: editing, name: form.name, firstLetter: form.firstLetter, logo: form.logo, sort: Number(form.sort), showStatus: Number(form.showStatus) }
      if (kind === 'groups') data = { attrGroupId: editing, attrGroupName: form.name, catelogId: Number(form.catelogId), sort: Number(form.sort) }
      if (kind === 'attrs') data = { attrId: editing, attrName: form.name, catelogId: Number(form.catelogId), attrType: Number(form.attrType), attrGroupId: Number(form.attrGroupId) || null, enable: Number(form.enable), valueSelect: form.valueSelect }
      const response = await saveCatalog(kind, data); saved = true; baseline.current = formSignature(form, Object.keys(empty())); const id = response.id || editing; setEditing(id); locating.current = { kind, id, action: 'save' }; setNotice(`${names[kind]}已保存。`)
      setMeta((await getCatalog()).data); setStale(false); reset()
    } catch (e) {
      if (saved) { setStale(true); setError('资料已保存，但列表刷新失败，请重新加载核对；当前表单已绑定原编号。') }
      else { const uncertain = !e.status || e.status >= 500; setUnknown(!editing && uncertain); if (uncertain) setStale(true); if (uncertain && editing) { locating.current = { kind, id: editing, action: 'check' } } setError(`${e.message} 请先刷新核对原操作结果。`) }
    } finally { working.current = false; setBusy(false) }
  }
  const remove = async () => {
    if (working.current || loading || stale || unknown || !pendingDelete) return
    const id = pendingDelete[keys[kind]]
    working.current = true; setBusy(true); setError(''); setNotice(''); let deleted = false
    try {
      await deleteCatalog(kind, id); deleted = true; locating.current = { kind, id, action: 'delete' }; setNotice(names[kind] + '已删除。')
      if (editing === id) reset()
      setMeta((await getCatalog()).data); setStale(false)
    } catch (e) {
      if (deleted) { setStale(true); setError('删除已确认，但列表刷新失败，请重新加载核对；原查询条件已保留，暂停修改。') }
      else { if (!e.status || e.status >= 500) { setStale(true); locating.current = { kind, id, action: 'check' } } setError(e.message + ' 删除结果请重新加载核对。') }
    } finally { working.current = false; setBusy(false); setPendingDelete(null) }
  }
  const uploadLogo = async (event) => {
    const input = event.currentTarget, file = input.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try { const result = await uploadImage(file); setForm((current) => ({ ...current, logo: result.url })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false); input.value = '' }
  }
  return <section>{guard.dialog}
    <div className="admin-toolbar"><h2>商品基础资料</h2><Link to="/admin/products">返回商品列表</Link><button className="btn btn-outline" disabled={busy} onClick={() => setRetry(retry + 1)}>刷新基础资料</button></div>
    <div className="admin-actions" role="group" aria-label="基础资料类型">{Object.entries(names).map(([value, label]) => <button key={value} disabled={busy || loading || stale || unknown} className={`btn ${kind === value ? 'btn-primary' : 'btn-outline'}`} onClick={() => guard.request(() => { setKind(value); reset(); setFilter(blankFilter()); setFields(blankFilter()); setPage(1); setFocused(null); setPosition(''); setError(''); setNotice('') })}>{label}</button>)}</div>
    {error && <p className="error-msg" role="alert">{error} <button className="btn btn-outline" disabled={busy} onClick={() => setRetry(retry + 1)}>重新加载资料</button></p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {stale && meta && <p role="status">当前显示上次成功加载的基础资料，重新加载成功前暂停修改。</p>}
    {unknown && <div className="admin-confirm" role="status">本次新增结果未知，原输入已保留。请重新加载列表核对后，再决定是否放弃表单。<button className="btn btn-outline" disabled={busy} onClick={() => { reset(); setUnknown(false); setError('') }}>已核对，放弃本次资料表单</button></div>}
    {!meta ? <p role="status">{loading ? '正在加载基础资料…' : '基础资料加载失败，请重新加载。'}</p> : <>
      <form className="admin-search" aria-label="基础资料查询" onSubmit={e => { e.preventDefault(); setFilter({ ...fields, key: fields.key.trim() }); setPage(1); setPosition(''); setFocused(null) }}>
        <label>查询名称或编号<input className="input" maxLength={100} value={fields.key} onChange={e => setFields({ ...fields, key: e.target.value })} /></label>
        {['groups', 'attrs'].includes(kind) && <label>筛选所属分类<select aria-label="筛选所属分类" className="input" value={fields.catalogId} onChange={e => setFields({ ...fields, catalogId: e.target.value })}><option value="">全部分类</option>{leaves.map(c => <option key={c.id} value={c.id}>{c.label} · #{c.id}</option>)}</select></label>}
        {['brands', 'attrs'].includes(kind) && <label>筛选资料状态<select aria-label="筛选资料状态" className="input" value={fields.status} onChange={e => setFields({ ...fields, status: e.target.value })}><option value="">全部状态</option><option value="1">启用</option><option value="0">{kind === 'brands' ? '隐藏' : '停用'}</option></select></label>}
        {kind === 'attrs' && <label>筛选属性类型<select aria-label="筛选属性类型" className="input" value={fields.type} onChange={e => setFields({ ...fields, type: e.target.value })}><option value="">全部类型</option><option value="1">基础参数</option><option value="0">销售属性</option></select></label>}
        <button className="btn btn-outline" disabled={busy}>查询资料</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setFields(blankFilter()); setFilter(blankFilter()); setPage(1); setPosition(''); setFocused(null) }}>清除资料条件</button>
      </form>
      {position && <p className="admin-note" role="status">{position}</p>}
      <p className="admin-note">当前{names[kind]}共 {matches.length} 条匹配记录，每页 20 条。分类按层级及同级排序、编号稳定展示；查询和分页只影响列表，编辑选项仍使用全部资料。</p>
      <form className="admin-form" onSubmit={submit}><fieldset disabled={busy || loading || stale || unknown}><legend>{editing ? `编辑${names[kind]} #${editing}` : `新增${names[kind]}`}</legend><div className="admin-form-grid">
        <label>{names[kind]}名称<input className="input" required maxLength={50} value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        {kind === 'categories' && <><label>分类层级<select aria-label="分类层级" className="input" disabled={!!editing} value={form.catLevel} onChange={(e) => setForm({ ...form, catLevel: Number(e.target.value), parentCid: Number(e.target.value) === 1 ? 0 : '' })}><option value={1}>一级</option><option value={2}>二级</option><option value={3}>三级</option></select></label><label>父分类<select aria-label="父分类" className="input" required disabled={!!editing} value={Number(form.catLevel) === 1 ? '0' : form.parentCid} onChange={(e) => set('parentCid', Number(e.target.value))}>{Number(form.catLevel) === 1 ? <option value={0}>无</option> : <><option value="">请选择</option>{categories.filter((c) => c.catLevel === Number(form.catLevel) - 1).map((c) => <option key={c.catId} value={c.catId}>{c.name} · {c.catId}</option>)}</>}</select></label></>}
        {['groups', 'attrs'].includes(kind) && <label>所属三级分类<select aria-label="所属三级分类" className="input" required disabled={!!editing} value={form.catelogId} onChange={(e) => setForm({ ...form, catelogId: e.target.value ? Number(e.target.value) : '', attrGroupId: '' })}><option value="">请选择</option>{leaves.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
        {kind !== 'attrs' && <label>排序<input className="input" type="number" required min={0} max={100000} value={form.sort} onChange={(e) => set('sort', e.target.value)} /></label>}
        {kind === 'brands' && <><label>首字母<input className="input" required maxLength={1} pattern="[A-Za-z]" value={form.firstLetter} onChange={(e) => set('firstLetter', e.target.value)} /></label><label>品牌状态<select aria-label="品牌状态" className="input" value={form.showStatus} onChange={(e) => set('showStatus', Number(e.target.value))}><option value={1}>启用</option><option value={0}>隐藏</option></select></label><label>品牌图片地址<input className="input" value={form.logo} onChange={(e) => set('logo', e.target.value)} /></label><label>上传品牌图片<input type="file" accept="image/png,image/jpeg" onChange={uploadLogo} /></label></>}
        {kind === 'attrs' && <><label>属性类型<select aria-label="属性类型" className="input" disabled={!!editing} value={form.attrType} onChange={(e) => set('attrType', Number(e.target.value))}><option value={1}>基础参数</option><option value={0}>销售属性</option></select></label>{Number(form.attrType) === 1 && <label>属性分组<select aria-label="属性分组" className="input" required value={form.attrGroupId} onChange={(e) => set('attrGroupId', Number(e.target.value))}><option value="">请选择</option>{meta.groups.filter((g) => g.catelogId === Number(form.catelogId)).map((g) => <option key={g.attrGroupId} value={g.attrGroupId}>{g.attrGroupName}</option>)}</select></label>}<label>可选值（用分号分隔）<input className="input" maxLength={255} value={form.valueSelect || ''} onChange={(e) => set('valueSelect', e.target.value)} /></label><label>属性状态<select aria-label="属性状态" className="input" value={form.enable} onChange={(e) => set('enable', Number(e.target.value))}><option value={1}>启用</option><option value={0}>停用</option></select></label></>}
      </div><div className="admin-actions"><button className="btn btn-primary">{busy ? '正在保存…' : '保存基础资料'}</button><button type="button" className="btn btn-outline" onClick={() => guard.request(reset)}>取消编辑</button></div></fieldset></form>
      {pendingDelete && <div className="admin-confirm" role="alert">确认删除“{pendingDelete.name || pendingDelete.attrName || pendingDelete.attrGroupName}”？已被商品使用的资料不能删除。<div className="admin-actions"><button className="btn btn-primary" disabled={busy || loading || stale || unknown} onClick={() => guard.request(remove, editing === pendingDelete[keys[kind]] && formSignature(form, Object.keys(empty())) !== baseline.current)}>确认删除</button><button className="btn btn-outline" disabled={busy || loading || stale || unknown} onClick={() => setPendingDelete(null)}>取消</button></div></div>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>编号</th><th>名称</th><th>分类 / 状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row[keys[kind]]}><td>{row[keys[kind]]}{focused === row[keys[kind]] && <span> · 当前定位</span>}</td><td>{row.name || row.attrGroupName || row.attrName}{kind === 'categories' && <p className="admin-note">{row.path}</p>}</td><td>{kind === 'categories' ? `${row.catLevel} 级 · 父分类 #${row.parentCid}` : kind === 'brands' ? row.showStatus === 1 ? '启用' : '隐藏' : (categories.find((c) => c.catId === row.catelogId)?.path || '分类名称未加载') + ' · #' + row.catelogId}{kind === 'attrs' && ` · ${row.attrType === 1 ? '参数' : '销售'} · ${Number(row.enable) === 1 ? '启用' : '停用'}`}</td><td><button className="btn btn-outline" disabled={busy || loading || stale || unknown} onClick={() => edit(row)}>编辑</button><button className="btn btn-outline" disabled={busy || loading || stale || unknown} onClick={() => setPendingDelete(row)}>删除</button></td></tr>)}{!rows.length && <tr><td colSpan={4}>没有匹配的资料，请调整条件或新增。</td></tr>}</tbody></table></div><div className="pagination" aria-label="基础资料分页"><button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {pages} 页</span><button disabled={page >= pages || busy} onClick={() => setPage(page + 1)}>下一页</button></div>
    </>}
  </section>
}
