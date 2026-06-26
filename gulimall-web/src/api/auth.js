import request from './request'

/** 发送短信验证码 */
export function sendSmsCode(phone) {
  return request.get('/auth-api/sms/sendcode', { params: { phone } })
}

/** 注册（后端为表单提交，此处模拟） */
export function register(data) {
  return request.post('/auth-api/registry', data)
}
