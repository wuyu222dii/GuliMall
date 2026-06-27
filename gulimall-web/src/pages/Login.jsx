import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.username.trim()) {
      setError('Please enter your username or phone number')
      return
    }
    // Backend auth-server login API is not fully implemented; frontend mocks auth state
    login({ username: form.username, phone: form.username })
    navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Sign in to Gulimall</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username / Phone</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Enter username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Enter password"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
            Sign in
          </button>
        </form>
        <div className="auth-footer">
          Don&apos;t have an account? <Link to="/register">Register now</Link>
        </div>
        <p style={{ fontSize: 12, color: '#999', marginTop: 16, textAlign: 'center' }}>
          Note: Backend SSO is not fully implemented; login is currently mocked on the frontend.
        </p>
      </div>
    </div>
  )
}
