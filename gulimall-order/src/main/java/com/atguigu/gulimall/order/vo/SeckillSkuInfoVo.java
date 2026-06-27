package com.atguigu.gulimall.order.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class SeckillSkuInfoVo {
    /**
     * skuId
     */
    private Long skuId;
    /**
     * spuId
     */
    private Long spuId;
    /**
     * SKU name
     */
    private String skuName;
    /**
     * SKU description
     */
    private String skuDesc;
    /**
     * Category id
     */
    private Long catalogId;
    /**
     * Brand id
     */
    private Long brandId;
    /**
     * Default image
     */
    private String skuDefaultImg;
    /**
     * Title
     */
    private String skuTitle;
    /**
     * Subtitle
     */
    private String skuSubtitle;
    /**
     * Price
     */
    private BigDecimal price;
    /**
     * Sales volume
     */
    private Long saleCount;

}
