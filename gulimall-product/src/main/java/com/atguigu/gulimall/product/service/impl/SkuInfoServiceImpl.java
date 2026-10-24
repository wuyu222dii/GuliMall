package com.atguigu.gulimall.product.service.impl;

import com.alibaba.fastjson.TypeReference;
import com.atguigu.common.security.ApiProblem;
import com.atguigu.common.to.SkuHasStockVo;
import com.atguigu.common.utils.PageUtils;
import com.atguigu.common.utils.R;
import com.atguigu.gulimall.product.dao.SkuInfoDao;
import com.atguigu.gulimall.product.entity.*;
import com.atguigu.gulimall.product.feign.WareFeignService;
import com.atguigu.gulimall.product.service.*;
import com.atguigu.gulimall.product.vo.SkuItemVo;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service("skuInfoService")
public class SkuInfoServiceImpl extends ServiceImpl<SkuInfoDao, SkuInfoEntity> implements SkuInfoService {
    @Autowired private com.atguigu.gulimall.product.service.SearchSyncService searchSync;
    @Autowired private SkuImagesService skuImagesService;
    @Autowired private SpuInfoDescService spuInfoDescService;
    @Autowired private SpuInfoService spuInfoService;
    @Autowired private AttrGroupService attrGroupService;
    @Autowired private SkuSaleAttrValueService skuSaleAttrValueService;
    @Autowired private WareFeignService wareFeignService;

    @Override
    public PageUtils queryPage(Map<String, Object> params) {
        return queryPageByCondition(params);
    }

    @Override
    public void saveSkuInfo(SkuInfoEntity skuInfoEntity) {
        baseMapper.insert(skuInfoEntity);
    }

    @Override
    @Transactional
    public void updateManagedSku(SkuInfoEntity change) {
        SkuInfoEntity old = getById(change.getSkuId());
        if (old == null) throw new ApiProblem(404, "SKU 不存在");
        spuInfoService.getOne(new QueryWrapper<SpuInfoEntity>().eq("id", old.getSpuId()).last("FOR UPDATE"));
        if (change.getSpuId() != null && !change.getSpuId().equals(old.getSpuId())
                || change.getCatalogId() != null && !change.getCatalogId().equals(old.getCatalogId())
                || change.getBrandId() != null && !change.getBrandId().equals(old.getBrandId())) throw new ApiProblem(400, "请通过完整商品编辑修改分类或品牌，不能移动 SKU");
        SkuInfoEntity value = new SkuInfoEntity(); value.setSkuId(old.getSkuId());
        if (change.getPrice() != null) { ProductInputs.amount(change.getPrice(), "售价"); value.setPrice(change.getPrice()); }
        if (change.getSkuName() != null) value.setSkuName(ProductInputs.text(change.getSkuName(), 200, "SKU 名称"));
        if (change.getSkuTitle() != null) value.setSkuTitle(ProductInputs.text(change.getSkuTitle(), 200, "SKU 标题"));
        if (change.getSkuSubtitle() != null) { if (change.getSkuSubtitle().length() > 500) throw new ApiProblem(400, "副标题过长"); value.setSkuSubtitle(change.getSkuSubtitle()); }
        if (change.getSkuDefaultImg() != null) { ProductInputs.image(change.getSkuDefaultImg()); value.setSkuDefaultImg(change.getSkuDefaultImg()); }
        updateById(value); searchSync.changed(old.getSpuId());
    }

    @Override
    public PageUtils queryPageByCondition(Map<String, Object> params) {
        return queryPage(params, false);
    }

    @Override
    public PageUtils querySalePage(Map<String, Object> params) {
        return queryPage(params, true);
    }

    private PageUtils queryPage(Map<String, Object> params, boolean saleOnly) {
        long page = Long.parseLong(value(params, "page", "page", "1"));
        long limit = Long.parseLong(value(params, "limit", "limit", "12"));
        if (page < 1 || page > 100000 || limit < 1 || limit > 100) { throw new ApiProblem(400, "分页参数不正确"); }
        QueryWrapper<SkuInfoEntity> wrapper = new QueryWrapper<>();
        String key = value(params, "keyword", "key", "").trim();
        if (key.length() > 100) { throw new ApiProblem(400, "关键词过长"); }
        if (!key.isEmpty()) {
            wrapper.and(w -> {
                if (key.matches("[0-9]{1,18}")) { w.eq("sku_id", Long.valueOf(key)).or(); }
                w.like("sku_name", key).or().like("sku_title", key);
            });
        }
        Long catalogId = id(value(params, "catalogId", "catelogId", "0"));
        Long brandId = id(value(params, "brandId", "brandId", "0"));
        if (catalogId != null) { wrapper.eq("catalog_id", catalogId); }
        if (brandId != null) { wrapper.eq("brand_id", brandId); }
        BigDecimal min = price(value(params, "min", "min", ""));
        BigDecimal max = price(value(params, "max", "max", ""));
        if (min != null && max != null && min.compareTo(max) > 0) { throw new ApiProblem(400, "最低价不能高于最高价"); }
        if (min != null) { wrapper.ge("price", min); }
        if (max != null) { wrapper.le("price", max); }
        if (saleOnly) { wrapper.inSql("spu_id", "SELECT id FROM pms_spu_info WHERE publish_status = 1"); }
        String sort = value(params, "sort", "sort", "default");
        if ("price_asc".equals(sort)) { wrapper.orderByAsc("price"); }
        else if ("price_desc".equals(sort)) { wrapper.orderByDesc("price"); }
        else if (!"default".equals(sort)) { throw new ApiProblem(400, "排序参数不正确"); }
        wrapper.orderByAsc("sku_id");
        return new PageUtils(page(new Page<SkuInfoEntity>(page, limit), wrapper));
    }

    private String value(Map<String, Object> params, String name, String alias, String fallback) {
        Object value = params.containsKey(name) ? params.get(name) : params.get(alias);
        return value == null || value.toString().trim().isEmpty() ? fallback : value.toString().trim();
    }
    private Long id(String value) {
        long id = Long.parseLong(value);
        if (id < 0) { throw new ApiProblem(400, "分类或品牌编号不正确"); }
        return id == 0 ? null : id;
    }
    private BigDecimal price(String value) {
        if (value.isEmpty()) { return null; }
        BigDecimal price = new BigDecimal(value);
        if (price.signum() < 0 || price.scale() > 2 || price.compareTo(new BigDecimal("999999999999.99")) > 0) {
            throw new ApiProblem(400, "价格必须为非负金额，最多两位小数");
        }
        return price;
    }

    @Override
    public List<SkuInfoEntity> getSkusBySpuId(Long spuId) {
        return list(new QueryWrapper<SkuInfoEntity>().eq("spu_id", spuId).orderByAsc("sku_id"));
    }

    @Override
    public SkuItemVo item(Long skuId) {
        SkuInfoEntity sku = getById(skuId);
        if (sku == null) { throw new ApiProblem(404, "商品不存在"); }
        SpuInfoEntity spu = spuInfoService.getById(sku.getSpuId());
        if (spu == null) { throw new ApiProblem(404, "商品不存在"); }
        SkuItemVo item = new SkuItemVo();
        item.setInfo(sku);
        item.setSpuDescription(spu.getSpuDescription());
        item.setOnSale(Integer.valueOf(1).equals(spu.getPublishStatus()));
        item.setImages(skuImagesService.geImagesBySkuId(skuId));
        item.setVariants(getSkusBySpuId(sku.getSpuId()));
        item.setSaleAttr(skuSaleAttrValueService.getSaleAttrsBySpuId(sku.getSpuId()));
        item.setDesc(spuInfoDescService.getById(sku.getSpuId()));
        item.setGroupAttrs(attrGroupService.getAttrGroupWithAttrsBySpuId(sku.getSpuId(), sku.getCatalogId()));
        try {
            R result = wareFeignService.getSkuHasStock(Collections.singletonList(skuId));
            if (result.getCode() == 0) {
                List<SkuHasStockVo> stock = result.getData("data", new TypeReference<List<SkuHasStockVo>>() {});
                if (stock != null) {
                    stock.stream().filter(s -> skuId.equals(s.getSkuId())).findFirst().ifPresent(s -> item.setHasStock(s.getHasStock()));
                }
            }
        } catch (Exception unavailable) {
            // An unavailable inventory service leaves hasStock unknown and purchasing disabled.
        }
        return item;
    }
}
