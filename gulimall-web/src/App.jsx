import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import Search from './pages/Search'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Login from './pages/Login'
import Register from './pages/Register'
import Checkout from './pages/Checkout'
import MemberOrders from './pages/MemberOrders'
import MemberAddress from './pages/MemberAddress'

export default function App() {
  const { ready, error, initialize } = useAuthStore()
  useEffect(() => { initialize() }, [initialize])
  return (
    <BrowserRouter>
      {!ready ? <div className="loading container">Checking session…</div> : <>
      {error && <div className="error-msg" role="alert">{error} <button className="btn btn-outline" onClick={initialize}>Retry</button></div>}
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="product/:skuId" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<Login />} />
          <Route element={<MemberRoute />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="member/orders" element={<MemberOrders />} />
            <Route path="member/address" element={<MemberAddress />} />
          </Route>
        </Route>
      </Routes>
      </>}
    </BrowserRouter>
  )
}

function MemberRoute() {
  const user = useAuthStore((s) => s.user)
  const { pathname } = useLocation()
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />
  if (user.admin) return <Navigate to="/admin" replace />
  return <Outlet />
}
