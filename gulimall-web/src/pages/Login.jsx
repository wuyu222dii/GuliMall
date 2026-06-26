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
      setError('请输入用户名或手机号')
      return
    }
    // 后端 auth-server 登录 API 尚未完整实现，前端模拟登录态
    login({ username: form.username, phone: form.username })
    navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>谷粒商城登录</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名 / 手机号</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="请输入用户名"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="请输入密码"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
            登录
          </button>
        </form>
        <div className="auth-footer">
          还没有账号？<Link to="/register">立即注册</Link>
        </div>
        <p style={{ fontSize: 12, color: '#999', marginTop: 16, textAlign: 'center' }}>
          注：后端 SSO 尚未完整实现，当前为前端模拟登录
        </p>
      </div>
    </div>
  )
}
