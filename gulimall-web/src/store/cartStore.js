import { create } from 'zustand'
import * as api from '../api/cart'
import { getSkuInfo } from '../api/product'
import { unavailableReason } from '../utils/product'
import { readGuest, claimGuest, acknowledgeGuest, validQuantity, cartTotals } from '../utils/cart'

const storageKey = 'gulimall-cart'
const local = () => readGuest(localStorage.getItem(storageKey))
const saveLocal = (data) => localStorage.setItem(storageKey, JSON.stringify(data))
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
  totalAmount: null, readyToCheckout: false,
  activate: (user) => {
    generation++; flight = null
    const owner = !user ? 'guest' : user.admin ? 'admin' : String(user.id)
    set({ owner, items: [], loading: false, busy: false, error: '', pendingCount: 0, totalAmount: null, readyToCheckout: false })
    return get().refresh()
  },
  refresh: () => {
    const owner = get().owner, revision = generation
    if (flight?.owner === owner) return flight.promise
    if (owner === 'admin') {
      set({ items: [], loading: false, error: '请使用会员账号购物，管理员账号不使用会员购物车。', readyToCheckout: false })
      return Promise.resolve(false)
    }
    set({ loading: true, error: '', readyToCheckout: false })
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
          if (active()) { const totals = cartTotals(items); set({ items, totalAmount: totals.totalAmount, readyToCheckout: totals.readyToCheckout }) }
          return true
        }
        const first = await api.getCart(owner)
        if (!active()) return false
        set({ items: first.cart.items, totalAmount: first.cart.totalAmount, readyToCheckout: false })
        while (active()) {
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
        const result = await api.getCart(owner)
        if (active()) set({ items: result.cart.items, totalAmount: result.cart.totalAmount, readyToCheckout: result.cart.readyToCheckout, pendingCount: 0 })
        return true
      } catch (e) {
        if (active()) {
          let count = 0
          try { count = (local().pending[owner]?.items || []).reduce((sum, i) => sum + i.count, 0) } catch { /* Keep the original error. */ }
          set({ error: e.message, readyToCheckout: false, totalAmount: null, pendingCount: count })
        }
        return false
      } finally {
        if (active()) { set({ loading: false }); flight = null }
      }
    })()
    flight = { owner, promise }
    return promise
  },
  mutate: async (remote, guest) => {
    if (get().busy || get().loading) throw new Error('购物车同步中，请稍后重试。')
    const owner = get().owner, revision = generation
    if (owner === 'admin') throw new Error('请使用会员账号购物。')
    set({ busy: true, error: '', readyToCheckout: false })
    try {
      if (owner === 'guest') await locked(() => { const value = local(); guest(value.guestItems, value); value.guestId = crypto.randomUUID(); saveLocal(value) })
      else await remote(owner)
      if (revision === generation) await get().refresh()
    } catch (e) {
      if (revision === generation) set({ error: e.message, readyToCheckout: false })
      throw e
    } finally { if (revision === generation) set({ busy: false }) }
  },
  addItem: async (sku, count = 1) => {
    validQuantity(count)
    return get().mutate((owner) => api.addCart(owner, sku.skuId, count), (items) => {
      const existing = items.find((i) => i.skuId === sku.skuId)
      if (existing) { validQuantity(existing.count + count); existing.count += count }
      else { if (items.length >= 100) throw new Error('购物车最多保存 100 个 SKU。'); items.push({ skuId: sku.skuId, skuName: sku.skuName || sku.skuTitle, skuDefaultImg: sku.skuDefaultImg, price: sku.price, count, checked: true }) }
    })
  },
  updateCount: async (skuId, count) => { validQuantity(count); return get().mutate((owner) => api.updateCartCount(owner, skuId, count), (items) => { const item = items.find((i) => i.skuId === skuId); if (item) item.count = count }) },
  setChecked: (skuId, checked) => get().mutate((owner) => api.checkCart(owner, skuId, checked), (items) => { const item = items.find((i) => i.skuId === skuId); if (item) item.checked = checked }),
  setAllChecked: (checked) => {
    const ids = get().items.map(item => item.skuId)
    return get().mutate(async owner => { for (const id of ids) await api.checkCart(owner, id, checked) }, items => { for (const item of items) item.checked = checked })
  },
  removeItem: (skuId) => get().mutate((owner) => api.removeCart(owner, skuId), (items, data) => { data.guestItems = items.filter((i) => i.skuId !== skuId) }),
  clearCart: () => get().mutate(api.clearCart, (_, data) => { data.guestItems = [] }),
  selected: async () => {
    if (get().owner === 'guest' || get().owner === 'admin') throw new Error('请使用会员账号登录后结算。')
    const owner = get().owner
    await get().refresh()
    if (get().owner !== owner || get().busy || get().error || get().pendingCount) throw new Error('请先刷新购物车并完成访客合并。')
    return (await api.getSelected(owner)).cart
  },
}))
window.addEventListener('storage', (event) => { if (event.key === storageKey && !useCartStore.getState().busy) useCartStore.getState().refresh() })
