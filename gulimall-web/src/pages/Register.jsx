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
      setError('Please enter a valid phone number')
      return
    }
    setError('')
    try {
      const res = await sendSmsCode(form.phone)
      if (res.code === 0) {
        setMsg('Verification code sent')
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown((c) => {
            if (c <= 1) { clearInterval(timer); return 0 }
            return c - 1
          })
        }, 1000)
      } else {
        setError(res.msg || 'Failed to send')
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.phone.trim()) {
      setError('Please fill in all required fields')
      return
    }
    // Backend register API is incomplete; simulate registration and login
    login({ username: form.username, phone: form.phone })
    navigate('/')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Register for Gulimall</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Choose a username"
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <div className="form-row">
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="11-digit phone number"
              />
              <button
                type="button"
                className="btn btn-outline"
                disabled={countdown > 0}
                onClick={handleSendCode}
              >
                {countdown > 0 ? `${countdown}s` : 'Get code'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Verification code</label>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="SMS verification code"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Set password"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          {msg && <div style={{ color: '#52c41a', fontSize: 13 }}>{msg}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}>
            Register
          </button>
        </form>
        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
