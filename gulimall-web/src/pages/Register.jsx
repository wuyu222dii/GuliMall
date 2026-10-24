import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { sendSmsCode } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Register() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)
  const [form, setForm] = useState({ phone: '', code: '', password: '', username: '' })
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (!countdown) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])
  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(form.phone)) { setError('Please enter a valid phone number'); return }
    setError(''); setMsg(''); setSending(true)
    try {
      const res = await sendSmsCode(form.phone)
      setMsg(res.developmentCode ? `开发验证码：${res.developmentCode}（仅限本地开发）` : 'Verification code sent')
      setCountdown(60)
    } catch (e) { setError(e.message) }
    finally { setSending(false) }
  }
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { await register(form); navigate('/') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return (
    <div className="auth-page"><div className="auth-card">
      <h2>Register for Gulimall</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label htmlFor="register-username">Username</label><input id="register-username" name="username" autoComplete="username" className="input" required pattern="[A-Za-z_][A-Za-z0-9_]{5,17}" title="6–18 letters, digits or underscores; start with a letter or underscore" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /><small>6–18 characters; start with a letter or underscore.</small></div>
        <div className="form-group"><label htmlFor="register-phone">Phone</label><div className="form-row"><input id="register-phone" name="tel" type="tel" autoComplete="tel" className="input" required pattern="1[3-9][0-9]{9}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><button type="button" className="btn btn-outline" disabled={sending || countdown > 0} onClick={handleSendCode}>{sending ? 'Sending…' : countdown ? `${countdown}s` : 'Get code'}</button></div></div>
        <div className="form-group"><label htmlFor="register-code">Verification code</label><input id="register-code" name="code" autoComplete="one-time-code" inputMode="numeric" className="input" required pattern="[0-9]{6}" maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="register-password">Password</label><input id="register-password" name="password" autoComplete="new-password" className="input" required type="password" minLength={8} maxLength={64} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small>8–64 characters; at most 72 UTF-8 bytes.</small></div>
        {msg && <p role="status">{msg}</p>}{error && <div className="error-msg" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 16 }}>{busy ? 'Registering…' : 'Register'}</button>
      </form>
      <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
    </div></div>
  )
}
