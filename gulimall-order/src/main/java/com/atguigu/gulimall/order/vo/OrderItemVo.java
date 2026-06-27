package com.atguigu.gulimall.order.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class OrderItemVo {
    private Long skuId;

    private Boolean check = true;

    private String title;

    private String image;

    /**
     * Product bundle attributes
     */
    private List<String> skuAttrValues;

    private BigDecimal price;

    private Integer count;

    private BigDecimal totalPrice;

    /** Product weight **/
    private BigDecimal weight = new BigDecimal("0.085");
}
