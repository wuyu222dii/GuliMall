package com.atguigu.gulimall.order.to;

import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

@Data
public class SpuInfoTo {
    private Long id;
    /**
     * Product name
     */
    private String spuName;
    /**
     * Product description
     */
    private String spuDescription;
    /**
     * Category id
     */
    private Long catalogId;
    /**
     * Brand id
     */
    private Long brandId;

    private String brandName;
    /**
     *
     */
    private BigDecimal weight;
    /**
     * Publish status [0 - Off shelf, 1 - On shelf]
     */
    private Integer publishStatus;
    /**
     *
     */
    private Date createTime;
    /**
     *
     */
    private Date updateTime;
}
