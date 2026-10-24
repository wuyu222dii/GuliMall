import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts, publishProduct } from '../../api/admin'

export default function AdminProducts() {
  const [page, setPage] = useState(1)
  const [key, setKey] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const publish = async (product) => {
    setBusy(true); setNotice(''); setActionError('')
    try { await publishProduct(product.id, product.publishStatus === 1 ? 0 : 1); setNotice('目标状态与搜索索引已同步。') }
    catch (e) { setActionError(e.message) }
    finally { setBusy(false); setRetry((value) => value + 1) }
  }
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    listProducts({ page, limit: 20, key: query }).then((res) => { if (active) setResult(res.page) })
      .catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, query, retry])
  return <section>
    <div className="admin-toolbar"><h2>商品列表</h2><Link className="btn btn-outline" to="/admin/products/sync">同步与索引重建</Link><Link className="btn btn-outline" to="/admin/products/catalog">分类、品牌与属性</Link><Link className="btn btn-primary" to="/admin/products/new">新建商品</Link></div>
    <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(key.trim()); setRetry(retry + 1) }}>
      <label>商品名称或 SPU 编号<input className="input" value={key} maxLength={100} onChange={(e) => setKey(e.target.value)} /></label><button className="btn btn-outline">查询</button>
    </form>
    {notice && <p className="admin-notice" role="status">{notice}</p>}{actionError && <p className="error-msg" role="alert">{actionError} <Link to="/admin/products/sync">查看同步任务</Link></p>}
    {error && <p className="error-msg" role="alert">{error} <button className="btn btn-outline" onClick={() => setRetry(retry + 1)}>重试</button></p>}
    {loading ? <p role="status">正在加载商品…</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>SPU 编号</th><th>商品名称</th><th>分类 / 品牌编号</th><th>状态</th><th>操作</th></tr></thead><tbody>
      {(result?.list || []).map((product) => <tr key={product.id}><td>{product.id}</td><td>{product.spuName}</td><td>{product.catalogId} / {product.brandId}</td><td>{product.publishStatus === 1 ? '已上架' : '草稿 / 已下架'}</td><td><Link to={`/admin/products/${product.id}/edit`}>编辑 SPU / SKU</Link> <button className="btn btn-outline" disabled={busy} onClick={() => publish(product)}>{product.publishStatus === 1 ? '下架' : '上架'}</button></td></tr>)}
      {!result?.list?.length && <tr><td colSpan={5}>没有符合条件的商品。</td></tr>}
    </tbody></table></div>}
    <div className="pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>上一页</button><span>第 {page} / {Math.max(result?.totalPage || 1, 1)} 页</span><button disabled={page >= (result?.totalPage || 1) || loading} onClick={() => setPage(page + 1)}>下一页</button></div>
    <p className="admin-note">新商品保存为草稿。上下架会同步搜索索引；失败任务自动重试，可在同步页面查看结果。营销字段不启用。</p>
  </section>
}
