export function attrParts(value) {
  const split = value.indexOf('_')
  return [value.slice(0, split), value.slice(split + 1)]
}
export function selectAttr(attrs, id, value) {
  const kept = (attrs || []).filter(attr => attrParts(attr)[0] !== String(id))
  return value === '' ? kept : [...kept, `${id}_${value}`]
}
export function searchParams(values) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) for (const item of Array.isArray(value) ? value : [value]) if (item !== '') params.append(key, item)
  return params
}
export function validatedFacets(value) {
  if (!value || !Array.isArray(value.attrs) || value.attrs.length > 20 || typeof value.attrsTruncated !== 'boolean' || new Set(value.attrs.map(attr => attr?.attrId)).size !== value.attrs.length || value.attrs.some(attr => !attr || typeof attr.attrId !== 'string' || !/^[1-9][0-9]{0,17}$/.test(attr.attrId) || typeof attr.attrName !== 'string' || !Array.isArray(attr.values) || attr.values.length > 50 || new Set(attr.values).size !== attr.values.length || attr.values.some(option => typeof option !== 'string' || !/^[^\r\n]{1,255}$/.test(option)) || typeof attr.truncated !== 'boolean')) throw new Error('搜索规格结果不完整，请重试搜索。')
  return value
}
