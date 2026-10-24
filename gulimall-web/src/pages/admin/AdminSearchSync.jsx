import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSearchSync, retrySearchSync, rebuildSearch } from '../../api/admin'

export default function AdminSearchSync() {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    listSearchSync({ page, limit: 20 }).then((res) => { if (active) setResult(res.page) }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, reload])
  const run = async (action, message) => {
    setBusy(true); setError(''); setNotice('')
    try { const res = await action(); setNotice(message || res.msg) }
    catch (e) { setError(e.message) }
    finally { setBusy(false); setReload((r) => r + 1) }
  }
  return <section>
    <div className="admin-toolbar"><h2>搜索同步与索引重建</h2><Link to="/admin/products">返回商品</Link><button className="btn btn-outline" disabled={busy} onClick={() => { setError(''); setReload(reload + 1) }}>刷新结果</button><button className="btn btn-primary" disabled={busy} onClick={() => run(rebuildSearch)}>从商品库全量重建</button></div>
    <p className="admin-note">全量重建会为全部商品持久化同步任务，补建丢失的索引、覆盖已上架商品并移除下架商品。提交任务后请刷新，全部显示“已同步”才表示完成。失败约 30 秒后自动重试；库存状态会定期刷新，购买时仍实时校验。</p>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {loading ? <p role="status">正在加载同步记录…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>商品 / 目标状态</th><th>同步状态</th><th>版本 / 尝试次数</th><th>最近结果</th><th>操作</th></tr></thead><tbody>{result?.list.map((job) => <tr key={job.spu_id}><td>#{job.spu_id} · {job.spu_name}<br />{job.publish_status === 1 ? '上架' : '下架'}</td><td>{['待同步', '已同步', '失败待重试'][job.state]}</td><td>{job.version} / {job.attempts}</td><td>{job.last_error || (job.state === 1 ? '同步成功' : '等待执行')}</td><td><button className="btn btn-outline" disabled={busy} onClick={() => run(() => retrySearchSync(job.spu_id), '此商品已重新同步。')}>立即同步</button></td></tr>)}{!result?.list.length && <tr><td colSpan={5}>暂无同步任务，可从商品库全量重建。</td></tr>}</tbody></table></div>}
    <div className="pagination"><button disabled={busy || loading || page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(result?.totalPage || 1, 1)} 页</span><button disabled={busy || loading || page >= (result?.totalPage || 1)} onClick={() => setPage(page + 1)}>下一页</button></div>
  </section>
}
