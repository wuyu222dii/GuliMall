export const catalogKeys = { categories: 'catId', brands: 'brandId', groups: 'attrGroupId', attrs: 'attrId' }
export function catalogPage(value, kind) {
  if (!value || !Array.isArray(value.list) || !Number.isInteger(value.totalCount) || value.totalCount < 0 || !Number.isInteger(value.pageSize) || value.pageSize < 1 || value.pageSize > 100 || !Number.isInteger(value.currPage) || value.currPage < 1 || value.totalPage !== Math.ceil(value.totalCount / value.pageSize) || value.list.length > value.pageSize || value.list.some(row => !row || !row[catalogKeys[kind]])) throw new Error('资料分页结果不完整，请重新加载。')
  return value
}
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
