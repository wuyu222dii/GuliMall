package com.atguigu.gulimall.product.service.impl;

import com.atguigu.common.security.ApiProblem;
import com.atguigu.gulimall.product.entity.*;

import com.atguigu.gulimall.product.service.*;
import com.atguigu.gulimall.product.vo.*;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.Query;

import com.atguigu.gulimall.product.dao.SpuInfoDao;
import org.springframework.transaction.annotation.Transactional;


@Service("spuInfoService")
public class SpuInfoServiceImpl extends ServiceImpl<SpuInfoDao, SpuInfoEntity> implements SpuInfoService {

    @Autowired
    SpuInfoDescService spuInfoDescService;
    @Autowired
    SpuImagesService imagesService;
    @Autowired
    AttrService attrService;
    @Autowired
    ProductAttrValueService attrValueService;
    @Autowired
    SkuInfoService skuInfoService;
    @Autowired
    SkuImagesService skuImagesService;
    @Autowired
    SkuSaleAttrValueService skuSaleAttrValueService;

    @Autowired
    BrandService brandService;
    @Autowired
    CategoryService categoryService;
    @Autowired
    SearchSyncService searchSync;

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        IPage<SpuInfoEntity> page = this.page(
                new Query<SpuInfoEntity>().getPage(params),
                new QueryWrapper<SpuInfoEntity>()
        );

        return new PageUtils(page);
    }

    @Transactional
    @Override
    public Long saveSpuInfo(SpuSaveVo vo) {
        if (vo == null) throw new ApiProblem(400, "商品信息不能为空");
        vo.setSpuName(ProductInputs.text(vo.getSpuName(), 200, "商品名称"));
        vo.setSpuDescription(ProductInputs.text(vo.getSpuDescription(), 2000, "商品介绍"));
        CategoryEntity category = categoryService.getById(vo.getCatalogId());
        BrandEntity brand = brandService.getById(vo.getBrandId());
        if (category == null || !Integer.valueOf(3).equals(category.getCatLevel()) || brand == null || !Integer.valueOf(1).equals(brand.getShowStatus())) throw new ApiProblem(400, "请选择有效的三级分类和启用品牌");
        if (vo.getWeight() == null || vo.getWeight().signum() < 0 || vo.getWeight().compareTo(new BigDecimal("999999")) > 0) throw new ApiProblem(400, "重量不正确");
        if (vo.getImages() == null || vo.getImages().isEmpty() || vo.getImages().size() > 20 || vo.getSkus() == null || vo.getSkus().isEmpty() || vo.getSkus().size() > 100) throw new ApiProblem(400, "商品须包含图片和 1–100 个 SKU");
        vo.getImages().forEach(ProductInputs::image);
        if (vo.getDecript() == null) vo.setDecript(Collections.emptyList());
        if (vo.getBaseAttrs() == null) vo.setBaseAttrs(Collections.emptyList());
        if (vo.getDecript().size() > 20 || vo.getBaseAttrs().size() > 50) throw new ApiProblem(400, "商品介绍或规格参数过多");
        vo.getDecript().forEach(ProductInputs::image);
        Map<Long, AttrEntity> attributes = attrService.list(new QueryWrapper<AttrEntity>().eq("catelog_id", vo.getCatalogId()).eq("enable", 1)).stream().collect(Collectors.toMap(AttrEntity::getAttrId, a -> a));
        Set<Long> baseIds = new HashSet<>();
        for (BaseAttrs attr : vo.getBaseAttrs()) {
            if (attr == null || !baseIds.add(attr.getAttrId()) || !attributes.containsKey(attr.getAttrId()) || !Integer.valueOf(1).equals(attributes.get(attr.getAttrId()).getAttrType())) throw new ApiProblem(400, "规格参数不属于当前分类或重复");
            attr.setAttrValues(ProductInputs.text(attr.getAttrValues(), 255, "规格值"));
            if (attr.getShowDesc() != 0 && attr.getShowDesc() != 1) throw new ApiProblem(400, "规格显示状态不正确");
        }
        SpuInfoEntity previous = vo.getId() == null ? null : getOne(new QueryWrapper<SpuInfoEntity>().eq("id", vo.getId()).last("FOR UPDATE"));
        if (vo.getId() != null && previous == null) throw new ApiProblem(404, "商品不存在");
        Map<Long, SkuInfoEntity> existing = previous == null ? Collections.emptyMap() : skuInfoService.getSkusBySpuId(vo.getId()).stream().collect(Collectors.toMap(SkuInfoEntity::getSkuId, s -> s));
        Set<Long> kept = new HashSet<>();
        Set<Map<Long,String>> combinations = new HashSet<>();
        Set<Long> firstIds = null;
        for (Skus sku : vo.getSkus()) {
            if (sku == null) throw new ApiProblem(400, "SKU 不能为空");
            if (sku.getSkuId() != null && (!existing.containsKey(sku.getSkuId()) || !kept.add(sku.getSkuId()))) throw new ApiProblem(400, "SKU 编号不属于此商品或重复");
            sku.setSkuName(ProductInputs.text(sku.getSkuName(), 200, "SKU 名称"));
            sku.setSkuTitle(ProductInputs.text(sku.getSkuTitle(), 200, "SKU 标题"));
            if (sku.getSkuSubtitle() != null && sku.getSkuSubtitle().length() > 500) throw new ApiProblem(400, "SKU 副标题过长");
            ProductInputs.amount(sku.getPrice(), "售价");
            if (sku.getImages() == null || sku.getImages().isEmpty() || sku.getImages().size() > 10 || sku.getImages().stream().filter(Objects::nonNull).filter(i -> i.getDefaultImg() == 1).count() != 1) throw new ApiProblem(400, "每个 SKU 须有 1–10 张图片且只有一张主图");
            for (Images image : sku.getImages()) {
                if (image == null || (image.getDefaultImg() != 0 && image.getDefaultImg() != 1)) throw new ApiProblem(400, "图片信息不正确");
                ProductInputs.image(image.getImgUrl());
            }
            if (sku.getAttr() == null || sku.getAttr().size() > 10) throw new ApiProblem(400, "销售属性不正确");
            Map<Long,String> combination = new TreeMap<>();
            for (com.atguigu.gulimall.product.vo.Attr attr : sku.getAttr()) {
                if (attr == null || !attributes.containsKey(attr.getAttrId()) || !Integer.valueOf(0).equals(attributes.get(attr.getAttrId()).getAttrType())) throw new ApiProblem(400, "销售属性不属于当前分类");
                attr.setAttrName(attributes.get(attr.getAttrId()).getAttrName());
                attr.setAttrValue(ProductInputs.text(attr.getAttrValue(), 255, "销售属性值"));
                if (combination.put(attr.getAttrId(), attr.getAttrValue()) != null) throw new ApiProblem(400, "销售属性重复");
            }
            if (firstIds == null) firstIds = new HashSet<>(combination.keySet());
            if (!firstIds.equals(combination.keySet()) || !combinations.add(combination)) throw new ApiProblem(400, "SKU 销售属性必须完整且组合不能重复");
        }
        if (!kept.equals(existing.keySet())) throw new ApiProblem(409, "已有 SKU 必须保留，以保护库存和订单引用");
        SpuInfoEntity spu = new SpuInfoEntity(); BeanUtils.copyProperties(vo, spu);
        spu.setPublishStatus(previous == null ? 0 : previous.getPublishStatus());
        spu.setCreateTime(previous == null ? new Date() : previous.getCreateTime()); spu.setUpdateTime(new Date());
        saveOrUpdate(spu); Long id = spu.getId();
        SpuInfoDescEntity desc = new SpuInfoDescEntity(); desc.setSpuId(id); desc.setDecript(String.join(",", vo.getDecript())); spuInfoDescService.saveOrUpdate(desc);
        imagesService.remove(new QueryWrapper<SpuImagesEntity>().eq("spu_id", id)); imagesService.saveImages(id, vo.getImages());
        attrValueService.remove(new QueryWrapper<ProductAttrValueEntity>().eq("spu_id", id));
        for (BaseAttrs attr : vo.getBaseAttrs()) {
            ProductAttrValueEntity value = new ProductAttrValueEntity(); value.setSpuId(id); value.setAttrId(attr.getAttrId()); value.setAttrName(attributes.get(attr.getAttrId()).getAttrName());
            value.setAttrValue(attr.getAttrValues()); value.setQuickShow(attr.getShowDesc()); attrValueService.save(value);
        }
        for (Skus sku : vo.getSkus()) {
            SkuInfoEntity value = new SkuInfoEntity(); BeanUtils.copyProperties(sku, value);
            value.setSpuId(id); value.setCatalogId(vo.getCatalogId()); value.setBrandId(vo.getBrandId()); value.setSaleCount(sku.getSkuId() == null ? 0L : existing.get(sku.getSkuId()).getSaleCount());
            value.setSkuDefaultImg(sku.getImages().stream().filter(i -> i.getDefaultImg() == 1).findFirst().get().getImgUrl()); skuInfoService.saveOrUpdate(value);
            Long skuId = value.getSkuId(); skuImagesService.remove(new QueryWrapper<SkuImagesEntity>().eq("sku_id", skuId));
            for (int index = 0; index < sku.getImages().size(); index++) {
                Images image = sku.getImages().get(index); SkuImagesEntity entity = new SkuImagesEntity(); entity.setSkuId(skuId); entity.setImgUrl(image.getImgUrl()); entity.setDefaultImg(image.getDefaultImg()); entity.setImgSort(index); skuImagesService.save(entity);
            }
            skuSaleAttrValueService.remove(new QueryWrapper<SkuSaleAttrValueEntity>().eq("sku_id", skuId));
            for (com.atguigu.gulimall.product.vo.Attr attr : sku.getAttr()) {
                SkuSaleAttrValueEntity entity = new SkuSaleAttrValueEntity(); BeanUtils.copyProperties(attr, entity); entity.setSkuId(skuId); skuSaleAttrValueService.save(entity);
            }
        }
        searchSync.changed(id);
        return id;
    }

    @Override
    public SpuSaveVo getEditor(Long id) {
        SpuInfoEntity spu = getById(id); if (spu == null) throw new ApiProblem(404, "商品不存在");
        SpuSaveVo result = new SpuSaveVo(); BeanUtils.copyProperties(spu, result);
        SpuInfoDescEntity desc = spuInfoDescService.getById(id);
        result.setDecript(desc == null || desc.getDecript() == null || desc.getDecript().isEmpty() ? Collections.emptyList() : Arrays.asList(desc.getDecript().split(",")));
        result.setImages(imagesService.list(new QueryWrapper<SpuImagesEntity>().eq("spu_id", id).orderByAsc("img_sort", "id")).stream().map(SpuImagesEntity::getImgUrl).collect(Collectors.toList()));
        result.setBaseAttrs(attrValueService.baseAttrListforspu(id).stream().map(a -> { BaseAttrs v = new BaseAttrs(); v.setAttrId(a.getAttrId()); v.setAttrValues(a.getAttrValue()); v.setShowDesc(a.getQuickShow() == null ? 0 : a.getQuickShow()); return v; }).collect(Collectors.toList()));
        result.setSkus(skuInfoService.getSkusBySpuId(id).stream().map(s -> {
            Skus v = new Skus(); BeanUtils.copyProperties(s, v);
            v.setImages(skuImagesService.geImagesBySkuId(s.getSkuId()).stream().map(i -> { Images image = new Images(); image.setImgUrl(i.getImgUrl()); image.setDefaultImg(i.getDefaultImg() == null ? 0 : i.getDefaultImg()); return image; }).collect(Collectors.toList()));
            v.setAttr(skuSaleAttrValueService.list(new QueryWrapper<SkuSaleAttrValueEntity>().eq("sku_id", s.getSkuId())).stream().map(a -> { com.atguigu.gulimall.product.vo.Attr attr = new com.atguigu.gulimall.product.vo.Attr(); BeanUtils.copyProperties(a, attr); return attr; }).collect(Collectors.toList())); return v;
        }).collect(Collectors.toList())); return result;
    }
    @Override
    public void saveBaseSpuInfo(SpuInfoEntity spuInfoEntity) {
        this.baseMapper.insert(spuInfoEntity);
    }

    @Override
    public PageUtils queryPageByCondition(Map<String, Object> params) {

        QueryWrapper<SpuInfoEntity> wrapper = new QueryWrapper<>();
        String key = (String) params.get("key");
        if (!StringUtils.isEmpty(key)) {
            wrapper.and((w) -> {
                w.eq("id", key)
                        .or()
                        .like("spu_name", key);
            });
        }

        String status = (String) params.get("status");
        if (!StringUtils.isEmpty(status)) {
            wrapper.eq("publish_status", status);
        }

        String brandId = (String) params.get("brandId");
        if (!StringUtils.isEmpty(brandId) && !"0".equalsIgnoreCase(brandId)) {
            wrapper.eq("brand_id", brandId);
        }

        String catelogId = (String) params.getOrDefault("catalogId", params.get("catelogId"));
        if (!StringUtils.isEmpty(catelogId) && !"0".equalsIgnoreCase(catelogId)) {
            wrapper.eq("catalog_id", catelogId);
        }

        IPage<SpuInfoEntity> page = this.page(
                new Query<SpuInfoEntity>().getPage(params),
                wrapper
        );
        return new PageUtils(page);
    }

    @Override
    public void up(Long spuId) { searchSync.publish(spuId,1); if (!searchSync.synchronize(spuId)) throw new ApiProblem(503,"上架状态已保存，搜索同步失败，已保留重试任务"); }
}
