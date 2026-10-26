import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'

export default function Header() {
  const navigate = useNavigate()
  const totalCount = useCartStore((s) => s.items.reduce((sum, item) => sum + item.count, 0))
  const cartError = useCartStore((s) => s.error)
  const pendingCount = useCartStore((s) => s.pendingCount)
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [error, setError] = useState('')
  const signOut = async (e) => {
    e.preventDefault()
    setError('')
    try { await logout(); navigate('/') } catch (e) { setError(e.message) }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const keyword = e.target.keyword.value.trim()
    navigate(keyword ? `/search?keyword=${encodeURIComponent(keyword)}` : '/search')
  }

  return (
    <header className="site-header">
      <div className="header-top">
        <div className="container">
          <div>
            {user ? (
              <>
                欢迎，{user.username || user.phone}
                <span style={{ margin: '0 8px' }}>|</span>
                <button type="button" className="header-signout" onClick={signOut}>退出登录</button>
              </>
            ) : (
              <>
                <Link to="/login">你好，请登录</Link>
                <span style={{ margin: '0 8px' }}>|</span>
                <Link to="/register">免费注册</Link>
              </>
            )}
          </div>
          <div>
            {user?.admin ? <Link to="/admin">管理入口</Link> : <><Link to="/member/orders" style={{ marginRight: 16 }}>我的订单</Link><Link to="/member/address">收货地址</Link></>}
          </div>
        </div>
      </div>

      {error && <div className="error-msg container" role="alert">{error}</div>}
      {user && !user.admin && location.pathname !== '/cart' && (cartError || pendingCount > 0) && <div className="error-msg container" role="alert">购物车需要处理，原有数据已保留。 <Link to="/cart">查看购物车 / 重试合并</Link></div>}

      <div className="header-main">
        <div className="container">
          <Link to="/" className="logo">
            Gulimall
            <span>品质生活，从这里开始</span>
          </Link>

          <form className="search-box" onSubmit={handleSearch}>
            <input name="keyword" aria-label="搜索商品" placeholder="搜索商品…" />
            <button type="submit">搜索</button>
          </form>

          <Link to="/cart" className="header-cart">
            🛒 购物车
            {totalCount > 0 && <span className="cart-badge">{totalCount}</span>}
          </Link>
        </div>
      </div>

      <nav className="category-nav">
        <div className="container">
          <div className="nav-all">全部分类</div>
          <div className="nav-links">
            <Link to="/">首页</Link>
            <Link to="/search">商品搜索</Link>
            <Link to="/cart">购物车</Link>
            <Link to="/member/orders">我的订单</Link>
          </div>
        </div>
      </nav>
    </header>
  )
}
