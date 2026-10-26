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
    if (!/^1[3-9]\d{9}$/.test(form.phone)) { setError('请输入正确的手机号'); return }
    setError(''); setMsg(''); setSending(true)
    try {
      const res = await sendSmsCode(form.phone)
      setMsg(res.developmentCode ? `开发验证码：${res.developmentCode}（仅限本地开发）` : '验证码已发送')
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
      <h2>注册谷粒商城</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group"><label htmlFor="register-username">用户名</label><input id="register-username" name="username" autoComplete="username" className="input" required pattern="[A-Za-z_][A-Za-z0-9_]{5,17}" title="6–18 位字母、数字或下划线，以字母或下划线开头" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /><small>6–18 位，以字母或下划线开头。</small></div>
        <div className="form-group"><label htmlFor="register-phone">手机号</label><div className="form-row"><input id="register-phone" name="tel" type="tel" autoComplete="tel" className="input" required pattern="1[3-9][0-9]{9}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><button type="button" className="btn btn-outline" disabled={sending || countdown > 0} onClick={handleSendCode}>{sending ? '正在发送…' : countdown ? `${countdown}s` : '获取验证码'}</button></div></div>
        <div className="form-group"><label htmlFor="register-code">验证码</label><input id="register-code" name="code" autoComplete="one-time-code" inputMode="numeric" className="input" required pattern="[0-9]{6}" maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="register-password">密码</label><input id="register-password" name="password" autoComplete="new-password" className="input" required type="password" minLength={8} maxLength={64} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small>8–64 个字符，UTF-8 编码不超过 72 字节。</small></div>
        {msg && <p role="status">{msg}</p>}{error && <div className="error-msg" role="alert">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', marginTop: 16 }}>{busy ? '正在注册…' : '注册'}</button>
      </form>
      <div className="auth-footer">已有账号？ <Link to="/login">登录</Link></div>
    </div></div>
  )
}
