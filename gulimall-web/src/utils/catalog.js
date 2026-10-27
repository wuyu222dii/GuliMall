export const catalogKeys = { categories: 'catId', brands: 'brandId', groups: 'attrGroupId', attrs: 'attrId' }
export function catalogCategories(tree, prefix = '') {
  return [...tree].sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0) || a.catId - b.catId).flatMap(row => {
    const path = prefix ? prefix + ' / ' + row.name : row.name
    return [{ ...row, path }, ...catalogCategories(row.children || [], path)]
  })
}
export function catalogRows(meta, kind, filter) {
  if (!meta) return []
  const key = catalogKeys[kind], word = filter.key.trim().toLocaleLowerCase()
  const rows = kind === 'categories' ? catalogCategories(meta.categories) : [...meta[kind]].sort((a, b) => a[key] - b[key])
  return rows.filter(row => (!word || String(row[key]) === word || (row.name || row.attrGroupName || row.attrName).toLocaleLowerCase().includes(word))
    && (!filter.catalogId || String(row.catelogId) === filter.catalogId)
    && (!filter.status || String(kind === 'brands' ? row.showStatus : row.enable) === filter.status)
    && (!filter.type || String(row.attrType) === filter.type))
}
