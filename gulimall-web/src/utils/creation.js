import { formSignature } from './form.js'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
export function parseCreationReference(raw) {
  if (raw === null) return null
  const reference = JSON.parse(raw)
  if (!reference || Object.keys(reference).sort().join(',') !== 'fingerprint,requestId' || !uuid.test(reference.requestId) || !/^[a-f0-9]{64}$/.test(reference.fingerprint)) throw new Error('原创建请求记录无法读取，请先核对服务端结果后明确结束本次记录。')
  return reference
}
export async function creationFingerprint(value, fields) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(formSignature(value, fields)))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}
