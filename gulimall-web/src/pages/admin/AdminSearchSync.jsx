import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listSearchSync, retrySearchSync, rebuildSearch } from '../../api/admin'
import { orderTime } from '../../utils/order'
import { adminQuery, syncProductListUrl } from '../../utils/admin'

export default function AdminSearchSync() {
  const [params, setParams] = useSearchParams(), query = params.toString()
  const parsed = useMemo(() => { try { return { values: adminQuery('sync', query), listUrl: syncProductListUrl(query), error: '' } } catch (e) { return { values: adminQuery('sync', ''), listUrl: '/admin/products', error: e.message } } }, [query])
  const listUrl = parsed.listUrl, suffix = listUrl.slice('/admin/products'.length), page = Number(parsed.values.syncPage)
  const [fields, setFields] = useState({ spuId: '', state: '' })
  const [result, setResult] = useState(null), [error, setError] = useState(''), [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), working = useRef(false), [loading, setLoading] = useState(true), [reload, setReload] = useState(0)
  const changeQuery = useCallback((patch, replace = false) => { const next = new URLSearchParams(query); for (const [key, value] of Object.entries(patch)) { if (value === '') next.delete(key); else next.set(key, String(value)) } setParams(next, { replace }) }, [query, setParams])
  useEffect(() => { setFields({ spuId: parsed.values.syncSpuId, state: parsed.values.syncState }) }, [parsed])
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setResult(null)
    if (parsed.error) { setError(parsed.error); setLoading(false); return }
    listSearchSync({ page, limit: 20, spuId: parsed.values.syncSpuId, state: parsed.values.syncState }).then(res => { if (active) { if (page > Math.max(1, res.page.totalPage)) changeQuery({ syncPage: Math.max(1, res.page.totalPage) }, true); else setResult(res.page) } }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [parsed, page, changeQuery, reload])
  const run = async (action, message) => {
    if (working.current) return
    working.current = true; setBusy(true); setActionError(''); setNotice('')
    try { const res = await action(); setNotice(message || res.msg) }
    catch (e) { setActionError(e.message) }
    finally { working.current = false; setBusy(false); setReload(v => v + 1) }
  }
  return <section>
    <div className="admin-toolbar"><h2>搜索同步与索引重建</h2><Link to={listUrl}>返回商品</Link><button className="btn btn-outline" disabled={busy} onClick={() => setReload(v => v + 1)}>刷新结果</button><button className="btn btn-primary" disabled={busy} onClick={() => run(rebuildSearch)}>从商品库全量重建</button></div>
    <p className="admin-note">同步任务可按商品编号和同步状态筛选，原商品列表条件仅用于返回。全量重建会持久化任务；提交后请刷新核对，不能将任务提交当作同步完成。失败约 30 秒后重试，购买时仍实时校验库存。</p>
    <form className="admin-search" onSubmit={event => { event.preventDefault(); changeQuery({ syncSpuId: fields.spuId.trim(), syncState: fields.state, syncPage: '1' }); setReload(v => v + 1) }}>
      <label>精确 SPU 编号<input className="input" maxLength={18} inputMode="numeric" pattern="[1-9][0-9]*" value={fields.spuId} onChange={e => setFields({ ...fields, spuId: e.target.value })} /></label>
      <label>同步状态筛选<select aria-label="同步状态筛选" className="input" value={fields.state} onChange={e => setFields({ ...fields, state: e.target.value })}><option value="">全部状态</option><option value="0">待同步</option><option value="1">已同步</option><option value="2">失败待重试</option></select></label>
      <button className="btn btn-primary" disabled={busy}>查询同步任务</button><button type="button" className="btn btn-outline" disabled={busy} onClick={() => changeQuery({ syncSpuId: '', syncState: '', syncPage: '1' })}>清除同步条件</button>
      {parsed.error && <button type="button" className="btn btn-outline" onClick={() => setParams({})}>清除无效查询</button>}
    </form>
    {error && <p className="error-msg" role="alert">同步记录查询失败：{error} 请刷新结果；不能据此判断没有任务。</p>}{actionError && <p className="error-msg" role="alert">{actionError}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {loading ? <p role="status">正在加载同步记录…</p> : result && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>商品 / 目标状态</th><th>同步状态</th><th>版本 / 尝试次数</th><th>下次重试 / 最近更新</th><th>最近结果</th><th>操作</th></tr></thead><tbody>{result.list.map(job => <tr key={job.spu_id}><td>#{job.spu_id} · {job.spu_name}<br />{job.publish_status === 1 ? '上架' : '下架'}</td><td>{['待同步', '已同步', '失败待重试'][job.state] || '未知状态'}</td><td>{job.version} / {job.attempts}</td><td>{job.state === 1 ? '已同步，无失败重试' : orderTime(job.next_attempt)}<p>更新：{orderTime(job.updated_at)}</p></td><td>{job.last_error || (job.state === 1 ? '同步成功' : '等待执行')}</td><td><Link className="btn btn-outline" to={'/admin/products/' + job.spu_id + '/edit' + suffix}>编辑商品 {job.spu_id}</Link><button className="btn btn-outline" disabled={busy || loading || !!error} onClick={() => run(() => retrySearchSync(job.spu_id), '此商品已重新同步。')}>立即同步</button></td></tr>)}{!result.list.length && <tr><td colSpan={6}>暂无同步任务，可从商品库全量重建。</td></tr>}</tbody></table></div>}
    <div className="pagination"><button disabled={busy || loading || !!error || page <= 1} onClick={() => changeQuery({ syncPage: String(page - 1) })}>上一页</button><span>第 {page} / {Math.max(result?.totalPage || 1, 1)} 页</span><button disabled={busy || loading || !!error || page >= (result?.totalPage || 1)} onClick={() => changeQuery({ syncPage: String(page + 1) })}>下一页</button></div>
  </section>
}
