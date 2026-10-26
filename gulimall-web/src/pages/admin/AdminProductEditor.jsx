import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCatalog, getProductEditor, saveProduct, uploadImage } from '../../api/admin'
import { leafCategories, productImage } from '../../utils/product'

const blankSku = () => ({ skuId: null, skuName: '', skuTitle: '', skuSubtitle: '', price: '0.00', images: [], attr: [] })
const blankProduct = () => ({ id: null, spuName: '', spuDescription: '', catalogId: '', brandId: '', weight: '0.2', images: [], decript: [], baseAttrs: [], skus: [blankSku()] })
const hydrate = (product) => ({ ...blankProduct(), ...product, weight: product.weight ?? '0', skus: product.skus.length ? product.skus : [blankSku()], images: [...new Set([...(product.images || []), ...product.skus.flatMap((s) => s.images.map((i) => i.imgUrl))])] })

export default function AdminProductEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [meta, setMeta] = useState(null)
  const [form, setForm] = useState(blankProduct)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [reloadRequired, setReloadRequired] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setMeta(null); setForm(blankProduct()); setError(''); setNotice(''); setReloadRequired(false)
    Promise.all([getCatalog(), id ? getProductEditor(id) : Promise.resolve(null)]).then(([catalog, editor]) => {
      if (!active) return
      setMeta(catalog.data)
      setForm(editor ? hydrate(editor.product) : blankProduct())
    }).catch((e) => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])
  const categories = meta ? leafCategories(meta.categories) : []
  const attributes = (meta?.attrs || []).filter((a) => String(a.catelogId) === String(form.catalogId))
  const sales = attributes.filter((a) => a.attrType === 0)
  const bases = attributes.filter((a) => a.attrType === 1)
  const selectedSales = form.skus[0]?.attr.map((a) => a.attrId) || []
  const field = (name, value) => setForm({ ...form, [name]: value })
  const skuField = (index, name, value) => setForm({ ...form, skus: form.skus.map((s, i) => i === index ? { ...s, [name]: value } : s) })
  const example = () => {
    const catalogId = Number(form.catalogId || categories[0]?.id)
    const brandId = Number(form.brandId || meta.brands.find((b) => b.showStatus === 1)?.brandId)
    const sale = meta.attrs.find((a) => a.catelogId === catalogId && a.attrType === 0 && Number(a.enable) === 1)
    const base = meta.attrs.find((a) => a.catelogId === catalogId && a.attrType === 1 && Number(a.enable) === 1)
    if (!catalogId || !brandId || !sale) { setError('请先维护三级分类、启用品牌和至少一个销售属性。'); return }
    const values = (sale.valueSelect || '').split(';').filter(Boolean)
    setForm({ ...blankProduct(), catalogId, brandId, spuName: '双 SKU 演示商品', spuDescription: '用于本地录入与采购入库演示，可替换文字、参数与图片。', images: ['/demo-product.svg'], decript: ['/demo-product.svg'],
      baseAttrs: base ? [{ attrId: base.attrId, attrValues: (base.valueSelect || '').split(';')[0] || '示例参数', showDesc: 1 }] : [],
      skus: ['标准版', '升级版'].map((name, index) => ({ ...blankSku(), skuName: `演示商品 ${name}`, skuTitle: `演示商品 ${name}`, price: index ? '2099.00' : '1999.00', attr: [{ attrId: sale.attrId, attrName: sale.attrName, attrValue: values[index] || name }], images: [{ imgUrl: '/demo-product.svg', defaultImg: 1 }] })) })
    setError(''); setNotice('已填入示例，保存前可修改内容。')
  }
  const upload = async (event) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('图片不能超过 2 MB。')
      const result = await uploadImage(file)
      setForm((current) => ({ ...current, images: [...new Set([...current.images, result.url])], skus: current.skus.map((s) => s.images.length ? s : { ...s, images: [{ imgUrl: result.url, defaultImg: 1 }] }) }))
      setNotice('图片已上传，可在各 SKU 中选择使用。')
    } catch (e) { setError(e.message) }
    finally { setUploading(false); input.value = '' }
  }
  const selectSales = (attrId, enabled) => {
    const ids = enabled ? [...selectedSales, attrId] : selectedSales.filter((i) => i !== attrId)
    setForm({ ...form, skus: form.skus.map((s) => ({ ...s, attr: ids.map((key) => s.attr.find((a) => a.attrId === key) || { attrId: key, attrName: sales.find((a) => a.attrId === key).attrName, attrValue: '' }) })) })
  }
  const removeImage = (url) => setForm({ ...form, images: form.images.filter((i) => i !== url), decript: form.decript.filter((i) => i !== url), skus: form.skus.map((s) => {
    const remaining = s.images.filter((i) => i.imgUrl !== url)
    const selected = remaining.find((i) => i.defaultImg === 1)?.imgUrl || remaining[0]?.imgUrl
    return { ...s, images: remaining.map((i) => ({ ...i, defaultImg: i.imgUrl === selected ? 1 : 0 })) }
  }) })
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    let savedId
    try {
      const response = await saveProduct(form); savedId = response.id
      setForm((current) => ({ ...current, id: savedId }))
      const editor = await getProductEditor(savedId)
      setForm(hydrate(editor.product)); navigate(`/admin/products/${savedId}/edit`, { replace: true }); setNotice('商品与 SKU 已保存；已上架商品已加入搜索同步队列，请在同步页面查看结果。')
    } catch (e) { setError(savedId ? '商品已保存，但刷新失败。请重新打开此商品编辑页，避免重复创建。' : e.message); if (savedId) { setReloadRequired(true); navigate(`/admin/products/${savedId}/edit`, { replace: true }) } }
    finally { setBusy(false) }
  }
  if (loading) return <p role="status">正在加载商品编辑资料…</p>
  if (!meta) return <p className="error-msg" role="alert">{error || '基础资料加载失败，请刷新。'}</p>
  return <section>
    <div className="admin-toolbar"><h2>{id ? `编辑商品 #${id}` : '新建商品'}</h2><Link to="/admin/products">返回列表</Link><Link to="/admin/products/catalog">维护基础资料</Link><Link to="/admin/products/sync">查看搜索同步</Link><button className="btn btn-outline" disabled={!!id || busy} onClick={example}>填入双 SKU 示例</button></div>
    {error && <p className="error-msg" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    <form onSubmit={save} className="admin-form">
      <fieldset disabled={busy || uploading}><legend>基本信息</legend><div className="admin-form-grid">
        <label>商品名称<input className="input" required maxLength={200} value={form.spuName} onChange={(e) => field('spuName', e.target.value)} /></label>
        <label>三级分类<select className="input" required value={form.catalogId} onChange={(e) => setForm({ ...form, catalogId: Number(e.target.value), baseAttrs: [], skus: form.skus.map((s) => ({ ...s, attr: [] })) })}><option value="">请选择</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>品牌<select className="input" required value={form.brandId} onChange={(e) => field('brandId', Number(e.target.value))}><option value="">请选择</option>{meta.brands.filter((b) => b.showStatus === 1 || b.brandId === form.brandId).map((b) => <option key={b.brandId} value={b.brandId}>{b.name}</option>)}</select></label>
        <label>重量（kg）<input className="input" type="number" required min="0" max="999999" step="0.001" value={form.weight} onChange={(e) => field('weight', e.target.value)} /></label>
      </div><label>商品介绍<textarea className="input" required maxLength={2000} rows={3} value={form.spuDescription} onChange={(e) => field('spuDescription', e.target.value)} /></label></fieldset>
      <fieldset disabled={busy || uploading}><legend>商品图片</legend><label>上传商品图片<input type="file" accept="image/png,image/jpeg" onChange={upload} /></label><p className="admin-note">支持 PNG / JPEG，最多 2 MB，单边不超过 4096 像素、总像素不超过 800 万。上传目录持久保存。</p>
        {uploading && <p role="status">正在上传…</p>}<div className="admin-images">{form.images.map((url, index) => <div key={url}><img src={productImage(url)} alt={`商品图片 ${index + 1}`} /><label><input type="checkbox" checked={form.decript.includes(url)} onChange={(e) => field('decript', e.target.checked ? [...form.decript, url] : form.decript.filter((i) => i !== url))} /> 用作介绍图</label><span>图片 {index + 1}</span><button type="button" className="btn btn-outline" onClick={() => removeImage(url)}>移除此图片</button></div>)}</div>
      </fieldset>
      <fieldset disabled={busy || uploading}><legend>规格参数</legend>{bases.length ? bases.map((attr) => {
        const value = form.baseAttrs.find((a) => a.attrId === attr.attrId)
        return <div key={attr.attrId} className="admin-attribute"><label><input type="checkbox" checked={!!value} disabled={Number(attr.enable) !== 1 && !value} onChange={(e) => field('baseAttrs', e.target.checked ? [...form.baseAttrs, { attrId: attr.attrId, attrValues: '', showDesc: 1 }] : form.baseAttrs.filter((a) => a.attrId !== attr.attrId))} /> {attr.attrName}{Number(attr.enable) !== 1 && '（已停用，保存前请移除）'}</label>{value && <label>规格值：{attr.attrName}<input className="input" required maxLength={255} value={value.attrValues} onChange={(e) => field('baseAttrs', form.baseAttrs.map((a) => a.attrId === attr.attrId ? { ...a, attrValues: e.target.value } : a))} /></label>}</div>
      }) : <p>当前分类暂无基础属性，可先到基础资料中维护。</p>}</fieldset>
      <fieldset disabled={busy || uploading}><legend>销售属性与 SKU</legend><p className="admin-note">为所有 SKU 选择相同的销售属性，再填写不同的属性值；组合不能重复。已有 SKU 编号须保留，以保护库存与订单引用。</p>
        <div className="admin-actions">{sales.map((attr) => <label key={attr.attrId}><input type="checkbox" checked={selectedSales.includes(attr.attrId)} disabled={Number(attr.enable) !== 1 && !selectedSales.includes(attr.attrId)} onChange={(e) => selectSales(attr.attrId, e.target.checked)} /> {attr.attrName}{Number(attr.enable) !== 1 && '（已停用，保存前请移除）'}</label>)}</div>
        {form.skus.map((sku, index) => <fieldset key={sku.skuId || `new-${index}`} className="admin-sku"><legend>SKU {index + 1}{sku.skuId ? ` · 编号 ${sku.skuId}` : ' · 新增'}</legend><div className="admin-form-grid">
          <label>SKU {index + 1} 名称<input className="input" required maxLength={200} value={sku.skuName} onChange={(e) => skuField(index, 'skuName', e.target.value)} /></label>
          <label>SKU {index + 1} 标题<input className="input" required maxLength={200} value={sku.skuTitle} onChange={(e) => skuField(index, 'skuTitle', e.target.value)} /></label>
          <label>SKU {index + 1} 售价<input className="input" required type="number" min="0" step="0.01" value={sku.price} onChange={(e) => skuField(index, 'price', e.target.value)} /></label>
          <label>SKU {index + 1} 副标题<input className="input" maxLength={500} value={sku.skuSubtitle || ''} onChange={(e) => skuField(index, 'skuSubtitle', e.target.value)} /></label>
          {sku.attr.map((attr) => <label key={attr.attrId}>SKU {index + 1} {attr.attrName}<input className="input" required maxLength={255} value={attr.attrValue} onChange={(e) => skuField(index, 'attr', sku.attr.map((a) => a.attrId === attr.attrId ? { ...a, attrValue: e.target.value } : a))} /></label>)}
          <label>SKU {index + 1} 图片<select aria-label={`SKU ${index + 1} 图片`} className="input" multiple required size={Math.min(Math.max(form.images.length, 2), 5)} value={sku.images.map((i) => i.imgUrl)} onChange={(e) => { const urls = [...e.target.selectedOptions].map((o) => o.value); const previousDefault = sku.images.find((i) => i.defaultImg === 1)?.imgUrl; skuField(index, 'images', urls.map((url, i) => ({ imgUrl: url, defaultImg: url === (urls.includes(previousDefault) ? previousDefault : urls[0]) ? 1 : 0, imgSort: i }))) }}>{form.images.map((url, i) => <option key={url} value={url}>图片 {i + 1}</option>)}</select></label>
          <label>SKU {index + 1} 主图<select aria-label={`SKU ${index + 1} 主图`} className="input" required value={sku.images.find((i) => i.defaultImg === 1)?.imgUrl || ''} onChange={(e) => skuField(index, 'images', sku.images.map((i) => ({ ...i, defaultImg: i.imgUrl === e.target.value ? 1 : 0 })))}><option value="">请选择</option>{sku.images.map((i) => <option key={i.imgUrl} value={i.imgUrl}>图片 {form.images.indexOf(i.imgUrl) + 1}</option>)}</select></label>
        </div><button type="button" className="btn btn-outline" disabled={!!sku.skuId || form.skus.length === 1} onClick={() => field('skus', form.skus.filter((_, i) => i !== index))}>移除此新增 SKU</button></fieldset>)}
        <button type="button" className="btn btn-outline" disabled={form.skus.length >= 100} onClick={() => field('skus', [...form.skus, { ...blankSku(), attr: selectedSales.map((key) => ({ attrId: key, attrName: sales.find((a) => a.attrId === key)?.attrName || '', attrValue: '' })), images: form.images[0] ? [{ imgUrl: form.images[0], defaultImg: 1 }] : [] }])}>添加 SKU</button>
      </fieldset>
      <div className="admin-actions"><button className="btn btn-primary" disabled={busy || uploading || reloadRequired}>{busy ? '正在保存…' : '保存商品与 SKU'}</button><Link to="/admin/products">取消并返回</Link></div>
    </form>
  </section>
}
