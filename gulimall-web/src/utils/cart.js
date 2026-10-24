export const emptyGuest = () => ({ version: 2, guestId: crypto.randomUUID(), guestItems: [], pending: {} })
export function readGuest(raw) {
  if (!raw) return emptyGuest()
  const data = JSON.parse(raw)
  const invalid = () => { throw new Error('Local cart is unreadable. Keep a backup before clearing site storage.') }
  const local = data?.version === 2 ? data : Array.isArray(data?.state?.items) ? { ...emptyGuest(), guestItems: data.state.items } : invalid()
  if (!Array.isArray(local.guestItems) || !local.pending || typeof local.pending !== 'object' || Array.isArray(local.pending) || typeof local.guestId !== 'string') invalid()
  return local
}
export function validQuantity(count) {
  if (!Number.isInteger(count) || count < 1 || count > 999) throw new Error('Quantity must be a whole number from 1 to 999.')
}
export function claimGuest(local, owner) {
  if (local.pending[owner]) return local.pending[owner]
  if (!local.guestItems.length) return null
  for (const item of local.guestItems) {
    validQuantity(item.count)
    if (!Number.isSafeInteger(item.skuId) || item.skuId < 1) throw new Error('Invalid guest SKU. Remove it before merging.')
  }
  const batch = { id: local.guestId, items: local.guestItems.map((i) => ({ ...i, checked: i.checked !== false })) }
  local.pending[owner] = batch
  local.guestItems = []
  local.guestId = crypto.randomUUID()
  return batch
}
export function acknowledgeGuest(local, owner, id) {
  if (local.pending[owner]?.id === id) delete local.pending[owner]
}
export function cartTotals(items) {
  const selected = items.filter((i) => i.checked !== false)
  const ready = selected.length > 0 && selected.every((i) => i.status === 'AVAILABLE')
  return { totalCount: items.reduce((sum, i) => sum + i.count, 0), checkedCount: selected.reduce((sum, i) => sum + i.count, 0), totalAmount: ready ? selected.reduce((sum, i) => sum + Math.round(Number(i.price) * 100) * i.count, 0) / 100 : selected.length ? null : 0, readyToCheckout: ready }
}
