import { create } from 'zustand'
import * as api from '../api/cart'
import { getSkuInfo } from '../api/product'
import { unavailableReason } from '../utils/product'
import { readGuest, claimGuest, acknowledgeGuest, validQuantity, cartTotals, readAdditionRequest } from '../utils/cart'

const storageKey = 'gulimall-cart'
const local = () => readGuest(localStorage.getItem(storageKey))
const saveLocal = (data) => localStorage.setItem(storageKey, JSON.stringify(data))
const additionKey = owner => 'gulimall-cart-add:' + owner
const storedAddition = owner => {
  if (owner === 'guest' || owner === 'admin') return null
  try { const reference = readAdditionRequest(sessionStorage.getItem(additionKey(owner))); return reference ? { ...reference, reviewed: false, executed: null } : null }
  catch { return { recordError: '本标签页原加购请求记录无法读取，请先核对当前购物车后明确结束记录。', reviewed: false } }
}
const forgetAddition = (owner, requestId) => {
  if (requestId) {
    const current = readAdditionRequest(sessionStorage.getItem(additionKey(owner)))
    if (current && current.requestId !== requestId) throw new Error('本标签页已有其他加购请求，请保留原记录并查询。')
  }
  sessionStorage.removeItem(additionKey(owner))
}
const locked = (action, required = false) => {
  if (navigator.locks) return navigator.locks.request(storageKey, action)
  if (required) return Promise.reject(new Error('当前浏览器无法安全合并购物车，本地副本已保留，请使用支持 Web Locks 的浏览器。'))
  return Promise.resolve().then(action)
}
let generation = 0
let flight = null
let starting = []
try { starting = local().guestItems } catch { /* Refresh presents the stored-data error without replacing it. */ }
export const useCartStore = create((set, get) => ({
  owner: 'guest', items: starting, loading: false, busy: false, error: '', pendingCount: 0,
  totalAmount: null, readyToCheckout: false, stale: false, warning: '',
  additionUnknown: null,
  activate: (user) => {
    generation++; flight = null
    const owner = !user ? 'guest' : user.admin ? 'admin' : String(user.id)
    set({ owner, items: [], loading: false, busy: false, error: '', pendingCount: 0, totalAmount: null, readyToCheckout: false, stale: false, warning: '', additionUnknown: storedAddition(owner) })
    return get().refresh()
  },
  refresh: (readOnly = false) => {
    const owner = get().owner, revision = generation
    const reconcileOnly = readOnly || !!get().additionUnknown
    if (flight?.owner === owner) return flight.promise
    if (owner === 'admin') {
      set({ items: [], loading: false, error: '请使用会员账号购物，管理员账号不使用会员购物车。', readyToCheckout: false })
      return Promise.resolve(false)
    }
    set({ loading: true, error: '', readyToCheckout: false, stale: true })
    const active = () => generation === revision && get().owner === owner
    const promise = (async () => {
      try {
        if (owner === 'guest') {
          const guest = local().guestItems
          const items = await Promise.all(guest.map(async (saved) => {
            try {
              const result = await getSkuInfo(saved.skuId)
              const reason = unavailableReason(result.item)
              return { ...saved, ...result.item.info, count: saved.count, checked: saved.checked !== false, status: reason ? 'UNAVAILABLE' : 'AVAILABLE', message: reason || '可购买' }
            } catch (e) { return { ...saved, price: null, status: e.status === 404 ? 'DELETED' : 'SERVICE_UNAVAILABLE', message: e.message } }
          }))
          if (active()) { const totals = cartTotals(items); set({ items, totalAmount: totals.totalAmount, readyToCheckout: totals.readyToCheckout, stale: false }) }
          return true
        }
        let result = await api.getCart(owner)
        if (!active()) return false
        set({ items: result.cart.items, totalAmount: result.cart.totalAmount, readyToCheckout: false })
        const addition = get().additionUnknown
        if (addition?.requestId) {
          const receipt = await api.getAddition(owner, addition.requestId)
          if (!active()) return false
          if (typeof receipt.executed !== 'boolean' || receipt.executed && (receipt.skuId !== addition.skuId || receipt.count !== addition.count)) throw new Error('原加购回执与本地记录不一致，请保留原请求并核对。')
          set({ additionUnknown: { ...addition, executed: receipt.executed } })
        }
        while (!reconcileOnly && active()) {
          const pending = local()
          if (!pending.pending[owner] && !pending.guestItems.length) break
          const batch = await locked(() => {
            const latest = local(), batch = claimGuest(latest, owner)
            saveLocal(latest); return batch
          }, true)
          if (!batch) break
          if (active()) set({ pendingCount: batch.items.reduce((sum, i) => sum + i.count, 0) })
          await api.mergeCart(owner, batch)
          await locked(() => { const latest = local(); acknowledgeGuest(latest, owner, batch.id); saveLocal(latest) }, true)
        }
        if (!reconcileOnly) result = await api.getCart(owner)
        if (active()) set({ items: result.cart.items, totalAmount: result.cart.totalAmount, readyToCheckout: result.cart.readyToCheckout, stale: false,
          pendingCount: (local().pending[owner]?.items || []).reduce((sum, item) => sum + item.count, 0),
          additionUnknown: get().additionUnknown ? { ...get().additionUnknown, reviewed: true } : null })
        return true
      } catch (e) {
        if (active()) {
          let count = 0
          try { count = (local().pending[owner]?.items || []).reduce((sum, i) => sum + i.count, 0) } catch { /* Keep the original error. */ }
          set({ error: e.message, readyToCheckout: false, totalAmount: null, pendingCount: count, stale: true })
        }
        return false
      } finally {
        if (active()) { set({ loading: false }); flight = null }
      }
    })()
    flight = { owner, promise }
    return promise
  },
  acknowledgeAddition: (confirmedEnd = false) => {
    if (!get().additionUnknown || get().loading || get().busy || confirmedEnd !== true && (!get().additionUnknown.reviewed || get().stale)) return false
    try { forgetAddition(get().owner, confirmedEnd === true ? undefined : get().additionUnknown.requestId); set({ additionUnknown: null }); return true }
    catch { set({ error: '原加购记录无法清除，请恢复浏览器存储后再核对；不会另建请求。' }); return false }
  },
  retryAddition: async () => {
    const original = get().additionUnknown, owner = get().owner, revision = generation
    if (!original?.requestId || get().busy || get().loading) throw new Error('请保留原加购记录，等待读取完成后再重试。')
    set({ busy: true, error: '', readyToCheckout: false })
    try {
      const reference = readAdditionRequest(sessionStorage.getItem(additionKey(owner)))
      if (!reference || reference.requestId !== original.requestId || reference.skuId !== original.skuId || reference.count !== original.count) throw new Error('原加购记录不一致，本次未发送，请先核对。')
      await api.addCart(owner, original.skuId, original.count, original.requestId)
      if (revision === generation) { set({ additionUnknown: { ...original, executed: true, reviewed: false } }); return await get().refresh(true) }
      return false
    } catch (e) {
      if (revision === generation) set({ error: e.message + ' 原加购请求号保持不变，请查询或重试原请求。', stale: true, totalAmount: null })
      throw e
    } finally { if (revision === generation) set({ busy: false }) }
  },
  mutate: async (remote, guest, change = {}) => {
    if (get().busy || get().loading) throw new Error('购物车同步中，请稍后重试。')
    if (get().additionUnknown || get().stale) throw new Error('请先刷新购物车并核对上次结果，再继续操作。')
    const owner = get().owner, revision = generation
    if (owner === 'admin') throw new Error('请使用会员账号购物。')
    set({ busy: true, error: '', warning: '', readyToCheckout: false })
    try {
      if (owner === 'guest') await locked(() => { const value = local(); guest(value.guestItems, value); value.guestId = crypto.randomUUID(); saveLocal(value) })
      else await remote(owner, () => revision === generation && get().owner === owner)
      if (revision === generation) return await get().refresh()
    } catch (e) {
      const addition = owner !== 'guest' && change.addition?.requestId ? change.addition : null
      const message = addition ? addition.executed ? '加购已由服务端确认，但浏览器记录未能清除；请查询原请求，勿另建请求。' : '加购结果未知，请先查看购物车核对，勿重复加购。' + e.message : change.all ? '全选未全部完成，可能已部分保存，请核对服务端勾选状态。' : e.message
      if (revision === generation) {
        set({ error: message, warning: change.all ? message : '', readyToCheckout: false, stale: true, totalAmount: null, ...(addition ? { additionUnknown: { ...addition, reviewed: false } } : {}) })
        if (change.all) await get().refresh(true)
      }
      const failure = new Error(message); failure.status = e.status; throw failure
    } finally { if (revision === generation) set({ busy: false }) }
  },
  addItem: async (sku, count = 1) => {
    validQuantity(count)
    const attempt = { skuId: sku.skuId, count }
    return get().mutate(async (owner, active) => {
      const reference = readAdditionRequest(JSON.stringify({ requestId: crypto.randomUUID(), skuId: sku.skuId, count }))
      let previous
      try { previous = sessionStorage.getItem(additionKey(owner)) }
      catch { throw new Error('浏览器无法读取原加购记录，本次未发送；请恢复存储后核对。') }
      if (previous !== null) {
        set({ additionUnknown: storedAddition(owner) }); throw new Error('原加购请求仍需核对，本次未发送新请求。')
      }
      try { sessionStorage.setItem(additionKey(owner), JSON.stringify(reference)) }
      catch { throw new Error('浏览器无法保存原加购请求，本次未发送；请恢复存储后重试。') }
      Object.assign(attempt, reference); set({ additionUnknown: { ...reference, reviewed: false, executed: null } })
      await api.addCart(owner, sku.skuId, count, reference.requestId)
      attempt.executed = true
      forgetAddition(owner, reference.requestId)
      if (active()) set({ additionUnknown: null })
    }, (items) => {
      const existing = items.find((i) => i.skuId === sku.skuId)
      if (existing) { validQuantity(existing.count + count); existing.count += count }
      else { if (items.length >= 100) throw new Error('购物车最多保存 100 个 SKU。'); items.push({ skuId: sku.skuId, skuName: sku.skuName || sku.skuTitle, skuDefaultImg: sku.skuDefaultImg, price: sku.price, count, checked: true }) }
    }, { addition: attempt })
  },
  updateCount: async (skuId, count) => { validQuantity(count); return get().mutate((owner) => api.updateCartCount(owner, skuId, count), (items) => { const item = items.find((i) => i.skuId === skuId); if (item) item.count = count }) },
  setChecked: (skuId, checked) => get().mutate((owner) => api.checkCart(owner, skuId, checked), (items) => { const item = items.find((i) => i.skuId === skuId); if (item) item.checked = checked }),
  setAllChecked: (checked) => {
    const ids = get().items.map(item => item.skuId)
    return get().mutate(async owner => { for (const id of ids) await api.checkCart(owner, id, checked) }, items => { for (const item of items) item.checked = checked }, { all: true })
  },
  removeItem: (skuId) => get().mutate((owner) => api.removeCart(owner, skuId), (items, data) => { data.guestItems = items.filter((i) => i.skuId !== skuId) }),
  clearCart: () => get().mutate(api.clearCart, (_, data) => { data.guestItems = [] }),
  selected: async () => {
    if (get().owner === 'guest' || get().owner === 'admin') throw new Error('请使用会员账号登录后结算。')
    if (get().additionUnknown) throw new Error('请先核对上次加购结果，再结算。')
    const owner = get().owner
    await get().refresh()
    if (get().owner !== owner || get().busy || get().error || get().stale || get().additionUnknown || get().pendingCount) throw new Error('请先刷新购物车并完成访客合并。')
    return (await api.getSelected(owner)).cart
  },
}))
window.addEventListener('storage', (event) => { if (event.key === storageKey && !useCartStore.getState().busy) useCartStore.getState().refresh() })
