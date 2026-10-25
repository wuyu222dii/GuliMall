export function orderAttributes(value) {
  if (!value) return ''
  if (!['[', '{'].includes(value.trim()[0])) return value
  try {
    const attributes = JSON.parse(value)
    if (Array.isArray(attributes)) {
      const text = attributes.filter((a) => typeof a?.attrName === 'string' && typeof a.attrValue === 'string').map((a) => `${a.attrName}: ${a.attrValue}`).join(' · ')
      if (text) return text
    }
  } catch { /* Old or incomplete snapshots remain visible without exposing raw metadata. */ }
  return 'Specifications unavailable'
}
export const orderTime = (value) => !value ? '—' : Number.isNaN(new Date(value).getTime()) ? 'Time unavailable' : new Date(value).toLocaleString()
