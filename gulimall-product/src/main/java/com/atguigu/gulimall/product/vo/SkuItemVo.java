package com.atguigu.gulimall.product.vo;

import com.atguigu.gulimall.product.entity.SkuImagesEntity;
import com.atguigu.gulimall.product.entity.SkuInfoEntity;
import com.atguigu.gulimall.product.entity.SpuInfoDescEntity;
import lombok.Data;
import lombok.ToString;

import java.util.List;

@Data
public class SkuItemVo {
    private boolean onSale;
    // null means the inventory result is unknown, never available stock.
    private Boolean hasStock;
    private List<SkuInfoEntity> variants;
    private String spuDescription;
    // 1,skuObtain basic information  pms_sku_info
    private SkuInfoEntity info;

    // 2,skupicture collection information  pms_sku_images
    private List<SkuImagesEntity> images;

    // 3, getspusales attribute combination
    private List<SkuItemSaleAttrVo> saleAttr;

    // 4, getspuIntroduction
    private SpuInfoDescEntity desc;

    // 5, getspuSpecification parameter information
    private List<SpuItemAttrGroupVo> groupAttrs;

}
