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
                Welcome, {user.username || user.phone}
                <span style={{ margin: '0 8px' }}>|</span>
                <a href="#" onClick={(e) => { e.preventDefault(); logout() }}>Sign out</a>
              </>
            ) : (
              <>
                <Link to="/login">Hello, sign in</Link>
                <span style={{ margin: '0 8px' }}>|</span>
                <Link to="/register">Register free</Link>
              </>
            )}
          </div>
          <div>
            <Link to="/member/orders" style={{ marginRight: 16 }}>My orders</Link>
            <Link to="/member/address">Shipping addresses</Link>
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="container">
          <Link to="/" className="logo">
            Gulimall
            <span>Quality living starts here</span>
          </Link>

          <form className="search-box" onSubmit={handleSearch}>
            <input name="keyword" placeholder="Search products..." />
            <button type="submit">Search</button>
          </form>

          <Link to="/cart" className="header-cart">
            🛒 Cart
            {totalCount() > 0 && <span className="cart-badge">{totalCount()}</span>}
          </Link>
        </div>
      </div>

      <nav className="category-nav">
        <div className="container">
          <div className="nav-all">All categories</div>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/search">Product search</Link>
            <Link to="/cart">Cart</Link>
            <Link to="/member/orders">My orders</Link>
          </div>
        </div>
      </nav>
    </header>
  )
}
