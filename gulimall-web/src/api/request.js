import axios from 'axios'

const request = axios.create({
  timeout: 15000,
  withCredentials: true,
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.msg || error.message || '网络请求失败'
    return Promise.reject(new Error(msg))
  }
)

export default request
