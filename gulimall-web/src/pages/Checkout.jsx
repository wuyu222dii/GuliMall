import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmOrder, submitOrder, getSubmission, retireConfirmation } from '../api/order'
import { useCartStore } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { orderStatuses, canStartNewConfirmation } from '../utils/payment'

export default function Checkout() {
  const user = useAuthStore((s) => s.user)
  const selected = useCartStore((s) => s.selected)
  const [confirmation, setConfirmation] = useState(null)
  const [addressId, setAddressId] = useState(null)
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [params, setParams] = useSearchParams()
  const confirmationToken = params.get('confirmation')
  const key = `gulimall-checkout:${user.id}`
  const submitted = !!attempt && attempt.submitted !== false

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setConfirmation(null); setResult(null); setAttempt(null)
    ;(async () => {
      try {
        if (confirmationToken && (params.getAll('confirmation').length !== 1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(confirmationToken))) throw new Error('确认地址无效，请返回购物车重新确认。')
        const stored = JSON.parse(sessionStorage.getItem(key) || 'null')
        const saved = confirmationToken ? stored?.token === confirmationToken ? stored : { token: confirmationToken, submitted: false } : stored
        let current
        if (saved) {
          setAttempt(saved)
          const res = await getSubmission(user.id, saved.token)
          if (!active) return
          if (res.result.order) {
            if (!confirmationToken) setParams({ confirmation: saved.token }, { replace: true })
            const committed = { ...saved, submitted: true }
            sessionStorage.setItem(key, JSON.stringify(committed)); setAttempt(committed); setResult(res.result); return
          }
          current = res.result.confirmation
        } else {
          await selected()
          current = (await confirmOrder(user.id)).confirmation
        }
        if (!active) return
        const initialAddress = saved?.addressId || current.addresses.find((a) => a.defaultStatus === 1)?.id || current.addresses[0]?.id || null
        if (!saved || saved.submitted === false) {
          const draft = { token: current.token, addressId: initialAddress, submitted: false }
          sessionStorage.setItem(key, JSON.stringify(draft)); setAttempt(draft)
        }
        if (!confirmationToken) setParams({ confirmation: current.token }, { replace: true })
        setConfirmation(current)
        setAddressId(initialAddress)
      } catch (e) { if (active) setError(e.message) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [key, user.id, retry, selected, confirmationToken, params, setParams])

  useEffect(() => {
    if (!attempt || ![6, 7].includes(result?.order?.status)) return
    let active = true
    const timer = setInterval(() => {
      getSubmission(user.id, attempt.token).then((res) => { if (active) { setResult(res.result); setError(''); useCartStore.getState().refresh() } }).catch((e) => { if (active) setError(e.message) })
    }, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [attempt, result?.order?.status, user.id])

  const submit = async () => {
    if (busy || !addressId || !confirmation) return
    setBusy(true); setError('')
    const request = { token: attempt?.token || confirmation.token, addressId: submitted ? attempt.addressId : addressId, submitted: true }
    try {
      sessionStorage.setItem(key, JSON.stringify(request)); setAttempt(request)
      const res = await submitOrder(user.id, request.token, request.addressId)
      if (useAuthStore.getState().user?.id !== user.id) return
      setResult(res.result); await useCartStore.getState().refresh()
    } catch (e) { setError(`${e.message} 请查询原提交或重试同一请求，避免创建第二笔订单。`) }
    finally { setBusy(false) }
  }
  const startNew = () => { sessionStorage.removeItem(key); setParams({}, { replace: true }); setRetry((value) => value + 1) }
  const selectAddress = (id) => {
    setAddressId(id)
    if (attempt?.submitted === false) {
      const draft = { ...attempt, addressId: id }
      sessionStorage.setItem(key, JSON.stringify(draft)); setAttempt(draft)
    }
  }
  const replace = async () => {
    setBusy(true); setError('')
    try {
      const res = await retireConfirmation(user.id, attempt.token)
      if (useAuthStore.getState().user?.id !== user.id) return
      if (res.result.order) setResult(res.result)
      else startNew()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div className="container catalog-page">
    <h1 className="page-title">确认订单</h1>
    {error && <p className="error-msg" role="alert">{error}</p>}
    {loading ? <p role="status">正在核对原提交、最新价格和地址…</p> : result?.order ? <section className="card order-summary">
      <h2>{orderStatuses[result.order.status] || '订单已保存'}</h2>
      <p className="order-number">订单号： {result.order.orderSn}</p>
      <p>应付合计： <strong className="price">¥{Number(result.order.payAmount).toFixed(2)}</strong></p>
      <p>{result.order.receiverName} · {result.order.receiverProvince}{result.order.receiverCity}{result.order.receiverRegion} {result.order.receiverDetailAddress}</p>
      {result.items.map((item) => <p key={item.skuId}>{item.skuName} × {item.skuQuantity} — ¥{Number(item.realAmount).toFixed(2)}</p>)}
      {result.order.status === 0 && <p className="purchase-notice">库存已锁定，请在付款期限内付款或查询结果。</p>}
      {[6, 7].includes(result.order.status) && <p role="status">服务端正在确认库存结果，重启后会继续恢复，本次请求保持同一订单号。</p>}
      {result.order.status === 4 && <p>{result.order.failureReason}</p>}
      {[0, 1, 4, 8, 9].includes(result.order.status) && <p><Link className="btn btn-primary" to={`/payment/${result.order.orderSn}`}>付款 / 库存状态</Link></p>}
      <div className="admin-toolbar"><Link className="btn btn-primary" to="/member/orders">我的订单</Link><Link className="btn btn-outline" to="/cart">查看购物车</Link>{canStartNewConfirmation(result.order.status) && <button className="btn btn-outline" onClick={startNew}>开始下一次确认</button>}</div>
    </section> : confirmation && <>
      <section className="card order-summary"><h2>收货地址</h2>
        {confirmation.addresses.length ? <fieldset disabled={busy || submitted}><legend className="admin-note">请选择本人收货地址</legend>{confirmation.addresses.map((address) => <label className="order-address" key={address.id}><input type="radio" name="order-address" checked={addressId === address.id} onChange={() => selectAddress(address.id)} /><span>{address.name} · {address.phone}<br />{address.province}{address.city}{address.region} {address.detailAddress}</span></label>)}</fieldset> : <Link to="/member/address">添加收货地址后刷新本次确认。</Link>}
      </section>
      <section className="card order-summary"><h2>订单商品</h2>{confirmation.items.map((item) => <p key={item.skuId}>{item.skuName} × {item.count} — ¥{(Number(item.price) * item.count).toFixed(2)}</p>)}<p className="admin-note">运费 ¥0.00，确认有效期至 {new Date(confirmation.expiresAt).toLocaleString('zh-CN')}. 提交前会再次校验价格。</p>{!submitted && <p className="admin-note">本次确认会在刷新或复制标签页后保留。购物车有变动时，可使用下方“安全替换确认信息”。</p>}</section>
      <div className="cart-footer"><span>应付合计： <strong className="price">¥{Number(confirmation.totalAmount).toFixed(2)}</strong></span><button className="btn btn-primary btn-lg" disabled={busy || !addressId} onClick={submit}>{busy ? '正在提交…' : submitted ? '重试原提交' : '提交订单'}</button></div>
    </>}
    <div className="admin-toolbar"><button className="btn btn-outline" disabled={busy || loading} onClick={() => setRetry((value) => value + 1)}>{submitted ? '查询原提交' : '刷新确认信息'}</button><Link to="/cart">返回购物车</Link></div>
    {attempt && !result && <button className="btn btn-outline" disabled={busy || loading} onClick={replace}>安全替换确认信息</button>}
  </div>
}
