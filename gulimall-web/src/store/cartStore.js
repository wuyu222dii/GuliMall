import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (sku, count = 1) => {
        const items = get().items
        const existing = items.find((i) => i.skuId === sku.skuId)
        if (existing) {
          set({
            items: items.map((i) =>
              i.skuId === sku.skuId ? { ...i, count: i.count + count } : i
            ),
          })
        } else {
          set({
            items: [
              ...items,
              {
                skuId: sku.skuId,
                skuName: sku.skuName || sku.skuTitle,
                skuDefaultImg: sku.skuDefaultImg,
                price: sku.price,
                count,
              },
            ],
          })
        }
      },

      updateCount: (skuId, count) => {
        if (count <= 0) {
          get().removeItem(skuId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.skuId === skuId ? { ...i, count } : i
          ),
        })
      },

      removeItem: (skuId) => {
        set({ items: get().items.filter((i) => i.skuId !== skuId) })
      },

      clearCart: () => set({ items: [] }),

      totalCount: () => get().items.reduce((sum, i) => sum + i.count, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + Number(i.price) * i.count, 0),
    }),
    { name: 'gulimall-cart' }
  )
)
