export const IMAGE_FALLBACK = '/image-unavailable.svg'

export function productImage(path) {
  return typeof path === 'string' && /^(https?:\/\/|\/(?!\/))/.test(path) ? path : IMAGE_FALLBACK
}

export function unavailableReason(item) {
  if (!item?.onSale) return '商品已下架，不能购买。'
  if (item.info?.price == null || !Number.isFinite(Number(item.info.price)) || Number(item.info.price) < 0) return '价格暂不可用，请刷新后再购买。'
  if (item.hasStock === null || item.hasStock === undefined) return '库存暂不可用，请刷新后再购买。'
  return item.hasStock ? '' : '商品缺货。'
}

export function leafCategories(tree, prefix = '') {
  return tree.flatMap((category) => {
    const label = prefix ? `${prefix} / ${category.name}` : category.name
    return category.children?.length ? leafCategories(category.children, label)
      : category.catLevel === 3 ? [{ id: category.catId, label }] : []
  })
}
