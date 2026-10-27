import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteCatalog, getCatalog, saveCatalog, uploadImage } from '../../api/admin'
import { leafCategories } from '../../utils/product'

const names = { categories: '分类', brands: '品牌', groups: '属性分组', attrs: '属性' }
const keys = { categories: 'catId', brands: 'brandId', groups: 'attrGroupId', attrs: 'attrId' }
const empty = () => ({ name: '', sort: 0, catLevel: 1, parentCid: 0, catelogId: '', firstLetter: 'A', logo: '', showStatus: 1, attrType: 1, attrGroupId: '', enable: 1, valueSelect: '' })
const flatten = (tree) => tree.flatMap((c) => [c, ...flatten(c.children || [])])

export default function AdminCatalog() {
  const [kind, setKind] = useState('categories')
  const [meta, setMeta] = useState(null)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [stale, setStale] = useState(false), [unknown, setUnknown] = useState(false), working = useRef(false)
  useEffect(() => {
    let active = true
    getCatalog().then((res) => { if (active) { setMeta(res.data); setStale(false); setError('') } }).catch((e) => { if (active) { setError(e.message); setStale(true) } })
    return () => { active = false }
  }, [retry])
  const categories = meta ? flatten(meta.categories) : []
  const leaves = meta ? leafCategories(meta.categories) : []
  const rows = !meta ? [] : kind === 'categories' ? categories : meta[kind]
  const set = (name, value) => setForm({ ...form, [name]: value })
  const reset = () => { setForm(empty()); setEditing(null); setPendingDelete(null) }
  const edit = (row) => {
    setForm({ ...empty(), ...row, name: row.name || row.attrGroupName || row.attrName, attrGroupId: kind === 'attrs' ? meta.relations.find((r) => r.attrId === row.attrId)?.attrGroupId || '' : row.attrGroupId })
    setEditing(row[keys[kind]]); setNotice(''); setError('')
  }
  const submit = async (event) => {
    event.preventDefault()
    if (working.current || stale || unknown) return
    working.current = true; setBusy(true); setError(''); setNotice('')
    let saved = false
    try {
      let data
      if (kind === 'categories') data = { catId: editing, name: form.name, catLevel: Number(form.catLevel), parentCid: Number(form.parentCid), sort: Number(form.sort) }
      if (kind === 'brands') data = { brandId: editing, name: form.name, firstLetter: form.firstLetter, logo: form.logo, sort: Number(form.sort), showStatus: Number(form.showStatus) }
      if (kind === 'groups') data = { attrGroupId: editing, attrGroupName: form.name, catelogId: Number(form.catelogId), sort: Number(form.sort) }
      if (kind === 'attrs') data = { attrId: editing, attrName: form.name, catelogId: Number(form.catelogId), attrType: Number(form.attrType), attrGroupId: Number(form.attrGroupId) || null, enable: Number(form.enable), valueSelect: form.valueSelect }
      const response = await saveCatalog(kind, data); saved = true; setEditing(response.id || editing)
      setMeta((await getCatalog()).data); setStale(false); reset(); setNotice(`${names[kind]}已保存。`)
    } catch (e) {
      if (saved) { setStale(true); setError('资料已保存，但列表刷新失败，请重新加载核对；当前表单已绑定原编号。') }
      else { setUnknown(!editing && (!e.status || e.status >= 500)); setError(`${e.message} 请先刷新核对原操作结果。`) }
    } finally { working.current = false; setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError('')
    try { await deleteCatalog(kind, pendingDelete[keys[kind]]); setMeta((await getCatalog()).data); reset(); setNotice('已删除。') }
    catch (e) { setError(`${e.message} 删除结果请重新加载核对。`) }
    finally { setBusy(false); setPendingDelete(null) }
  }
  const uploadLogo = async (event) => {
    const input = event.currentTarget, file = input.files?.[0]
    if (!file) return
    setBusy(true); setError('')
    try { const result = await uploadImage(file); setForm((current) => ({ ...current, logo: result.url })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false); input.value = '' }
  }
  return <section>
    <div className="admin-toolbar"><h2>商品基础资料</h2><Link to="/admin/products">返回商品列表</Link><button className="btn btn-outline" disabled={busy} onClick={() => setRetry(retry + 1)}>刷新基础资料</button></div>
    <div className="admin-actions" role="group" aria-label="基础资料类型">{Object.entries(names).map(([value, label]) => <button key={value} disabled={busy || stale || unknown} className={`btn ${kind === value ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setKind(value); reset(); setError(''); setNotice('') }}>{label}</button>)}</div>
    {error && <p className="error-msg" role="alert">{error} <button className="btn btn-outline" disabled={busy} onClick={() => setRetry(retry + 1)}>重新加载资料</button></p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {stale && meta && <p role="status">当前显示上次成功加载的基础资料，重新加载成功前暂停修改。</p>}
    {unknown && <div className="admin-confirm" role="status">本次新增结果未知，原输入已保留。请重新加载列表核对后，再决定是否放弃表单。<button className="btn btn-outline" disabled={busy} onClick={() => { reset(); setUnknown(false); setError('') }}>已核对，放弃本次资料表单</button></div>}
    {!meta ? <p role="status">正在加载基础资料…</p> : <>
      <form className="admin-form" onSubmit={submit}><fieldset disabled={busy || stale || unknown}><legend>{editing ? `编辑${names[kind]} #${editing}` : `新增${names[kind]}`}</legend><div className="admin-form-grid">
        <label>{names[kind]}名称<input className="input" required maxLength={50} value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        {kind === 'categories' && <><label>分类层级<select aria-label="分类层级" className="input" disabled={!!editing} value={form.catLevel} onChange={(e) => setForm({ ...form, catLevel: Number(e.target.value), parentCid: '' })}><option value={1}>一级</option><option value={2}>二级</option><option value={3}>三级</option></select></label><label>父分类<select aria-label="父分类" className="input" required disabled={!!editing} value={Number(form.catLevel) === 1 ? '0' : form.parentCid} onChange={(e) => set('parentCid', Number(e.target.value))}>{Number(form.catLevel) === 1 ? <option value={0}>无</option> : <><option value="">请选择</option>{categories.filter((c) => c.catLevel === Number(form.catLevel) - 1).map((c) => <option key={c.catId} value={c.catId}>{c.name} · {c.catId}</option>)}</>}</select></label></>}
        {['groups', 'attrs'].includes(kind) && <label>所属三级分类<select aria-label="所属三级分类" className="input" required disabled={!!editing} value={form.catelogId} onChange={(e) => setForm({ ...form, catelogId: Number(e.target.value), attrGroupId: '' })}><option value="">请选择</option>{leaves.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
        {kind !== 'attrs' && <label>排序<input className="input" type="number" required min={0} max={100000} value={form.sort} onChange={(e) => set('sort', e.target.value)} /></label>}
        {kind === 'brands' && <><label>首字母<input className="input" required maxLength={1} pattern="[A-Za-z]" value={form.firstLetter} onChange={(e) => set('firstLetter', e.target.value)} /></label><label>品牌状态<select aria-label="品牌状态" className="input" value={form.showStatus} onChange={(e) => set('showStatus', Number(e.target.value))}><option value={1}>启用</option><option value={0}>隐藏</option></select></label><label>品牌图片地址<input className="input" value={form.logo} onChange={(e) => set('logo', e.target.value)} /></label><label>上传品牌图片<input type="file" accept="image/png,image/jpeg" onChange={uploadLogo} /></label></>}
        {kind === 'attrs' && <><label>属性类型<select aria-label="属性类型" className="input" disabled={!!editing} value={form.attrType} onChange={(e) => set('attrType', Number(e.target.value))}><option value={1}>基础参数</option><option value={0}>销售属性</option></select></label>{Number(form.attrType) === 1 && <label>属性分组<select aria-label="属性分组" className="input" required value={form.attrGroupId} onChange={(e) => set('attrGroupId', Number(e.target.value))}><option value="">请选择</option>{meta.groups.filter((g) => g.catelogId === Number(form.catelogId)).map((g) => <option key={g.attrGroupId} value={g.attrGroupId}>{g.attrGroupName}</option>)}</select></label>}<label>可选值（用分号分隔）<input className="input" maxLength={255} value={form.valueSelect || ''} onChange={(e) => set('valueSelect', e.target.value)} /></label><label>属性状态<select aria-label="属性状态" className="input" value={form.enable} onChange={(e) => set('enable', Number(e.target.value))}><option value={1}>启用</option><option value={0}>停用</option></select></label></>}
      </div><div className="admin-actions"><button className="btn btn-primary">{busy ? '正在保存…' : '保存基础资料'}</button><button type="button" className="btn btn-outline" onClick={reset}>取消编辑</button></div></fieldset></form>
      {pendingDelete && <div className="admin-confirm" role="alert">确认删除“{pendingDelete.name || pendingDelete.attrName || pendingDelete.attrGroupName}”？已被商品使用的资料不能删除。<div className="admin-actions"><button className="btn btn-primary" disabled={busy || stale || unknown} onClick={remove}>确认删除</button><button className="btn btn-outline" disabled={busy || stale || unknown} onClick={() => setPendingDelete(null)}>取消</button></div></div>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>编号</th><th>名称</th><th>分类 / 状态</th><th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row[keys[kind]]}><td>{row[keys[kind]]}</td><td>{row.name || row.attrGroupName || row.attrName}</td><td>{kind === 'categories' ? `${row.catLevel} 级` : kind === 'brands' ? row.showStatus === 1 ? '启用' : '隐藏' : categories.find((c) => c.catId === row.catelogId)?.name}{kind === 'attrs' && ` · ${row.attrType === 1 ? '参数' : '销售'} · ${Number(row.enable) === 1 ? '启用' : '停用'}`}</td><td><button className="btn btn-outline" disabled={busy || stale || unknown} onClick={() => edit(row)}>编辑</button><button className="btn btn-outline" disabled={busy || stale || unknown} onClick={() => setPendingDelete(row)}>删除</button></td></tr>)}{!rows.length && <tr><td colSpan={4}>暂无资料，请先新增。</td></tr>}</tbody></table></div>
    </>}
  </section>
}
