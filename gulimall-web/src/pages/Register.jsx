import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendSmsCode } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ phone: '', code: '', password: '', username: '' })
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const handleSendCode = async () => {
    if (!/^1\d{10}$/.test(form.phone)) {
      setError('请输入正确的手机号')
      return
    }
    setError('')
    try {
      const res = await sendSmsCode(form.phone)
      if (res.code === 0) {
        setMsg('验证码已发送')
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) { clearInterval(timer); return 0 }
            return c - 1
          })
        }, 1000)
      } else {
        setError(res.msg || '发送失败')
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.phone.trim()) {
      setError('请填写完整信息')
      return
    }
    // 后端注册 API 未完成，模拟注册并登录
    login({ username: form.username, phone: form.phone })
    navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>注册谷粒商城</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>用户名</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="设置用户名"
            />
          </div>
          <div className="form-group">
            <label>手机号</label>
            <div className="form-row">
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="11位手机号"
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={countdown > 0}
                onClick={handleSendCode}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>验证码</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="短信验证码"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="设置密码"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          {msg && <div style={{ color: '#52c41a', fontSize: 13 }}>{msg}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
            注册
          </button>
        </form>
        <div className="auth-footer">
          已有账号？<Link to="/login">立即登录</Link>
        </div>
      </div>
    </div>
  )
}
