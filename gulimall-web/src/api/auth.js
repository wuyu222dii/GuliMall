import request from './request'
export const sendSmsCode = (phone) => request.post('/api/auth/sms/code', { phone })
export const register = (data) => request.post('/api/auth/register', data)
export const login = (data, admin = false) => request.post(admin ? '/api/auth/admin/login' : '/api/auth/login', data)
export const logout = () => request.post('/api/auth/logout')
export const currentUser = () => request.get('/api/auth/me')
