export const IMAGE_FALLBACK = '/image-unavailable.svg'

export function productImage(path) {
  return typeof path === 'string' && /^(https?:\/\/|\/(?!\/))/.test(path) ? path : IMAGE_FALLBACK
}

export function unavailableReason(item) {
  if (!item?.onSale) return 'This product is off shelf and cannot be purchased.'
  if (item.info?.price == null || !Number.isFinite(Number(item.info.price)) || Number(item.info.price) < 0) return 'Price is unavailable. Retry before purchasing.'
  if (item.hasStock === null || item.hasStock === undefined) return 'Stock is unavailable. Retry before purchasing.'
  return item.hasStock ? '' : 'This product is out of stock.'
}

export function leafCategories(tree, prefix = '') {
  return tree.flatMap((category) => {
    const label = prefix ? `${prefix} / ${category.name}` : category.name
    return category.children?.length ? leafCategories(category.children, label)
      : category.catLevel === 3 ? [{ id: category.catId, label }] : []
  })
}
