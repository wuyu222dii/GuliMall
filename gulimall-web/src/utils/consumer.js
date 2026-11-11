export function consumerQuery(kind, search) {
  const params = new URLSearchParams(search), fields = { address: ['page'], orders: ['page', 'status', 'orderSn'], search: ['page', 'keyword', 'catalogId', 'catalog3Id', 'brandId', 'attrs', 'min', 'max', 'hasStock', 'sort'] }[kind]
  if (!fields || [...params.keys()].some(key => !fields.includes(key) || !(kind === 'search' && ['brandId', 'attrs'].includes(key)) && params.getAll(key).length !== 1)) throw new Error('查询参数不正确或重复，请清除条件后重试。')
  const page = params.get('page') ?? '1'
  if (!/^[1-9][0-9]{0,6}$/.test(page) || Number(page) > (kind === 'search' ? 833 : 1000000)) throw new Error('页码不正确，请清除条件后重试。')
  if (kind === 'address') return { page }
  if (kind === 'orders') {
    const status = params.get('status') || '', orderSn = params.get('orderSn') || ''
    if (status && !/^[0-9]$/.test(status) || orderSn && !/^[a-f0-9]{32}$/.test(orderSn)) throw new Error('订单查询条件不正确，请清除条件后重试。')
    return { page, status, orderSn }
  }
  const value = Object.fromEntries(fields.filter(key => !['brandId', 'attrs'].includes(key)).map(key => [key, params.get(key) ?? '']))
  const id = /^(?:0|[1-9][0-9]{0,17})$/
  if (['catalogId', 'catalog3Id'].some(key => value[key] && !id.test(value[key])) || value.catalogId && value.catalog3Id && value.catalogId !== value.catalog3Id) throw new Error('分类查询条件不正确或冲突。')
  const brandId = params.getAll('brandId').flatMap(value => value.split(',')), attrs = params.getAll('attrs')
  if (brandId.length > 20 || brandId.some(value => !/^[1-9][0-9]{0,17}$/.test(value)) || attrs.length > 20 || attrs.some(value => !/^[1-9][0-9]{0,17}_[^\r\n]{1,255}$/.test(value))) throw new Error('品牌或规格查询条件不正确。')
  if (value.keyword.trim().length > 100 || [value.min, value.max].some(value => value && !/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) || value.min && value.max && Number(value.min) > Number(value.max)) throw new Error('关键词或价格查询条件不正确。')
  if (value.hasStock && !/^[01]$/.test(value.hasStock) || params.has('sort') && !['default', 'price_asc', 'price_desc'].includes(value.sort)) throw new Error('库存或排序查询条件不正确。')
  return { page, keyword: value.keyword.trim(), catalogId: (value.catalogId || value.catalog3Id) === '0' ? '' : value.catalogId || value.catalog3Id, brandId, attrs, min: value.min, max: value.max, hasStock: value.hasStock, sort: value.sort || 'default' }
}
