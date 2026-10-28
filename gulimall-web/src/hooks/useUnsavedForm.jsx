import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'

export default function useUnsavedForm(dirty, busy = false) {
  const [action, setAction] = useState(null), keep = useRef(null), previousFocus = useRef(null)
  const confirmed = useRef(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !confirmed.current && dirty && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search)
  const commit = next => { const previous = confirmed.current; confirmed.current = true; try { return next() } finally { confirmed.current = previous } }
  const open = !!action || blocker.state === 'blocked'
  useEffect(() => {
    if (!dirty) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement; keep.current?.focus()
    return () => { if (previousFocus.current?.isConnected) previousFocus.current.focus() }
  }, [open])
  useEffect(() => {
    if (!dirty) return
    const logout = event => { event.preventDefault(); if (!open) setAction(() => event.detail.proceed) }
    window.addEventListener('gulimall-before-logout', logout)
    return () => window.removeEventListener('gulimall-before-logout', logout)
  }, [dirty, open])
  useEffect(() => { if (!dirty) { if (action) setAction(null); if (blocker.state === 'blocked') blocker.reset() } }, [dirty, action, blocker])
  const cancel = () => { setAction(null); if (blocker.state === 'blocked') blocker.reset() }
  const proceed = () => {
    if (busy) return
    if (action) { setAction(null); if (blocker.state === 'blocked') blocker.reset(); commit(action) }
    else if (blocker.state === 'blocked') blocker.proceed()
  }
  const request = (next, changed = dirty) => { if (open) return; if (changed) setAction(() => next); else next() }
  const keyboard = event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel() }
    if (event.key === 'Tab') {
      const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  const dialog = open && <div className="unsaved-backdrop"><div className="unsaved-dialog" role="alertdialog" aria-modal="true" aria-label="未保存内容确认" aria-describedby="unsaved-description" onKeyDown={keyboard}>
    <h2>有尚未保存的内容</h2><p id="unsaved-description">继续操作会放弃当前未保存输入。这里只确认离开或放弃输入，不会重发业务请求；已有待确认记录仍须核对。</p>
    {busy && <p role="status">请求处理中，请等待结果后再继续。</p>}
    <div className="admin-actions"><button type="button" className="btn btn-outline" ref={keep} onClick={cancel}>继续编辑</button><button type="button" className="btn btn-primary" disabled={busy} onClick={proceed}>确认放弃并继续</button></div>
  </div></div>
  return { request, dialog, commit }
}
