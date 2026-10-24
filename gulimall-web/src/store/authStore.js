import { create } from 'zustand'
import * as auth from '../api/auth'
import { useCartStore } from './cartStore'

// Old local mock identities are never credentials.
localStorage.removeItem('gulimall-auth')
let initialization = null
export const useAuthStore = create((set) => ({
  user: null,
  ready: false,
  error: '',
  initialize: () => {
    initialization ||= auth.currentUser()
      .then((res) => { useCartStore.getState().activate(res.user); set({ user: res.user, ready: true, error: '' }) })
      .catch((e) => { useCartStore.getState().activate(null); set({ user: null, ready: true, error: e.status === 401 ? '' : e.message }) })
      .finally(() => { initialization = null })
    return initialization
  },
  login: async (data, admin = false) => {
    const res = await auth.login(data, admin)
    useCartStore.getState().activate(res.user)
    set({ user: res.user, ready: true, error: '' })
  },
  register: async (data) => {
    const res = await auth.register(data)
    useCartStore.getState().activate(res.user)
    set({ user: res.user, ready: true, error: '' })
  },
  logout: async () => {
    await auth.logout()
    useCartStore.getState().activate(null)
    set({ user: null, ready: true, error: '' })
  },
  isLoggedIn: () => !!useAuthStore.getState().user,
}))
window.addEventListener('gulimall:unauthorized', () => { useCartStore.getState().activate(null); useAuthStore.setState({ user: null }) })
