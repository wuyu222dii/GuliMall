import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const admin = location.pathname.startsWith('/admin')
  const { login, user } = useAuthStore()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(form, admin)
      const redirect = params.get('redirect')
      navigate(admin ? redirect?.startsWith('/admin/') && !redirect.startsWith('/admin/login') ? redirect : '/admin/products' : memberRedirect(redirect))
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  if (admin && user?.admin) {
    return <div className="container" style={{ padding: '32px 16px' }}><h1>管理员身份已验证</h1><p>当前账号：{user.username}</p><Link className="btn btn-primary" to="/admin/products">进入管理后台</Link></div>
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>{admin ? '管理员登录' : 'Sign in to Gulimall'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-username">{admin ? '管理员账号' : 'Username / Phone'}</label>
            <input id="login-username" name="username" autoComplete="username" className="input" required maxLength={64} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" autoComplete="current-password" className="input" required type="password" maxLength={64} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <div className="error-msg" role="alert">{error}</div>}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="auth-footer">{admin ? <Link to="/login">会员登录</Link> : <>Don&apos;t have an account? <Link to="/register">Register now</Link><br /><Link to="/admin/login">管理员登录</Link></>}</div>
      </div>
    </div>
  )
}
import { memberRedirect } from '../utils/payment'
