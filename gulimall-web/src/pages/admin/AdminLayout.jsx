import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return <div className="container admin-shell">
    <header className="admin-heading"><h1>商城管理</h1><span>商品资料与采购入库</span></header>
    <nav className="admin-nav" aria-label="管理后台">
      <NavLink to="/admin/products">商品管理</NavLink>
      <NavLink to="/admin/procurement">采购与库存</NavLink>
      <NavLink to="/admin/orders">订单</NavLink>
    </nav>
    <Outlet />
  </div>
}
