import axios from 'axios'

const request = axios.create({ timeout: 15000, withCredentials: true })
let csrfToken = null
let csrfRequest = null

async function getCsrfToken() {
  if (!csrfToken) {
    csrfRequest ||= axios.get('/api/auth/csrf', { withCredentials: true, timeout: 15000 })
      .then(({ data }) => { csrfToken = data.csrfToken; return csrfToken })
      .finally(() => { csrfRequest = null })
    return csrfRequest
  }
  return csrfToken
}

request.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes(config.method || 'get')) {
    config.headers['X-CSRF-Token'] = await getCsrfToken()
  }
  return config
})
request.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data?.csrfToken) csrfToken = data.csrfToken
    if (response.config.url.endsWith('/logout')) csrfToken = null
    if (data?.code !== undefined && data.code !== 0) {
      const error = new Error(data.msg || '请求失败，请重试')
      error.status = data.code
      return Promise.reject(error)
    }
    return data
  },
  (error) => {
    const status = error.response?.status
    if (status === 401 || status === 403) csrfToken = null
    if (status === 401 && !error.config?.url.endsWith('/login')) {
      window.dispatchEvent(new Event('gulimall:unauthorized'))
    }
    const failure = new Error(error.response?.data?.msg || (status >= 500
      ? '服务暂不可用，请稍后重试。'
      : error.code === 'ECONNABORTED' ? '请求超时，请查询原操作后再重试。'
        : '连接失败，请查询原操作后重试。'))
    failure.status = status
    return Promise.reject(failure)
  }
)
export default request
