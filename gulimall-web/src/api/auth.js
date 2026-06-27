import request from './request'

/** Send SMS verification code */
export function sendSmsCode(phone) {
  return request.get('/auth-api/sms/sendcode', { params: { phone } })
}

/** Register (backend uses form submit; simulated here) */
export function register(data) {
  return request.post('/auth-api/registry', data)
}
