import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IMAGE_FALLBACK, productImage } from '../utils/product'
import { useCartStore } from '../store/cartStore'
import { validQuantity } from '../utils/cart'

export default function Cart() {
  const navigate = useNavigate()
  const { owner, items, loading, busy, error, pendingCount, totalAmount, readyToCheckout, refresh, updateCount, setChecked, setAllChecked, removeItem, clearCart, selected } = useCartStore()
  const [checking, setChecking] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [quantities, setQuantities] = useState({}), [clearOpen, setClearOpen] = useState(false)
  useEffect(() => { refresh() }, [owner, refresh])
  useEffect(() => { setQuantities({}); setClearOpen(false) }, [owner])
  const act = (action) => { setCheckoutError(''); action().catch((e) => setCheckoutError(e.message)) }
  const draft = item => quantities[item.skuId] !== undefined && quantities[item.skuId] !== String(item.count)
  const hasDraft = items.some(draft), allChecked = items.length > 0 && items.every(item => item.checked !== false)
  const applyQuantity = async item => {
    const count = Number(quantities[item.skuId] ?? item.count); validQuantity(count)
    await updateCount(item.skuId, count)
    setQuantities(previous => { const next = { ...previous }; delete next[item.skuId]; return next })
  }
  const checkout = async () => {
    if (owner === 'guest') { navigate('/login?redirect=%2Fcart'); return }
    setChecking(true); setCheckoutError('')
    try { await selected(); navigate('/checkout') }
    catch (e) { setCheckoutError(e.message) }
    finally { setChecking(false) }
  }
  const disabled = loading || busy || checking
  return <div className="container catalog-page">
    <div className="admin-toolbar"><h1 className="page-title">我的购物车</h1><button className="btn btn-outline" disabled={disabled} onClick={() => act(async () => { if (await refresh()) setQuantities({}) })}>刷新购物车 / 重试合并</button></div>
    {owner === 'guest' && <p className="purchase-notice">访客购物车保存在本浏览器，登录后会幂等合并到会员购物车。</p>}
    {pendingCount > 0 && <p className="purchase-notice" role="status">{pendingCount} 件访客商品等待合并，本地副本已保留。超出容量时请先调整数量或移除服务端商品，再重试；不会合并到其他账号。</p>}
    {(error || checkoutError) && <p className="error-msg" role="alert">{error || checkoutError} 界面保留已有条目，服务端结果请刷新核对。</p>}
    {hasDraft && <p role="status">数量有修改，请先更新数量，或刷新购物车恢复服务端结果，再结算。</p>}
    {loading && <p role="status">正在刷新价格、可售状态和购物车…</p>}
    {busy && !loading && <p role="status">正在保存购物车修改，请勿重复操作…</p>}
    {!items.length && !loading && !error && !pendingCount && <div className="empty-state card"><p>购物车为空</p><Link className="btn btn-primary" to="/search">去选购</Link></div>}
    {!!items.length && <>
      <div className="admin-table-wrap"><table className="cart-table"><thead><tr><th><label><input type="checkbox" aria-label="全选购物车商品" checked={allChecked} ref={node => { if (node) node.indeterminate = !allChecked && items.some(item => item.checked !== false) }} disabled={disabled} onChange={e => act(() => setAllChecked(e.target.checked))} />全选</label></th><th>商品 / 可售状态</th><th>单价</th><th>数量</th><th>小计</th><th>操作</th></tr></thead><tbody>
        {items.map((item) => <tr key={item.skuId}>
          <td><input type="checkbox" aria-label={`勾选 SKU ${item.skuId}`} checked={item.checked !== false} disabled={disabled} onChange={(e) => act(() => setChecked(item.skuId, e.target.checked))} /></td>
          <td><div className="cart-product"><img src={productImage(item.skuDefaultImg)} alt="" onError={(e) => { if (e.currentTarget.getAttribute('src') !== IMAGE_FALLBACK) e.currentTarget.src = IMAGE_FALLBACK }} /><div><Link to={`/product/${item.skuId}`}>{item.skuName}</Link><p className={item.status === 'AVAILABLE' && !error ? 'admin-note' : 'error-msg'}>{error ? '请刷新后确认' : item.message || '请刷新价格后确认'}</p></div></div></td>
          <td className="price">{loading || error || item.price == null ? '暂不可用' : `¥${Number(item.price).toFixed(2)}`}</td>
          <td><div className="qty-control"><button aria-label={`减少 SKU ${item.skuId}`} disabled={disabled || draft(item) || item.count <= 1} onClick={() => act(() => updateCount(item.skuId, item.count - 1))}>−</button><input aria-label={`数量 SKU ${item.skuId}`} type="number" min="1" max="999" step="1" disabled={disabled} value={quantities[item.skuId] ?? item.count} onChange={e => setQuantities({ ...quantities, [item.skuId]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); act(() => applyQuantity(item)) } }} /><button aria-label={`增加 SKU ${item.skuId}`} disabled={disabled || draft(item) || item.count >= 999} onClick={() => act(() => updateCount(item.skuId, item.count + 1))}>+</button></div><button className="btn btn-outline" aria-label={`更新数量 SKU ${item.skuId}`} disabled={disabled || !draft(item)} onClick={() => act(() => applyQuantity(item))}>更新数量</button></td>
          <td className="price">{loading || error || item.price == null ? '暂不可用' : `¥${(Number(item.price) * item.count).toFixed(2)}`}</td>
          <td><button className="btn btn-outline" aria-label={`移除 SKU ${item.skuId}`} disabled={disabled} onClick={() => act(() => removeItem(item.skuId))}>移除</button></td>
        </tr>)}
      </tbody></table></div>
      <div className="cart-footer"><button className="btn btn-outline" disabled={disabled} onClick={() => setClearOpen(true)}>{pendingCount ? '清空已保存购物车并重试合并' : '清空购物车'}</button><div className="cart-total">已选合计： <span className="price">{loading || error || totalAmount == null ? '暂不可用' : `¥${Number(totalAmount).toFixed(2)}`}</span></div><button className="btn btn-primary btn-lg" disabled={disabled || hasDraft || !readyToCheckout || pendingCount > 0} onClick={checkout}>{checking ? '正在校验商品…' : owner === 'guest' ? '登录后结算' : '结算已选商品'}</button></div>
    </>}
    {clearOpen && <div className="admin-confirm" role="alertdialog" aria-label="清空购物车确认"><p>确认清空当前已保存的购物车？待合并的访客副本会按原规则重试合并；订单不受影响。</p><div className="admin-actions"><button className="btn btn-primary" disabled={disabled} onClick={() => act(async () => { await clearCart(); setQuantities({}); setClearOpen(false) })}>确认清空购物车</button><button className="btn btn-outline" disabled={disabled} onClick={() => setClearOpen(false)}>保留购物车</button></div></div>}
  </div>
}
