import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminQuery } from '../../utils/admin'
import { deleteCatalog, getCatalogTree, getCatalogDetail, listCatalog, locateCatalog, saveCatalog, uploadImage } from '../../api/admin'
import CatalogSelect from '../../components/CatalogSelect'
import useUnsavedForm from '../../hooks/useUnsavedForm'
import { formSignature } from '../../utils/form'
import { leafCategories } from '../../utils/product'
import { catalogKeys as keys, catalogCategories, catalogRows, catalogPage } from '../../utils/catalog'

const names = { categories: '分类', brands: '品牌', groups: '属性分组', attrs: '属性' }
const blankFilter = () => ({ key: '', catalogId: '', status: '', type: '' })
const empty = () => ({ name: '', sort: 0, catLevel: 1, parentCid: 0, catelogId: '', firstLetter: 'A', logo: '', showStatus: 1, attrType: 1, attrGroupId: '', enable: 1, valueSelect: '' })


export default function AdminCatalog() {
  const [params, setParams] = useSearchParams(), query = params.toString()
  const parsed = useMemo(() => { try { return { values: adminQuery('catalog', query), error: '' } } catch (e) { return { values: adminQuery('catalog', ''), error: e.message } } }, [query])
  const view = parsed.values, kind = view.kind, pageNumber = Number(view.page)
  const filter = useMemo(() => ({ key: view.key, catalogId: view.catalogId, status: view.status, type: view.type }), [view])
  const [fieldDraft, setFieldDraft] = useState({ query, values: filter })
  const fields = fieldDraft.query === query ? fieldDraft.values : filter
  const setFields = values => setFieldDraft({ query, values })
  const [focused, setFocused] = useState(null), [position, setPosition] = useState(''), locating = useRef(null)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null), [result, setResult] = useState(null), [loadedQuery, setLoadedQuery] = useState(null)
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
  const dirty = formSignature(form, Object.keys(empty())) !== baseline.current || unknown
  const guard = useUnsavedForm(dirty, busy)
  const commit = guard.commit
  const keepConfirmedForm = useRef(false), previousKind = useRef(kind)
  const navigateQuery = useCallback((patch, replace = false) => {
    const values = { ...view, ...patch }, next = new URLSearchParams()
    if (!['groups', 'attrs'].includes(values.kind)) values.catalogId = ''
    if (!['brands', 'attrs'].includes(values.kind)) values.status = ''
    if (values.kind !== 'attrs') values.type = ''
    for (const [key, value] of Object.entries(values)) if (value !== '' && value != null) next.set(key, String(value))
    if (next.toString() === query) return false
    setParams(next, { replace }); return true
  }, [view, query, setParams])
  const changeQuery = patch => {
    if (unknown) { guard.commit(() => navigateQuery(patch)); return }
    guard.request(() => { reset(); locating.current = null; setPosition(''); setFocused(null); setError(''); setNotice(''); navigateQuery(patch) })
  }
  const locateQuery = useCallback(patch => {
    keepConfirmedForm.current = editing != null
    if (!commit(() => navigateQuery(patch, true))) keepConfirmedForm.current = false
  }, [editing, commit, navigateQuery])
  useEffect(() => {
    const keep = keepConfirmedForm.current || unknown && previousKind.current === kind
    previousKind.current = kind; keepConfirmedForm.current = false
    if (!keep) { replaceForm(empty()); setEditing(null); setPendingDelete(null); setUnknown(false) }
    // Reconcile only URL transitions; completing an unknown save must preserve the confirmed form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
  const read = useCallback(async () => {
    const [tree, listed] = await Promise.all([getCatalogTree(), kind === 'categories' ? Promise.resolve(null) : listCatalog(kind, { ...filter, page: pageNumber, limit: 20 })])
    return { meta: { categories: tree.data }, page: listed ? catalogPage(listed.page, kind) : null }
  }, [kind, filter, pageNumber])
  useEffect(() => {
    let active = true
    if (parsed.error) { setLoading(false); return }
    setLoading(true)
    read().then(data => { if (active) { setMeta(data.meta); setResult(data.page); setLoadedQuery(query); setStale(false); setError('') } })
      .catch(e => { if (active) { setError(e.message); setStale(true) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, retry, read, parsed.error])
  useEffect(() => {
    if (!meta || loadedQuery !== query || busy || loading || stale || unknown || parsed.error || dirty) return
    let active = true
    const target = locating.current, found = kind === 'categories' ? catalogRows(meta, kind, filter) : [], last = Math.max(1, kind === 'categories' ? Math.ceil(found.length / 20) : result?.totalPage || 1)
    if (!target || target.kind !== kind) { if (pageNumber > last) locateQuery({ page: String(last) }); return }
    const positionResult = async () => {
      let located = { found: false }
      if (target.action !== 'delete') {
        if (kind === 'categories') {
          const exists = found.findIndex(row => row[keys[kind]] === target.id), all = catalogRows(meta, kind, blankFilter()), index = all.findIndex(row => row[keys[kind]] === target.id)
          located = { found: index >= 0, inFilter: exists >= 0, page: Math.floor((exists >= 0 ? exists : index) / 20) + 1 }
        } else located = (await locateCatalog(kind, target.id, { ...filter, limit: 20 })).data
      }
      if (!active) return
      locating.current = null
      if (located.found) {
        const cleared = !located.inFilter
        locateQuery({ ...(cleared ? blankFilter() : {}), page: String(located.page) }); setFocused(target.id); setPosition(`已定位${names[kind]} #${target.id}，第 ${located.page} 页。${cleared ? '原筛选不包含此记录，已清除条件。' : ''}${target.action === 'check' ? '请核对最新资料，未自动重发原操作。' : ''}`)
      } else {
        if (pageNumber > last) locateQuery({ page: String(last) }); setFocused(null)
        setPosition(target.action === 'check' ? `最新资料中未找到原编号 #${target.id}，请核对结果；未自动重发原操作。` : `已刷新${names[kind]}列表，保留原查询条件。`)
      }
    }
    positionResult().catch(e => { if (active) { setStale(true); setError('结果定位失败：' + e.message + '，请重新加载核对。') } })
    return () => { active = false }
  }, [meta, result, loadedQuery, query, kind, filter, pageNumber, busy, loading, stale, unknown, dirty, parsed.error, locateQuery])
  const categories = meta ? catalogCategories(meta.categories) : []
  const leaves = meta ? leafCategories(meta.categories) : []
  const matches = kind === 'categories' ? catalogRows(meta, kind, filter) : [], total = kind === 'categories' ? matches.length : result?.totalCount || 0
  const pages = Math.max(1, kind === 'categories' ? Math.ceil(total / 20) : result?.totalPage || 1), page = Math.min(pageNumber, pages)
  const rows = kind === 'categories' ? matches.slice((page - 1) * 20, page * 20) : result?.list || []
  const set = (name, value) => setForm({ ...form, [name]: value })
  const reset = () => { replaceForm(empty()); setEditing(null); setPendingDelete(null) }
  const edit = row => guard.request(async () => {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try {
      const value = kind === 'categories' ? row : (await getCatalogDetail(kind, row[keys[kind]])).data
      replaceForm({ ...empty(), ...value, name: value.name || value.attrGroupName || value.attrName, attrGroupId: value.attrGroupId || '' })
      setEditing(value[keys[kind]]); setFocused(value[keys[kind]]); setNotice('')
    } catch (e) { setError('编辑详情加载失败：' + e.message + '，原输入已保留。') }
    finally { working.current = false; setBusy(false) }
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
      setBusy(false); setLoading(true)
      const next = await read(); setMeta(next.meta); setResult(next.page); setLoadedQuery(query); setStale(false); reset()
    } catch (e) {
      if (saved) { setStale(true); setError('资料已保存，但列表刷新失败，请重新加载核对；当前表单已绑定原编号。') }
      else { const uncertain = !e.status || e.status >= 500; setUnknown(!editing && uncertain); if (uncertain) setStale(true); if (uncertain && editing) { locating.current = { kind, id: editing, action: 'check' } } setError(`${e.message} 请先刷新核对原操作结果。`) }
    } finally { working.current = false; setBusy(false); setLoading(false) }
  }
  const remove = async () => {
    if (working.current || loading || stale || unknown || !pendingDelete) return
    const id = pendingDelete[keys[kind]]
    working.current = true; setBusy(true); setError(''); setNotice(''); let deleted = false
    try {
      await deleteCatalog(kind, id); deleted = true; locating.current = { kind, id, action: 'delete' }; setNotice(names[kind] + '已删除。')
      if (editing === id) reset()
      setBusy(false); setLoading(true)
      const next = await read(); setMeta(next.meta); setResult(next.page); setLoadedQuery(query); setStale(false)
    } catch (e) {
      if (deleted) { setStale(true); setError('删除已确认，但列表刷新失败，请重新加载核对；原查询条件已保留，暂停修改。') }
      else { if (!e.status || e.status >= 500) { setStale(true); locating.current = { kind, id, action: 'check' } } setError(e.message + ' 删除结果请重新加载核对。') }
    } finally { working.current = false; setBusy(false); setLoading(false); setPendingDelete(null) }
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
    <div className="admin-actions" role="group" aria-label="基础资料类型">{Object.entries(names).map(([value, label]) => <button key={value} disabled={busy || loading || stale || unknown || loadedQuery !== query} className={`btn ${kind === value ? 'btn-primary' : 'btn-outline'}`} onClick={() => changeQuery({ kind: value, ...blankFilter(), page: '1' })}>{label}</button>)}</div>
    {error && <p className="error-msg" role="alert">{error} <button className="btn btn-outline" disabled={busy} onClick={() => setRetry(retry + 1)}>重新加载资料</button></p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {stale && meta && <p role="status">当前显示上次成功加载的基础资料，重新加载成功前暂停修改。</p>}
    {loadedQuery !== query && meta && !stale && <p role="status">查询正在更新，当前为上次读取的资料，暂不能修改。</p>}
    {unknown && <div className="admin-confirm" role="status">本次新增结果未知，原输入已保留。请重新加载列表核对后，再决定是否放弃表单。<button className="btn btn-outline" disabled={busy} onClick={() => { reset(); setUnknown(false); setError('') }}>已核对，放弃本次资料表单</button></div>}
    {parsed.error ? <p className="error-msg" role="alert">{parsed.error}<button className="btn btn-outline" onClick={() => changeQuery({ ...adminQuery('catalog', '') })}>清除无效查询</button></p> : !meta ? <p role="status">{loading ? '正在加载基础资料…' : '基础资料加载失败，请重新加载。'}</p> : <>
      <form className="admin-search" aria-label="基础资料查询" onSubmit={e => { e.preventDefault(); changeQuery({ ...fields, key: fields.key.trim(), page: '1' }) }}>
        <label>查询名称或编号<input className="input" maxLength={100} value={fields.key} onChange={e => setFields({ ...fields, key: e.target.value })} /></label>
        {['groups', 'attrs'].includes(kind) && <label>筛选所属分类<select aria-label="筛选所属分类" className="input" value={fields.catalogId} onChange={e => setFields({ ...fields, catalogId: e.target.value })}><option value="">全部分类</option>{leaves.map(c => <option key={c.id} value={c.id}>{c.label} · #{c.id}</option>)}</select></label>}
        {['brands', 'attrs'].includes(kind) && <label>筛选资料状态<select aria-label="筛选资料状态" className="input" value={fields.status} onChange={e => setFields({ ...fields, status: e.target.value })}><option value="">全部状态</option><option value="1">启用</option><option value="0">{kind === 'brands' ? '隐藏' : '停用'}</option></select></label>}
        {kind === 'attrs' && <label>筛选属性类型<select aria-label="筛选属性类型" className="input" value={fields.type} onChange={e => setFields({ ...fields, type: e.target.value })}><option value="">全部类型</option><option value="1">基础参数</option><option value="0">销售属性</option></select></label>}
        <button className="btn btn-outline" disabled={busy}>查询资料</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => changeQuery({ ...blankFilter(), page: '1' })}>清除资料条件</button>
      </form>
      {position && <p className="admin-note" role="status">{position}</p>}
      <p className="admin-note">当前{names[kind]}共 {total} 条匹配记录，每页 20 条。分类保留层级顺序；品牌、分组和属性按编号升序分页，编辑详情和选项按需读取。</p>
      <form className="admin-form" onSubmit={submit}><fieldset disabled={busy || loading || stale || unknown || loadedQuery !== query}><legend>{editing ? `编辑${names[kind]} #${editing}` : `新增${names[kind]}`}</legend><div className="admin-form-grid">
        <label>{names[kind]}名称<input className="input" required maxLength={50} value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        {kind === 'categories' && <><label>分类层级<select aria-label="分类层级" className="input" disabled={!!editing} value={form.catLevel} onChange={(e) => setForm({ ...form, catLevel: Number(e.target.value), parentCid: Number(e.target.value) === 1 ? 0 : '' })}><option value={1}>一级</option><option value={2}>二级</option><option value={3}>三级</option></select></label><label>父分类<select aria-label="父分类" className="input" required disabled={!!editing} value={Number(form.catLevel) === 1 ? '0' : form.parentCid} onChange={(e) => set('parentCid', Number(e.target.value))}>{Number(form.catLevel) === 1 ? <option value={0}>无</option> : <><option value="">请选择</option>{categories.filter((c) => c.catLevel === Number(form.catLevel) - 1).map((c) => <option key={c.catId} value={c.catId}>{c.name} · {c.catId}</option>)}</>}</select></label></>}
        {['groups', 'attrs'].includes(kind) && <label>所属三级分类<select aria-label="所属三级分类" className="input" required disabled={!!editing} value={form.catelogId} onChange={(e) => setForm({ ...form, catelogId: e.target.value ? Number(e.target.value) : '', attrGroupId: '' })}><option value="">请选择</option>{leaves.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
        {kind !== 'attrs' && <label>排序<input className="input" type="number" required min={0} max={100000} value={form.sort} onChange={(e) => set('sort', e.target.value)} /></label>}
        {kind === 'brands' && <><label>首字母<input className="input" required maxLength={1} pattern="[A-Za-z]" value={form.firstLetter} onChange={(e) => set('firstLetter', e.target.value)} /></label><label>品牌状态<select aria-label="品牌状态" className="input" value={form.showStatus} onChange={(e) => set('showStatus', Number(e.target.value))}><option value={1}>启用</option><option value={0}>隐藏</option></select></label><label>品牌图片地址<input className="input" value={form.logo} onChange={(e) => set('logo', e.target.value)} /></label><label>上传品牌图片<input type="file" accept="image/png,image/jpeg" onChange={uploadLogo} /></label></>}
        {kind === 'attrs' && <><label>属性类型<select aria-label="属性类型" className="input" disabled={!!editing} value={form.attrType} onChange={(e) => set('attrType', Number(e.target.value))}><option value={1}>基础参数</option><option value={0}>销售属性</option></select></label>{Number(form.attrType) === 1 && <CatalogSelect key={form.catelogId} kind="groups" label="属性分组" value={form.attrGroupId} catalogId={form.catelogId} disabled={busy || loading || stale || unknown || !form.catelogId} required onChange={value => set('attrGroupId', value ? Number(value) : '')} />}<label>可选值（用分号分隔）<input className="input" maxLength={255} value={form.valueSelect || ''} onChange={(e) => set('valueSelect', e.target.value)} /></label><label>属性状态<select aria-label="属性状态" className="input" value={form.enable} onChange={(e) => set('enable', Number(e.target.value))}><option value={1}>启用</option><option value={0}>停用</option></select></label></>}
      </div><div className="admin-actions"><button className="btn btn-primary">{busy ? '正在保存…' : '保存基础资料'}</button><button type="button" className="btn btn-outline" onClick={() => guard.request(reset)}>取消编辑</button></div></fieldset></form>
      {pendingDelete && <div className="admin-confirm" role="alert">确认删除“{pendingDelete.name || pendingDelete.attrName || pendingDelete.attrGroupName}”？已被商品使用的资料不能删除。<div className="admin-actions"><button className="btn btn-primary" disabled={busy || loading || stale || unknown || loadedQuery !== query} onClick={() => guard.request(remove, editing === pendingDelete[keys[kind]] && formSignature(form, Object.keys(empty())) !== baseline.current)}>确认删除</button><button className="btn btn-outline" disabled={busy || loading || stale || unknown || loadedQuery !== query} onClick={() => setPendingDelete(null)}>取消</button></div></div>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>编号</th><th>名称</th><th>分类 / 状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row[keys[kind]]}><td>{row[keys[kind]]}{focused === row[keys[kind]] && <span> · 当前定位</span>}</td><td>{row.name || row.attrGroupName || row.attrName}{kind === 'categories' && <p className="admin-note">{row.path}</p>}</td><td>{kind === 'categories' ? `${row.catLevel} 级 · 父分类 #${row.parentCid}` : kind === 'brands' ? row.showStatus === 1 ? '启用' : '隐藏' : (categories.find((c) => c.catId === row.catelogId)?.path || '分类名称未加载') + ' · #' + row.catelogId}{kind === 'attrs' && ` · ${row.attrType === 1 ? '参数' : '销售'} · ${Number(row.enable) === 1 ? '启用' : '停用'}`}</td><td><button className="btn btn-outline" disabled={busy || loading || stale || unknown || loadedQuery !== query} onClick={() => edit(row)}>编辑</button><button className="btn btn-outline" disabled={busy || loading || stale || unknown || loadedQuery !== query} onClick={() => setPendingDelete(row)}>删除</button></td></tr>)}{!rows.length && <tr><td colSpan={4}>{loading || stale || loadedQuery !== query ? '查询结果尚未确认，请等待或重新加载。' : '没有匹配的资料，请调整条件或新增。'}</td></tr>}</tbody></table></div><div className="pagination" aria-label="基础资料分页"><button disabled={page <= 1 || busy} onClick={() => changeQuery({ page: String(page - 1) })}>上一页</button><span>第 {page} / {pages} 页</span><button disabled={page >= pages || busy} onClick={() => changeQuery({ page: String(page + 1) })}>下一页</button></div>
    </>}
  </section>
}
