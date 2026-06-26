import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      isLoggedIn: () => !!useAuthStore.getState().user,
    }),
    { name: 'gulimall-auth' }
  )
)
