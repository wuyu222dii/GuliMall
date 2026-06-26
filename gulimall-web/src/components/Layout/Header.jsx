import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'

export default function Header() {
  const navigate = useNavigate()
  const totalCount = useCartStore((s) => s.totalCount())
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

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
                <a href="#" onClick={(e) => { e.preventDefault(); logout() }}>退出</a>
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
            <Link to="/member/orders" style={{ marginRight: 16 }}>我的订单</Link>
            <Link to="/member/address">收货地址</Link>
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="container">
          <Link to="/" className="logo">
            谷粒商城
            <span>品质生活，从这里开始</span>
          </Link>

          <form className="search-box" onSubmit={handleSearch}>
            <input name="keyword" placeholder="搜索商品..." />
            <button type="submit">搜索</button>
          </form>

          <Link to="/cart" className="header-cart">
            🛒 购物车
            {totalCount() > 0 && <span className="cart-badge">{totalCount()}</span>}
          </Link>
        </div>
      </div>

      <nav className="category-nav">
        <div className="container">
          <div className="nav-all">全部商品分类</div>
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
