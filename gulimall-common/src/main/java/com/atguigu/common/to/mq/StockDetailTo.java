package com.atguigu.common.to.mq;

import lombok.Data;

@Data
public class StockDetailTo {
    private Long id;
    /**
     * sku_id
     */
    private Long skuId;
    /**
     * sku_name
     */
    private String skuName;
    /**
     * Purchase quantity
     */
    private Integer skuNum;
    /**
     * Work order id
     */
    private Long taskId;

    /**
     * Warehouse id
     */
    private Long wareId;

    /**
     * Lock status
     */
    private Integer lockStatus;
}
